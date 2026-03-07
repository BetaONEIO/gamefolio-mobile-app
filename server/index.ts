import express, { type Request, Response, NextFunction } from "express";
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from '../shared/schema';
import { setupVite, serveStatic, log } from './vite';
import { registerRoutes } from './routes';
import { runMigration } from './migrate-to-supabase';
import authRoutes from './routes/auth-routes';
import adminRoutes from './routes/admin';
import uploadRoutes from './routes/upload';
import twitchGamesRoutes from './routes/twitch-games';
import gfCheckoutRoutes from './routes/gf-checkout';
import proSubscriptionRoutes from './routes/pro-subscription';
import gfWebhookRoutes from './routes/gf-webhook';
import gfStakingRoutes from './routes/gf-staking';
import storeRoutes from './routes/store';
import { createOGMetaMiddleware } from './og-meta';
import { storage } from './storage';
import { LeaderboardService, loadXpSettingsFromDB } from './leaderboard-service';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Trust proxy for production deployment
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// CORS configuration for production and mobile apps
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    '.replit.app',
    '.repl.co',  
    'localhost',
    'localhost:8081',   // Expo local development
    'localhost:19006',  // Expo web development
    '.gamefolio.com',
    'gamefolio.com',
    '.exp.direct',      // Expo development
    'exp.direct',       // Expo development
    '.expo.dev',        // Expo development
    'expo.dev',         // Expo development
  ];
  
  const isAllowed = origin && allowedOrigins.some(allowed => origin.includes(allowed));
  
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With, Upload-Type, Upload-Length, Upload-Offset, Upload-Metadata, Tus-Resumable, Upload-Defer-Length, Upload-Checksum');
  res.setHeader('Access-Control-Expose-Headers', 'Upload-Offset, Upload-Length, Tus-Resumable, Upload-Metadata, Upload-Result');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

// IMPORTANT: Register webhook routes BEFORE express.json() middleware
// Webhooks need raw body for signature verification
app.use(gfWebhookRoutes);

// Configure body parser with larger limits to support file uploads
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: false, limit: '500mb' }));

// Serve attached assets (including videos) as static files
app.use('/attached_assets', express.static('attached_assets'));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    // Load XP settings from DB and sync into POINT_VALUES
    await loadXpSettingsFromDB();

    // Serve static email assets
    app.use('/static/email-assets', express.static(path.join(__dirname, 'static/email-assets')));

    app.use('/api', authRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api', uploadRoutes);
    app.use('/api/twitch', twitchGamesRoutes);
    app.use(gfCheckoutRoutes);
    app.use(proSubscriptionRoutes);
    app.use(gfStakingRoutes);
    app.use(storeRoutes);

    // Social media preview route - must be before Vite middleware
    app.get('/profile/:username', async (req, res, next) => {
      const userAgent = req.headers['user-agent'] || '';
      
      // Detect social media crawlers
      const isSocialBot = /facebookexternalhit|twitterbot|LinkedInBot|WhatsApp|TelegramBot|discordbot|Slackbot|redditbot|SkypeUriPreview|GoogleBot|bingbot/i.test(userAgent);
      
      if (!isSocialBot) {
        // Not a social media bot, continue to regular SPA routing
        return next();
      }

      try {
        const { username } = req.params;
        
        // Fetch user data
        const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
        
        if (!user.length) {
          return res.status(404).send('<html><head><title>Profile Not Found</title></head><body>Profile not found</body></html>');
        }

        const profile = user[0];
        
        // Generate preview image URL - handle both local dev and production
        const getBaseUrl = () => {
          // In production/Replit, always use HTTPS
          if (process.env.REPLIT_DEPLOYMENT || process.env.REPL_OWNER) {
            const host = req.get('host');
            return `https://${host}`;
          }
          // Local development
          return `${req.protocol}://${req.get('host')}`;
        };
        
        const baseUrl = getBaseUrl();
        const previewImageUrl = `${baseUrl}/api/social-preview/${username}`;
        const profileUrl = `${baseUrl}/profile/${username}`;
        
        // Create HTML with Open Graph meta tags
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${profile.displayName || profile.username} - Gamefolio</title>
    
    <!-- Open Graph meta tags for social media -->
    <meta property="og:type" content="profile">
    <meta property="og:title" content="${profile.displayName || profile.username} - Gamefolio">
    <meta property="og:description" content="${profile.bio || `Check out ${profile.displayName || profile.username}'s gaming portfolio on Gamefolio!`}">
    <meta property="og:url" content="${profileUrl}">
    <meta property="og:image" content="${previewImageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="Gamefolio">
    
    <!-- Twitter Card meta tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${profile.displayName || profile.username} - Gamefolio">
    <meta name="twitter:description" content="${profile.bio || `Check out ${profile.displayName || profile.username}'s gaming portfolio on Gamefolio!`}">
    <meta name="twitter:image" content="${previewImageUrl}">
    
    <!-- LinkedIn meta tags -->
    <meta property="linkedin:title" content="${profile.displayName || profile.username} - Gamefolio">
    <meta property="linkedin:description" content="${profile.bio || `Check out ${profile.displayName || profile.username}'s gaming portfolio on Gamefolio!`}">
    <meta property="linkedin:image" content="${previewImageUrl}">
    
    <!-- Redirect to the actual app after a moment -->
    <meta http-equiv="refresh" content="0;url=${profileUrl}">
    <script>
      // Immediate redirect for users (not bots)
      if (!/bot|crawler|spider/i.test(navigator.userAgent)) {
        window.location.href = '${profileUrl}';
      }
    </script>
</head>
<body>
    <h1>${profile.displayName || profile.username}'s Gamefolio</h1>
    <p>${profile.bio || 'Gaming portfolio on Gamefolio'}</p>
    <p><a href="${profileUrl}">View Profile</a></p>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
        
      } catch (error) {
        console.error('Error generating social preview:', error);
        return next();
      }
    });

    // Open Graph meta tags middleware for clips, reels, and screenshots
    // In development, only serves OG meta HTML to social bots
    // Regular users get the normal Vite-served app
    app.use(createOGMetaMiddleware(storage));

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Server error:", err);
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);

      LeaderboardService.processPeriodicLeaderboardClosures()
        .then(() => log('Leaderboard periodic closures check completed'))
        .catch((err) => console.error('Leaderboard closures check failed:', err));

      setInterval(() => {
        LeaderboardService.processPeriodicLeaderboardClosures()
          .catch((err) => console.error('Leaderboard closures check failed:', err));
      }, 6 * 60 * 60 * 1000);
    });
  } catch (error) {
    console.error("Fatal server error:", error);
    process.exit(1);
  }
})();