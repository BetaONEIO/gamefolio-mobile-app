import express from 'express';
import { Server as TusServer } from '@tus/server';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { supabaseTusStore } from '../tus-storage';
import { supabaseStorage } from '../supabase-storage';
import { storage } from '../storage';
import { insertClipSchema, insertScreenshotSchema } from '@shared/schema';
import { VideoProcessor } from '../video-processor';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import { fullAccessMiddleware } from '../middleware/full-access';
import { hybridFullAccess } from '../middleware/hybrid-auth';
import { LeaderboardService, POINT_VALUES } from '../leaderboard-service';
import { BonusEventsService } from '../bonus-events-service';
import { CreatorMilestoneService } from '../creator-milestone-service';

const router = express.Router();

// Temporary directory for processing
const tempDir = path.join(process.cwd(), "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer for video uploads
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = nanoid(8);
    const fileName = `${Date.now()}-${uniqueId}${path.extname(file.originalname)}`;
    cb(null, fileName);
  }
});

const upload = multer({
  storage: videoStorage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/avi', 'video/x-msvideo'];
    if (allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Only video files are allowed. Supported formats: ${allowedVideoTypes.join(', ')}`));
    }
  }
});

// Configure multer for screenshot uploads (standard upload)
const screenshotStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueId + path.extname(file.originalname));
  }
});

const screenshotUpload = multer({
  storage: screenshotStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB for screenshots
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for screenshots'));
    }
  }
});

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueId + path.extname(file.originalname));
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for avatars
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars'));
    }
  }
});

// TUS server configuration for video/reel uploads
const tusServer = new TusServer({
  path: '/api/upload/tus',
  datastore: supabaseTusStore,
  respectForwardedHeaders: true,
  namingFunction: (req) => {
    // Generate unique ID for each upload
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  },
  onUploadFinish: async (req, upload) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const uploadType = upload.metadata?.uploadType === 'reel' ? 'reel' : 'video';

      // Validate file size based on type
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (upload.size && upload.size > maxSize) {
        throw new Error(`File size exceeds maximum allowed size of 500MB`);
      }

      // Upload to Supabase
      const result = await supabaseTusStore.finishUpload(upload.id, userId, uploadType);

      // Return success response
      return {
        status_code: 200,
        headers: {
          'Upload-Result': JSON.stringify(result)
        },
        body: JSON.stringify({ success: true, result })
      };
    } catch (error) {
      console.error('TUS upload finish error:', error);
      return {
        status_code: 500,
        body: JSON.stringify({ error: 'Upload processing failed' })
      };
    }
  }
});

// Direct video upload endpoint (bypassing TUS for now)
router.post('/video-direct', hybridFullAccess, upload.single('file'), async (req, res) => {
  try {
    console.log('📹 Video upload request received:', {
      fileProvided: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size ? `${(req.file.size / (1024 * 1024)).toFixed(2)} MB` : 'N/A',
      mimeType: req.file?.mimetype,
      uploadType: req.body.uploadType,
      userId: req.user?.id
    });

    if (!req.file) {
      console.error('❌ No video file provided in request');
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { uploadType, filename, filetype } = req.body;

    // Check upload limits before processing
    const limits = await storage.getUploadLimits(req.user!.id);
    const isReel = uploadType === 'reel';
    const contentType = isReel ? 'reel' : 'clip';
    
    // Check daily and concurrent content limits
    if (!limits.isPro) {
      if (isReel) {
        if (limits.totalReelsExisting >= limits.maxReelsTotal) {
          if (req.file?.path) fs.unlink(req.file.path, () => {});
          return res.status(403).json({
            error: 'Reel storage limit reached',
            message: `You have reached the limit of ${limits.maxReelsTotal} reels. Delete some reels to upload more, or upgrade to Gamefolio Pro for unlimited uploads.`,
            limits
          });
        }
        if (!limits.canUploadReel) {
          if (req.file?.path) fs.unlink(req.file.path, () => {});
          return res.status(403).json({ 
            error: 'Daily reel upload limit reached',
            message: `Free users can upload ${limits.maxReelsPerDay} reels per day. Upgrade to Pro for unlimited uploads.`,
            limits
          });
        }
      } else {
        if (limits.totalClipsExisting >= limits.maxClipsTotal) {
          if (req.file?.path) fs.unlink(req.file.path, () => {});
          return res.status(403).json({
            error: 'Clip storage limit reached',
            message: `You have reached the limit of ${limits.maxClipsTotal} clips. Delete some clips to upload more, or upgrade to Gamefolio Pro for unlimited uploads.`,
            limits
          });
        }
        if (!limits.canUploadClip) {
          if (req.file?.path) fs.unlink(req.file.path, () => {});
          return res.status(403).json({ 
            error: 'Daily clip upload limit reached',
            message: `Free users can upload ${limits.maxClipsPerDay} clips per day. Upgrade to Pro for unlimited uploads.`,
            limits
          });
        }
      }
    }
    
    // Check file size limit
    const fileSizeMB = req.file.size / (1024 * 1024);
    if (fileSizeMB > limits.maxVideoSizeMB) {
      // Clean up temp file
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ 
        error: 'File size exceeds limit',
        message: `Maximum video size is ${limits.maxVideoSizeMB}MB. ${limits.isPro ? '' : 'Upgrade to Pro for larger uploads (up to 500MB).'}`,
        limits
      });
    }

    // Read the uploaded file
    const fileBuffer = fs.readFileSync(req.file.path);

    // Generate filename
    const timestamp = Date.now();
    const randomId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(req.file.originalname);
    const prefix = uploadType === 'reel' ? 'reels' : 'videos';
    const fileName = `${prefix}/${timestamp}-${randomId}${extension}`;
    const filePath = `users/${req.user!.id}/${fileName}`;

    console.log('📤 Uploading to Supabase:', fileName);

    // Upload to Supabase
    const result = await supabaseStorage.uploadBuffer(
      fileBuffer,
      fileName,
      req.file.mimetype,
      uploadType,
      req.user!.id
    );

    // Verify upload success and clean up temp file
    if (!result.url) {
      throw new Error('Supabase upload failed - no URL returned');
    }

    console.log('✅ Video uploaded successfully:', result.url);

    // Increment daily upload count
    await storage.incrementDailyUploadCount(req.user!.id, contentType);
    console.log(`📊 Incremented ${contentType} upload count for user ${req.user!.id}`);

    // Clean up temp file immediately after successful Supabase upload
    fs.unlink(req.file.path, (err) => {
      if (err) console.warn('Could not delete temp file:', err);
      else console.log('✅ Temp file cleaned up after Supabase upload');
    });

    res.json({
      success: true,
      result: {
        url: result.url,
        path: filePath
      }
    });

  } catch (error) {
    console.error('❌ Direct video upload error:', error);

    // Clean up temp file on error
    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.warn('Could not delete temp file:', err);
      });
    }

    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Video upload failed' 
    });
  }
});

// Get Supabase upload credentials for direct client-side upload
router.post('/upload/supabase-creds', fullAccessMiddleware, async (req, res) => {
  try {
    const { filePath, contentType } = req.body;
    
    if (!filePath || !contentType) {
      return res.status(400).json({ error: 'Missing filePath or contentType' });
    }
    
    // Generate signed upload URL for Supabase
    const { uploadUrl, publicUrl } = await supabaseStorage.getSignedUploadUrl(filePath, contentType);
    
    res.json({ uploadUrl, publicUrl });
  } catch (error) {
    console.error('Error generating Supabase upload credentials:', error);
    res.status(500).json({ error: 'Failed to generate upload credentials' });
  }
});

// TUS endpoints (keep for future use)
router.all('/tus/*', fullAccessMiddleware, (req, res) => {
  return tusServer.handle(req, res);
});

router.all('/tus', fullAccessMiddleware, (req, res) => {
  return tusServer.handle(req, res);
});

// Screenshot upload endpoint (standard upload)
router.post('/screenshot', hybridFullAccess, screenshotUpload.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No screenshot file provided' });
    }

    // Check upload limits before processing
    const limits = await storage.getUploadLimits(req.user!.id);
    
    // Check daily and concurrent content limits
    if (!limits.isPro) {
      if (limits.totalScreenshotsExisting >= limits.maxScreenshotsTotal) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        return res.status(403).json({
          error: 'Screenshot storage limit reached',
          message: `You have reached the limit of ${limits.maxScreenshotsTotal} screenshots. Delete some screenshots to upload more, or upgrade to Gamefolio Pro for unlimited uploads.`,
          limits
        });
      }
      if (!limits.canUploadScreenshot) {
        // Clean up temp file
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        return res.status(403).json({ 
          error: 'Daily screenshot upload limit reached',
          message: `Free users can upload ${limits.maxScreenshotsPerDay} screenshots per day. Upgrade to Pro for unlimited uploads.`,
          limits
        });
      }
    }
    
    // Check file size limit
    const fileSizeMB = req.file.size / (1024 * 1024);
    if (fileSizeMB > limits.maxImageSizeMB) {
      // Clean up temp file
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ 
        error: 'File size exceeds limit',
        message: `Maximum image size is ${limits.maxImageSizeMB}MB. ${limits.isPro ? '' : 'Upgrade to Pro for larger uploads (up to 100MB).'}`,
        limits
      });
    }

    const { title, description, gameId, tags, ageRestricted } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Handle game ID - ensure game exists in database
    let finalGameId = null;
    if (gameId) {
      try {
        const parsedGameId = parseInt(gameId);

        // Check if game exists, if not create it
        let game = await storage.getGame(parsedGameId);
        if (!game) {
          // Game doesn't exist, we need to fetch it from Twitch API and create it
          console.log(`Game ${parsedGameId} not found in database, fetching from Twitch API`);
          try {
            // First, try to get the game by its Twitch ID
            game = await storage.getGameByTwitchId(parsedGameId.toString());

            if (!game) {
              // Fetch from Twitch API to get game details
              const { twitchApi } = await import('../services/twitch-api.js');
              const gameData = await twitchApi.getGameById(parsedGameId.toString());

              if (gameData) {
                // Check if a game with this name already exists first
                const existingGameByName = await storage.getGameByName(gameData.name);
                if (existingGameByName) {
                  console.log(`✅ Found existing game by name: ${gameData.name} (ID: ${existingGameByName.id})`);
                  game = existingGameByName;
                  finalGameId = existingGameByName.id;
                } else {
                  // Create the game in our database using Twitch data - use higher resolution for crisp display
                  try {
                    game = await storage.createGame({
                      name: gameData.name,
                      imageUrl: gameData.box_art_url ? 
                        gameData.box_art_url.replace('{width}', '600').replace('{height}', '800') : '',
                      twitchId: gameData.id
                    });
                    console.log(`✅ Created game: ${game.name} (ID: ${game.id}, Twitch ID: ${gameData.id})`);
                    finalGameId = game.id;
                  } catch (createError: any) {
                    // Handle race condition where game was created by another request
                    if (createError.code === '23505') { // Unique constraint violation
                      console.log(`Game "${gameData.name}" was created by another request, fetching it`);
                      const raceConditionGame = await storage.getGameByName(gameData.name);
                      if (raceConditionGame) {
                        game = raceConditionGame;
                        finalGameId = raceConditionGame.id;
                      } else {
                        throw createError;
                      }
                    } else {
                      throw createError;
                    }
                  }
                }
              } else {
                console.warn(`❌ Game ${parsedGameId} not found in Twitch API`);
                finalGameId = null;
              }
            } else {
              console.log(`✅ Found existing game by Twitch ID: ${game.name} (ID: ${game.id})`);
              finalGameId = game.id;
            }
          } catch (apiError) {
            console.error('Error fetching from Twitch API:', apiError);
            finalGameId = null;
          }
        } else {
          finalGameId = parsedGameId;
        }
      } catch (error) {
        console.warn('Invalid game ID provided:', gameId);
        finalGameId = null;
      }
    }

    // Validate and parse data
    const screenshotData = {
      userId: req.user!.id,
      title,
      description: description || '',
      gameId: finalGameId,
      tags: tags ? JSON.parse(tags) : [],
      imageUrl: '', // Will be set after upload
      thumbnailUrl: '', // Will be set after processing
      ageRestricted: ageRestricted === true || ageRestricted === 'true',
    };

    // Validate screenshot data with detailed error logging
    let validatedData;
    try {
      validatedData = insertScreenshotSchema.parse(screenshotData);
    } catch (validationError: any) {
      console.error('❌ Screenshot validation failed:', {
        titleLength: title?.length,
        descriptionLength: description?.length,
        tagsCount: screenshotData.tags?.length,
        error: validationError.errors || validationError.message
      });
      
      return res.status(400).json({
        error: 'Invalid screenshot data',
        details: validationError.errors || validationError.message
      });
    }

    // Process and upload image
    const processedBuffer = await sharp(req.file.path, { failOn: 'none' })
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Create thumbnail
    const thumbnailBuffer = await sharp(req.file.path, { failOn: 'none' })
      .resize(320, 180, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Upload to Supabase
    const [imageResult, thumbnailResult] = await Promise.all([
      supabaseStorage.uploadBuffer(
        processedBuffer,
        req.file.originalname,
        'image/jpeg',
        'image',
        req.user!.id
      ),
      supabaseStorage.uploadBuffer(
        thumbnailBuffer,
        `thumb_${req.file.originalname}`,
        'image/jpeg',
        'thumbnail',
        req.user!.id
      )
    ]);

    // Clean up temp file
    fs.unlink(req.file.path, (err) => {
      if (err) console.warn('Could not delete temp file:', err);
    });

    // Generate share code for screenshot
    const shareCode = nanoid(8);
    
    // Save to database
    const screenshotDataWithShareCode = {
      ...screenshotData,
      imageUrl: imageResult.url,
      thumbnailUrl: thumbnailResult.url,
      shareCode: shareCode
    };

    const screenshot = await storage.createScreenshot(screenshotDataWithShareCode);

    // Increment daily upload count
    await storage.incrementDailyUploadCount(req.user!.id, 'screenshot');
    console.log(`📊 Incremented screenshot upload count for user ${req.user!.id}`);

    // Award upload points to the user (screenshots are worth 100 XP)
    await LeaderboardService.awardPoints(
      req.user!.id,
      'screenshot_upload',
      `Upload: Screenshot - ${screenshot.title}`
    );

    // Weekend upload bonus (+50% XP on Sat/Sun)
    await BonusEventsService.awardWeekendUploadBonus(req.user!.id, 100);

    // Creator milestones: first upload of the day + weekly milestones
    await CreatorMilestoneService.checkFirstUploadOfDay(req.user!.id);
    await CreatorMilestoneService.checkWeeklyUploadMilestones(req.user!.id);

    // Consecutive upload bonus
    await BonusEventsService.checkConsecutiveUploadBonus(req.user!.id);

    // Generate QR code and sharing data for screenshot
    const baseUrl = 'https://app.gamefolio.com';

    // Get username for URL and fetch updated user data with new XP/level
    const user = await storage.getUser(req.user!.id);
    console.log(`🎯 XP Debug - User after screenshot award: ID=${user?.id}, totalXP=${user?.totalXP}, level=${user?.level}`);
    const username = user?.username || 'unknown';
    const screenshotUrl = `${baseUrl}/@${username}/screenshot/${screenshot.shareCode}`;
    const qrCodeDataUrl = await QRCode.toDataURL(screenshotUrl);

    const socialMediaLinks = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(screenshotUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out my screenshot!')}&url=${encodeURIComponent(screenshotUrl)}`,
      reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(screenshotUrl)}&title=${encodeURIComponent('Check out this gaming screenshot!')}`,
      discord: screenshotUrl // User will copy this manually for Discord
    };

    const responseData = {
      success: true,
      screenshot: {
        ...screenshot,
        qrCode: qrCodeDataUrl,
        shareUrl: screenshotUrl,
        socialMediaLinks
      },
      xpGained: POINT_VALUES['screenshot_upload'] ?? 100,
      userXP: user?.totalXP || 0,
      userLevel: user?.level || 1,
      message: 'Screenshot uploaded successfully'
    };
    
    console.log(`🎯 XP Debug - Screenshot response: xpGained=${responseData.xpGained}, userXP=${responseData.userXP}, userLevel=${responseData.userLevel}`);
    
    res.json(responseData);

  } catch (error) {
    console.error('Screenshot upload error:', error);

    // Clean up temp file on error
    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.warn('Could not delete temp file:', err);
      });
    }

    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Screenshot upload failed' 
    });
  }
});

// Video/Reel processing endpoint (called after TUS upload completes)
router.post('/process-video', hybridFullAccess, async (req, res) => {
  try {
    const { uploadResult, title, description, gameId, tags, videoType = 'clip', ageRestricted, trimStart: rawTrimStart, trimEnd: rawTrimEnd } = req.body;

    console.log('🔞 Age Restriction Backend Debug:', {
      ageRestricted,
      ageRestrictedType: typeof ageRestricted,
      rawBody: req.body,
      evaluation: ageRestricted === true || ageRestricted === 'true'
    });

    if (!uploadResult || !title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!uploadResult.url || !uploadResult.path) {
      return res.status(400).json({ error: 'Invalid upload result' });
    }

    // Validate video type
    if (!['clip', 'reel'].includes(videoType)) {
      return res.status(400).json({ error: 'Invalid video type. Must be "clip" or "reel"' });
    }

    // Check upload limits before processing
    const limits = await storage.getUploadLimits(req.user!.id);
    const isReel = videoType === 'reel';
    
    // Check daily and concurrent content limits
    if (!limits.isPro) {
      if (isReel) {
        if (limits.totalReelsExisting >= limits.maxReelsTotal) {
          return res.status(403).json({
            error: 'Reel storage limit reached',
            message: `You have reached the limit of ${limits.maxReelsTotal} reels. Delete some reels to upload more, or upgrade to Gamefolio Pro for unlimited uploads.`,
            limits
          });
        }
        if (!limits.canUploadReel) {
          return res.status(403).json({ 
            error: 'Daily reel upload limit reached',
            message: `Free users can upload ${limits.maxReelsPerDay} reels per day. Upgrade to Pro for unlimited uploads.`,
            limits
          });
        }
      } else {
        if (limits.totalClipsExisting >= limits.maxClipsTotal) {
          return res.status(403).json({
            error: 'Clip storage limit reached',
            message: `You have reached the limit of ${limits.maxClipsTotal} clips. Delete some clips to upload more, or upgrade to Gamefolio Pro for unlimited uploads.`,
            limits
          });
        }
        if (!limits.canUploadClip) {
          return res.status(403).json({ 
            error: 'Daily clip upload limit reached',
            message: `Free users can upload ${limits.maxClipsPerDay} clips per day. Upgrade to Pro for unlimited uploads.`,
            limits
          });
        }
      }
    }

    // Handle game ID - ensure game exists in database
    let finalGameId = null;
    if (gameId) {
      try {
        const parsedGameId = parseInt(gameId);

        // Check if game exists, if not create it
        let game = await storage.getGame(parsedGameId);
        if (!game) {
          // Game doesn't exist, we need to fetch it from Twitch API and create it
          console.log(`Game ${parsedGameId} not found in database, fetching from Twitch API`);
          try {
            // First, try to get the game by its Twitch ID
            game = await storage.getGameByTwitchId(parsedGameId.toString());

            if (!game) {
              // Fetch from Twitch API to get game details
              const { twitchApi } = await import('../services/twitch-api.js');
              const gameData = await twitchApi.getGameById(parsedGameId.toString());

              if (gameData) {
                // Check if a game with this name already exists first
                const existingGameByName = await storage.getGameByName(gameData.name);
                if (existingGameByName) {
                  console.log(`✅ Found existing game by name: ${gameData.name} (ID: ${existingGameByName.id})`);
                  game = existingGameByName;
                  finalGameId = existingGameByName.id;
                } else {
                  // Create the game in our database using Twitch data - use higher resolution for crisp display
                  try {
                    game = await storage.createGame({
                      name: gameData.name,
                      imageUrl: gameData.box_art_url ? 
                        gameData.box_art_url.replace('{width}', '600').replace('{height}', '800') : '',
                      twitchId: gameData.id
                    });
                    console.log(`✅ Created game: ${game.name} (ID: ${game.id}, Twitch ID: ${gameData.id})`);
                    finalGameId = game.id;
                  } catch (createError: any) {
                    // Handle race condition where game was created by another request
                    if (createError.code === '23505') { // Unique constraint violation
                      console.log(`Game "${gameData.name}" was created by another request, fetching it`);
                      const raceConditionGame = await storage.getGameByName(gameData.name);
                      if (raceConditionGame) {
                        game = raceConditionGame;
                        finalGameId = raceConditionGame.id;
                      } else {
                        throw createError;
                      }
                    } else {
                      throw createError;
                    }
                  }
                }
              } else {
                console.warn(`❌ Game ${parsedGameId} not found in Twitch API`);
                finalGameId = null;
              }
            } else {
              console.log(`✅ Found existing game by Twitch ID: ${game.name} (ID: ${game.id})`);
              finalGameId = game.id;
            }
          } catch (apiError) {
            console.error('Error fetching from Twitch API:', apiError);
            finalGameId = null;
          }
        } else {
          finalGameId = parsedGameId;
        }
      } catch (error) {
        console.warn('Invalid game ID provided:', gameId);
        finalGameId = null;
      }
    }

    // Prepare initial clip data
    const initialClipData = {
      userId: req.user!.id,
      title,
      description: description || '',
      gameId: finalGameId,
      tags: tags || [],
      videoUrl: uploadResult.url,
      videoType,
      thumbnailUrl: '', // Will be generated
      duration: 0, // Will be determined during processing
      ageRestricted: ageRestricted === true || ageRestricted === 'true',
    };

    // Validate clip data with detailed error logging
    let validatedData;
    try {
      validatedData = insertClipSchema.parse(initialClipData);
    } catch (validationError: any) {
      console.error('❌ Clip validation failed:', {
        titleLength: title?.length,
        descriptionLength: description?.length,
        tagsCount: tags?.length,
        error: validationError.errors || validationError.message
      });
      
      return res.status(400).json({
        error: 'Invalid clip data',
        details: validationError.errors || validationError.message
      });
    }

    // Process video (crop for reels, generate thumbnails)
    let processedVideoUrl = uploadResult.url; // Default to original
    let thumbnailUrl = '';
    let actualDuration = 0; // Initialize actual duration

    // Helper function to generate share code
    const generateShareCode = () => {
      return nanoid(8);
    };

    try {
      // For TUS uploads, we need to download the video to process it locally
      // In a production environment, you might want to use a separate worker queue
      const tempVideoPath = path.join(tempDir, `video-${Date.now()}.mp4`);

      // Download video from Supabase for processing (use signed URL for authenticated access)
      let downloadUrl = uploadResult.url;
      try {
        const signedUrl = await supabaseStorage.convertToSignedUrl(uploadResult.url, 300);
        if (signedUrl) {
          downloadUrl = signedUrl;
          console.log(`🔑 Using signed URL for video download`);
        }
      } catch (signError) {
        console.warn('Could not generate signed URL, falling back to public URL:', signError);
      }
      console.log(`🎬 Downloading video for thumbnail generation from: ${downloadUrl.substring(0, 80)}...`);
      const videoResponse = await fetch(downloadUrl);
      console.log(`📥 Video download response: ${videoResponse.status} ${videoResponse.statusText}`);
      
      if (videoResponse.ok) {
        const videoBuffer = await videoResponse.arrayBuffer();
        console.log(`📦 Video downloaded: ${(videoBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB`);
        await fs.promises.writeFile(tempVideoPath, Buffer.from(videoBuffer));

        // Get actual video duration first
        try {
          const videoInfo = await VideoProcessor.getVideoInfo(tempVideoPath);
          actualDuration = Math.round(videoInfo.duration); // Round to nearest second
          console.log(`📹 Video actual duration: ${actualDuration} seconds`);
        } catch (durationError) {
          console.warn('Failed to extract video duration, using fallback:', durationError);
          actualDuration = 60; // Fallback to 60 seconds if extraction fails
        }

        // Create a temporary clip ID for processing
        const tempClipId = Date.now();

        const requestedTrimStart = rawTrimStart !== undefined && rawTrimStart !== null ? parseInt(rawTrimStart) : 0;
        const requestedTrimEnd = rawTrimEnd !== undefined && rawTrimEnd !== null ? parseInt(rawTrimEnd) : actualDuration;
        const hasTrimming = requestedTrimStart > 0 || requestedTrimEnd < actualDuration;

        if (videoType === 'reel') {
          console.log(`🎬 Processing reel with 9:16 aspect ratio cropping (trim: ${requestedTrimStart}s - ${requestedTrimEnd}s)`);
          const { videoUrl: croppedVideoUrl, thumbnailUrl: reelThumbnailUrl, duration: processedDuration } = await VideoProcessor.processVideo(
            tempVideoPath,
            tempClipId,
            requestedTrimStart,
            requestedTrimEnd,
            true,
            req.user!.id,
            'reel'
          );
          processedVideoUrl = croppedVideoUrl;
          thumbnailUrl = reelThumbnailUrl || '';
          actualDuration = processedDuration;
          console.log(`✅ Reel processed successfully. Thumbnail: ${thumbnailUrl ? thumbnailUrl.substring(0, 60) + '...' : 'NONE'}`);
        } else if (hasTrimming) {
          console.log(`✂️ Trimming clip: ${requestedTrimStart}s - ${requestedTrimEnd}s`);
          const { videoUrl: trimmedVideoUrl, thumbnailUrl: clipThumbnailUrl, duration: processedDuration } = await VideoProcessor.processVideo(
            tempVideoPath,
            tempClipId,
            requestedTrimStart,
            requestedTrimEnd,
            true,
            req.user!.id,
            'clip'
          );
          processedVideoUrl = trimmedVideoUrl;
          thumbnailUrl = clipThumbnailUrl || '';
          actualDuration = processedDuration;
          console.log(`✅ Clip trimmed successfully. Duration: ${actualDuration}s`);
        } else {
          console.log('🖼️ Generating clip thumbnail (no trimming needed)...');
          thumbnailUrl = await VideoProcessor.generateAutoThumbnail(
            tempVideoPath, 
            req.user!.id, 
            `${videoType}_thumb`
          );
          console.log(`✅ Clip thumbnail generated: ${thumbnailUrl ? thumbnailUrl.substring(0, 60) + '...' : 'NONE'}`);
        }

        // Clean up temp video file
        fs.unlink(tempVideoPath, (err) => {
          if (err) console.warn('Could not delete temp video file:', err);
        });
      } else {
        console.warn('Could not download video for thumbnail generation, using fallback');
        // Try to re-download with different approach for duration extraction
        try {
          console.log('Attempting alternative video download for duration extraction...');
          const response = await fetch(downloadUrl);
          if (response.ok) {
            const videoBuffer = await response.arrayBuffer();
            const retryTempPath = path.join(tempDir, `retry-video-${Date.now()}.mp4`);
            await fs.promises.writeFile(retryTempPath, Buffer.from(videoBuffer));
            
            try {
              const videoInfo = await VideoProcessor.getVideoInfo(retryTempPath);
              actualDuration = Math.round(videoInfo.duration);
              console.log(`📹 Successfully extracted duration on retry: ${actualDuration} seconds`);
              
              // Clean up retry temp file
              fs.unlink(retryTempPath, (err) => {
                if (err) console.warn('Could not delete retry temp file:', err);
              });
            } catch (retryDurationError) {
              console.warn('Retry duration extraction also failed, using conservative fallback');
              actualDuration = 30; // More conservative fallback than 60
              
              // Clean up retry temp file
              fs.unlink(retryTempPath, (err) => {
                if (err) console.warn('Could not delete retry temp file:', err);
              });
            }
          } else {
            throw new Error('Retry download failed');
          }
        } catch (retryError) {
          console.warn('Could not extract duration with retry, using fallback');
          actualDuration = 30; // Conservative fallback instead of inaccurate file size estimation
        }

        // Fallback: Create a basic thumbnail
        const thumbnailBuffer = await sharp({
          create: {
            width: 1280,
            height: 720,
            channels: 3,
            background: { r: 30, g: 30, b: 30 }
          }
        })
        .jpeg({ quality: 80 })
        .toBuffer();

        // Upload fallback thumbnail
        const thumbnailResult = await supabaseStorage.uploadBuffer(
          thumbnailBuffer,
          `fallback_thumb_${Date.now()}.jpg`,
          'image/jpeg',
          'thumbnail',
          req.user!.id
        );

        thumbnailUrl = thumbnailResult.url;
      }
    } catch (thumbnailError) {
      console.error('❌ Thumbnail generation failed:', thumbnailError);
      // Try to create a fallback thumbnail instead of leaving it empty
      try {
        console.log('🔄 Creating fallback thumbnail...');
        const fallbackBuffer = await sharp({
          create: {
            width: videoType === 'reel' ? 720 : 1280,
            height: videoType === 'reel' ? 1280 : 720,
            channels: 3,
            background: { r: 30, g: 30, b: 30 }
          }
        })
        .jpeg({ quality: 80 })
        .toBuffer();

        const fallbackResult = await supabaseStorage.uploadBuffer(
          fallbackBuffer,
          `fallback_thumb_${Date.now()}.jpg`,
          'image/jpeg',
          'thumbnail',
          req.user!.id
        );
        thumbnailUrl = fallbackResult.url;
        console.log(`✅ Fallback thumbnail created: ${thumbnailUrl.substring(0, 60)}...`);
      } catch (fallbackError) {
        console.error('❌ Even fallback thumbnail failed:', fallbackError);
        thumbnailUrl = '';
      }
    }

    // Generate consistent share code
    const shareCode = generateShareCode(); // 8-character alphanumeric code

    // Create the final clip data
    const finalClipData = {
      userId: req.user!.id,
      title,
      description: description || '',
      gameId: finalGameId,
      tags: tags || [],
      videoUrl: processedVideoUrl, // Use processed (cropped) video URL for reels
      videoType,
      thumbnailUrl: thumbnailUrl,
      duration: actualDuration || 60, // Use actual duration or fallback to 60
      trimStart: rawTrimStart !== undefined && rawTrimStart !== null ? parseInt(rawTrimStart) : 0,
      trimEnd: rawTrimEnd !== undefined && rawTrimEnd !== null ? parseInt(rawTrimEnd) : actualDuration,
      ageRestricted: ageRestricted === true || ageRestricted === 'true',
      shareCode: shareCode,
    };

    const validatedClipData = insertClipSchema.parse(finalClipData);

    // Create the clip
    const clip = await storage.createClip(validatedClipData);

    // Increment daily upload count
    const uploadContentType = isReel ? 'reel' : 'clip';
    await storage.incrementDailyUploadCount(req.user!.id, uploadContentType);
    console.log(`📊 Incremented ${uploadContentType} upload count for user ${req.user!.id}`);

    // Award upload points to the user
    await LeaderboardService.awardPoints(
      req.user!.id,
      'upload',
      `Upload: ${videoType === 'reel' ? 'Reel' : 'Clip'} - ${title}`
    );

    // Generate QR code and sharing data
    const baseUrl = 'https://app.gamefolio.com';

    // Get username for URL and fetch updated user data with new XP/level
    const user = await storage.getUser(req.user!.id);
    console.log(`🎯 XP Debug - User after award: ID=${user?.id}, totalXP=${user?.totalXP}, level=${user?.level}`);
    const username = user?.username || 'unknown';
    const contentType = videoType === 'reel' ? 'reel' : 'clip';
    const clipUrl = `${baseUrl}/@${username}/${contentType}/${clip.shareCode}`;
    const qrCodeDataUrl = await QRCode.toDataURL(clipUrl);

    const socialMediaLinks = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(clipUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out my ${videoType}!`)}&url=${encodeURIComponent(clipUrl)}`,
      reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(clipUrl)}&title=${encodeURIComponent(`Check out this gaming ${videoType}!`)}`,
      discord: clipUrl // User will copy this manually for Discord
    };

    const responseData = {
      success: true,
      clip: {
        ...clip,
        qrCode: qrCodeDataUrl,
        shareUrl: clipUrl,
        socialMediaLinks
      },
      xpGained: POINT_VALUES['upload'] ?? 200,
      userXP: user?.totalXP || 0,
      userLevel: user?.level || 1,
      message: 'Video processed successfully'
    };
    
    console.log(`🎯 XP Debug - Response data: xpGained=${responseData.xpGained}, userXP=${responseData.userXP}, userLevel=${responseData.userLevel}`);
    
    res.json(responseData);

  } catch (error) {
    console.error('Video processing error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Video processing failed' 
    });
  }
});

// Admin utility: Fix existing clips with incorrect durations
router.post('/fix-durations', fullAccessMiddleware, async (req, res) => {
  try {
    // Check if user is admin (add admin check here if needed)
    const user = await storage.getUser(req.user!.id);
    if (user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get all clips with duration = 60 (likely incorrect)
    const clipsToFix = await storage.getClipsWithDuration(60);
    console.log(`🔧 Found ${clipsToFix.length} clips with potentially incorrect 60-second duration`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const clip of clipsToFix) {
      try {
        // Download video temporarily to extract real duration
        const tempVideoPath = path.join(tempDir, `fix-duration-${clip.id}.mp4`);

        const videoResponse = await fetch(clip.videoUrl);
        if (videoResponse.ok) {
          const videoBuffer = await videoResponse.arrayBuffer();
          await fs.promises.writeFile(tempVideoPath, Buffer.from(videoBuffer));

          // Extract real duration
          const videoInfo = await VideoProcessor.getVideoInfo(tempVideoPath);
          const realDuration = Math.round(videoInfo.duration);

          // Only update if duration is different from 60
          if (realDuration !== 60 && realDuration > 0) {
            await storage.updateClipDuration(clip.id, realDuration);
            console.log(`✅ Fixed clip ${clip.id}: ${60}s → ${realDuration}s`);
            fixedCount++;
          }

          // Clean up temp file
          fs.unlink(tempVideoPath, (err) => {
            if (err) console.warn('Could not delete temp file:', err);
          });
        } else {
          console.warn(`❌ Could not download clip ${clip.id} for duration fix`);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Error fixing clip ${clip.id}:`, error);
        errorCount++;
      }
    }

    res.json({
      success: true,
      message: `Duration fix complete: ${fixedCount} clips fixed, ${errorCount} errors`,
      fixedCount,
      errorCount,
      totalProcessed: clipsToFix.length
    });

  } catch (error) {
    console.error('Duration fix error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Duration fix failed' 
    });
  }
});

// Get upload limits and configuration
router.get('/config', fullAccessMiddleware, (req, res) => {
  res.json({
    limits: {
      video: {
        maxSizeMB: 250,
        protocol: 'TUS'
      },
      reel: {
        maxSizeMB: 250,
        protocol: 'TUS'
      },
      screenshot: {
        maxSizeMB: 100,
        protocol: 'standard'
      }
    },
    supportedFormats: {
      video: ['mp4', 'webm', 'mov', 'avi'],
      image: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    },
    tusEndpoint: '/api/upload/tus'
  });
});

// Get user-specific upload limits and remaining quota
router.get('/limits', fullAccessMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const limits = await storage.getUploadLimits(userId);
    res.json(limits);
  } catch (error) {
    console.error('Error fetching upload limits:', error);
    res.status(500).json({ error: 'Failed to fetch upload limits' });
  }
});

// Avatar upload endpoint
router.post('/avatar', fullAccessMiddleware, avatarUpload.single('avatar'), async (req, res) => {
  try {
    console.log('Avatar upload request received');
    console.log('File received:', req.file);

    if (!req.file) {
      return res.status(400).json({ error: 'No avatar file provided' });
    }

    const isGif = req.file.mimetype === 'image/gif' || req.file.originalname.toLowerCase().endsWith('.gif');
    const user = await storage.getUser(req.user!.id);
    const isPro = user?.isPro === true;

    if (isGif && !isPro) {
      console.log('Non-Pro user tried to upload GIF avatar - rejecting');
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'GIF profile pictures are a Pro feature. Upgrade to Pro to use animated avatars!' });
    }

    let processedBuffer: Buffer;
    let fileName: string;
    let mimeType: string;

    if (isGif && isPro) {
      console.log('Processing GIF avatar for Pro user - preserving animation');
      processedBuffer = fs.readFileSync(req.file.path);
      const timestamp = Date.now();
      const randomId = Math.round(Math.random() * 1E9);
      fileName = `avatar-${timestamp}-${randomId}.gif`;
      mimeType = 'image/gif';
    } else {
      processedBuffer = await sharp(req.file.path)
        .resize(400, 400, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 90 })
        .toBuffer();
      const timestamp = Date.now();
      const randomId = Math.round(Math.random() * 1E9);
      fileName = `avatar-${timestamp}-${randomId}.jpg`;
      mimeType = 'image/jpeg';
    }

    // Upload to Supabase
    const uploadResult = await supabaseStorage.uploadBuffer(
      processedBuffer,
      fileName,
      mimeType,
      'image',
      req.user!.id
    );

    // Clean up temp file
    fs.unlink(req.file.path, (err) => {
      if (err) console.warn('Could not delete temp avatar file:', err);
    });

    // Save avatar URL to user's profile in the database
    await storage.updateUser(req.user!.id, { avatarUrl: uploadResult.url });

    res.json({
      success: true,
      avatarUrl: uploadResult.url,
      message: 'Avatar uploaded successfully'
    });

  } catch (error) {
    console.error('Avatar upload error:', error);

    // Clean up temp file on error
    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.warn('Could not delete temp avatar file:', err);
      });
    }

    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Avatar upload failed' 
    });
  }
});

// Global error handler for multer errors
router.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    // Try to get file size from multiple sources
    let fileSizeMB = 'N/A';
    let attemptedFileSize = 'Unknown';
    
    if (req.file?.size) {
      fileSizeMB = `${(req.file.size / (1024 * 1024)).toFixed(2)} MB`;
      attemptedFileSize = fileSizeMB;
    } else if (req.headers['content-length']) {
      const contentLength = parseInt(req.headers['content-length'], 10);
      attemptedFileSize = `${(contentLength / (1024 * 1024)).toFixed(2)} MB`;
    }
    
    console.error('❌ Multer upload error:', {
      code: error.code,
      field: error.field,
      message: error.message,
      file: req.file?.originalname || 'Unknown filename',
      fileSize: fileSizeMB,
      attemptedUploadSize: attemptedFileSize,
      contentLength: req.headers['content-length'],
      endpoint: req.path,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    if (error.code === 'LIMIT_FILE_SIZE') {
      const limit = error.message.includes('500') ? '500MB' : 
                    error.message.includes('100') ? '100MB' :
                    error.message.includes('20') ? '20MB' : 
                    error.message.includes('5') ? '5MB' : 'the allowed size';
      
      console.error(`📊 File size limit exceeded: User attempted to upload ${attemptedFileSize}, limit is ${limit}`);
      
      return res.status(413).json({
        error: `File too large. Maximum size is ${limit}.`,
        code: 'LIMIT_FILE_SIZE',
        details: error.message,
        attemptedSize: attemptedFileSize
      });
    }

    return res.status(400).json({
      error: error.message || 'File upload error',
      code: error.code
    });
  }

  // If it's not a multer error, pass it to the next error handler
  next(error);
});

export default router;