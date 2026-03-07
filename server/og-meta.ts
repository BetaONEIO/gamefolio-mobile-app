import { Request, Response, NextFunction } from 'express';
import { IStorage } from './storage';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

interface OGMetaTags {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
  videoUrl?: string;
}

export function createOGMetaMiddleware(storage: IStorage) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl;
    
    // Only process GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip API routes
    if (url.startsWith('/api/')) {
      return next();
    }

    // Skip static assets (JS, CSS, images, fonts, etc.)
    // Match file extensions with or without query parameters/hash fragments
    if (/\.(js|jsx|ts|tsx|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|mp4|webm|ogg|mp3|wav|pdf|zip)(\?|#|$)/i.test(url)) {
      return next();
    }

    // Skip @vite and @fs paths used by Vite dev server
    if (url.startsWith('/@vite') || url.startsWith('/@fs') || url.startsWith('/@id')) {
      return next();
    }

    // In development mode, only serve OG meta HTML for social media bots
    // Regular users should get the normal Vite-served app
    if (process.env.NODE_ENV === 'development') {
      const userAgent = req.headers['user-agent'] || '';
      const isSocialBot = /facebookexternalhit|twitterbot|LinkedInBot|WhatsApp|TelegramBot|discordbot|Slackbot|redditbot|SkypeUriPreview/i.test(userAgent);
      
      if (!isSocialBot) {
        // Not a bot in dev mode, let Vite handle it
        return next();
      }
    }

    try {
      let ogTags: OGMetaTags | null = null;

      // Match clip/reel URLs: /@username/clip/:id or /@username/reel/:id
      const clipMatch = url.match(/^\/@([^/]+)\/(clip|reel)s?\/([^/?]+)/);
      if (clipMatch) {
        const [, username, type, idOrShareCode] = clipMatch;
        
        // Try to get clip by ID first, then by share code
        let clip = null;
        const parsedId = parseInt(idOrShareCode);
        
        if (!isNaN(parsedId)) {
          clip = await storage.getClipWithUser(parsedId);
        }
        
        // If not found by ID, try share code
        if (!clip) {
          const clipByShareCode = await storage.getClipByShareCode(idOrShareCode);
          if (clipByShareCode) {
            // Get full clip with user data
            clip = await storage.getClipWithUser(clipByShareCode.id);
          }
        }

        if (clip && clip.user) {
          const contentType = type === 'reel' ? 'Reel' : 'Clip';
          
          // Use OG thumbnail endpoint with play button overlay for clips/reels
          // Fallback to original thumbnail, then game image or user avatar
          const baseHost = `https://${req.get('host')}`;
          let imageUrl = clip.thumbnailUrl || clip.gameImageUrl || clip.user.avatarUrl || '';
          
          // If clip has a share code, use the OG thumbnail endpoint for play button overlay
          if (clip.shareCode && clip.thumbnailUrl) {
            imageUrl = `${baseHost}/api/og-thumbnail/${clip.shareCode}`;
          }
          
          ogTags = {
            title: `${clip.title} - ${clip.user.displayName || clip.user.username} | Gamefolio`,
            description: clip.description || `Watch this amazing ${contentType.toLowerCase()} by ${clip.user.displayName || clip.user.username} on Gamefolio`,
            image: imageUrl,
            url: `https://${req.get('host')}${url}`,
            type: 'video.other',
            videoUrl: clip.videoUrl
          };
        }
      }

      // Match screenshot URLs: /@username/screenshot/:id
      const screenshotMatch = url.match(/^\/@([^/]+)\/screenshots?\/([^/?]+)/);
      if (screenshotMatch && !ogTags) {
        const [, username, idOrShareCode] = screenshotMatch;
        
        // Try to get screenshot by ID first, then by share code
        let screenshot = null;
        const parsedId = parseInt(idOrShareCode);
        
        if (!isNaN(parsedId)) {
          screenshot = await storage.getScreenshot(parsedId);
        }
        
        // If not found by ID, try share code
        if (!screenshot) {
          screenshot = await storage.getScreenshotByShareCode(idOrShareCode);
        }

        if (screenshot) {
          // Get user data
          const user = await storage.getUser(screenshot.userId);
          
          if (user) {
            ogTags = {
              title: `${screenshot.title} - ${user.displayName || user.username} | Gamefolio`,
              description: screenshot.description || `Check out this screenshot by ${user.displayName || user.username} on Gamefolio`,
              image: screenshot.thumbnailUrl || screenshot.imageUrl || '',
              url: `https://${req.get('host')}${url}`,
              type: 'website'
            };
          }
        }
      }

      // If we have OG tags, inject them into the HTML
      if (ogTags) {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        
        // Use the correct index.html based on environment
        const clientTemplate = process.env.NODE_ENV === 'production'
          ? path.resolve(__dirname, "public", "index.html")
          : path.resolve(__dirname, "..", "client", "index.html");

        let html = await fs.promises.readFile(clientTemplate, "utf-8");
        
        // Generate meta tags
        const metaTags = `
    <title>${escapeHtml(ogTags.title)}</title>
    <meta name="description" content="${escapeHtml(ogTags.description)}" />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="${ogTags.type}" />
    <meta property="og:url" content="${escapeHtml(ogTags.url)}" />
    <meta property="og:title" content="${escapeHtml(ogTags.title)}" />
    <meta property="og:description" content="${escapeHtml(ogTags.description)}" />
    <meta property="og:image" content="${escapeHtml(ogTags.image)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(ogTags.image)}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(ogTags.title)}" />
    <meta property="og:site_name" content="Gamefolio" />
    ${ogTags.videoUrl ? `<meta property="og:video" content="${escapeHtml(ogTags.videoUrl)}" />
    <meta property="og:video:secure_url" content="${escapeHtml(ogTags.videoUrl)}" />
    <meta property="og:video:type" content="video/mp4" />
    <meta property="og:video:width" content="1280" />
    <meta property="og:video:height" content="720" />` : ''}
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${escapeHtml(ogTags.url)}" />
    <meta name="twitter:title" content="${escapeHtml(ogTags.title)}" />
    <meta name="twitter:description" content="${escapeHtml(ogTags.description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogTags.image)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(ogTags.title)}" />
    ${ogTags.videoUrl ? `<meta name="twitter:player" content="${escapeHtml(ogTags.videoUrl)}" />
    <meta name="twitter:player:width" content="1280" />
    <meta name="twitter:player:height" content="720" />` : ''}
`;

        // Inject meta tags after the viewport meta tag
        html = html.replace(
          /<meta name="viewport"[^>]*>/,
          `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />${metaTags}`
        );

        res.status(200).set({ "Content-Type": "text/html" }).send(html);
        return;
      }
    } catch (error) {
      console.error('Error generating OG meta tags:', error);
      // Continue to next middleware on error
    }

    next();
  };
}

// Helper function to escape HTML entities
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
