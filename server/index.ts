import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { eq, sql } from 'drizzle-orm';
import { db, pool } from './db';
import { users } from '../shared/schema';
import { serveStatic, log } from './static';
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
  // Open the port IMMEDIATELY so deployment health checks pass quickly.
  // All other initialization happens after the port is open.
  const port = 5000;
  const server = createServer(app);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // In production, also listen on port 8081 (maps to external port 80)
  // so the deployment health check passes for the primary HTTP endpoint.
  if (process.env.NODE_ENV === "production") {
    const server2 = createServer(app);
    server2.listen({ port: 8081, host: "0.0.0.0", reusePort: true }, () => {
      log("serving on port 8081 (production web)");
    });
  }

  try {
    // Run schema migrations to ensure new columns exist
    try {
      await pool`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_theme text DEFAULT 'default'`;
      console.log('✅ Schema migration: profile_theme column ready');
    } catch (migrationErr: any) {
      console.warn('⚠️ Schema migration warning:', migrationErr?.message);
    }

    try {
      await pool`
        CREATE TABLE IF NOT EXISTS hero_slides (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          subtitle TEXT,
          button_text TEXT,
          button_link TEXT,
          image_url TEXT NOT NULL DEFAULT '',
          display_order INTEGER NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT true,
          visibility TEXT NOT NULL DEFAULT 'everyone',
          text_align TEXT NOT NULL DEFAULT 'left',
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `;
      // Seed from production if table is empty
      const [{ count: slideCount }] = await pool`SELECT COUNT(*)::int AS count FROM hero_slides`;
      if (slideCount === 0) {
        try {
          interface HeroSlideSeed {
            title: string;
            subtitle?: string | null;
            buttonText?: string | null;
            buttonLink?: string | null;
            imageUrl?: string;
            displayOrder?: number;
            isActive?: boolean;
            visibility?: string;
            textAlign?: string;
          }
          const resp = await fetch('https://app.gamefolio.com/api/hero-slides', { headers: { Accept: 'application/json' } });
          if (resp.ok) {
            const raw: unknown = await resp.json();
            const prodSlides: HeroSlideSeed[] = Array.isArray(raw) ? raw.filter(
              (s): s is HeroSlideSeed => s !== null && typeof s === 'object' && typeof (s as HeroSlideSeed).title === 'string'
            ) : [];
            for (let i = 0; i < prodSlides.length; i++) {
              const s = prodSlides[i];
              await pool`
                INSERT INTO hero_slides (title, subtitle, button_text, button_link, image_url, display_order, is_active, visibility, text_align)
                VALUES (${s.title}, ${s.subtitle ?? null}, ${s.buttonText ?? null}, ${s.buttonLink ?? null}, ${s.imageUrl ?? ''}, ${s.displayOrder ?? i}, ${s.isActive ?? true}, ${s.visibility ?? 'everyone'}, ${s.textAlign ?? 'left'})
              `;
            }
            console.log(`✅ Schema migration: hero_slides seeded with ${prodSlides.length} slides from production`);
          } else {
            console.log('✅ Schema migration: hero_slides table ready (no production slides available)');
          }
        } catch (seedErr: any) {
          console.warn('⚠️ hero_slides seed warning:', seedErr?.message);
        }
      } else {
        console.log(`✅ Schema migration: hero_slides table ready (${slideCount} slides)`);
      }
    } catch (migrationErr: any) {
      console.warn('⚠️ hero_slides migration warning:', migrationErr?.message);
    }

    try {
      await pool`
        CREATE TABLE IF NOT EXISTS profile_themes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          bg TEXT NOT NULL,
          accent TEXT NOT NULL,
          preview TEXT[] NOT NULL DEFAULT '{}',
          display_order INTEGER NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `;
      // Seed from hardcoded list if table is empty
      const [{ count }] = await pool`SELECT COUNT(*)::int AS count FROM profile_themes`;
      if (count === 0) {
        const { SELECTABLE_PROFILE_THEMES } = await import('../constants/themes');
        for (let i = 0; i < SELECTABLE_PROFILE_THEMES.length; i++) {
          const t = SELECTABLE_PROFILE_THEMES[i];
          await pool`
            INSERT INTO profile_themes (id, name, description, bg, accent, preview, display_order)
            VALUES (${t.id}, ${t.name}, ${t.description}, ${t.bg}, ${t.accent}, ${t.preview}, ${i})
            ON CONFLICT (id) DO NOTHING
          `;
        }
        console.log(`✅ Schema migration: profile_themes table seeded with ${SELECTABLE_PROFILE_THEMES.length} themes`);
      } else {
        console.log(`✅ Schema migration: profile_themes table ready (${count} themes)`);
      }
    } catch (migrationErr: any) {
      console.warn('⚠️ profile_themes migration warning:', migrationErr?.message);
    }

    await registerRoutes(app, server);

    // Serve static email assets
    app.use('/static/email-assets', express.static(path.join(process.cwd(), 'server/static/email-assets')));

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
    if (app.get("env") !== "development") {
      serveStatic(app);
    }

    // Load XP settings and start leaderboard service in the background
    // so they don't delay port opening.
    loadXpSettingsFromDB()
      .then(() => {
        LeaderboardService.processPeriodicLeaderboardClosures()
          .then(() => log('Leaderboard periodic closures check completed'))
          .catch((err) => console.error('Leaderboard closures check failed:', err));

        setInterval(() => {
          LeaderboardService.processPeriodicLeaderboardClosures()
            .catch((err) => console.error('Leaderboard closures check failed:', err));
        }, 6 * 60 * 60 * 1000);
      })
      .catch((err) => console.error('Background startup failed:', err));
  } catch (error) {
    // Log the error but keep the server running — port is already open
    // so the deployment health check won't fail due to initialization issues.
    console.error("Server initialization error (non-fatal):", error);
  }
})();