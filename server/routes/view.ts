import express from 'express';
import { storage } from '../storage';

const router = express.Router();

// View clip/reel by ID - redirect to proper clip page
router.get('/:id', async (req, res) => {
  try {
    const clipId = parseInt(req.params.id);
    console.log(`🔍 View route: Attempting to load clip ID ${clipId}`);
    
    if (isNaN(clipId) || clipId <= 0) {
      console.log(`❌ View route: Invalid clip ID provided: ${req.params.id}`);
      return res.redirect('/trending');
    }

    // First try to get the clip
    let clip = await storage.getClipWithUser(clipId);
    
    // Handle demo clips (IDs 10000+) that might not be in regular database
    if (!clip && clipId >= 10000) {
      try {
        // Import demo clips dynamically
        const demoUserModule = await import('../demo-user');
        const demoClips = demoUserModule.getDemoClips();
        const demoClip = demoClips.find((c: any) => c.id === clipId);
        
        if (demoClip) {
          console.log(`🎬 View route: Found demo clip ${clipId}`);
          clip = demoClip;
        }
      } catch (demoError) {
        console.log(`⚠️ Warning: Could not load demo clips:`, demoError);
      }
    }
    
    console.log(`🎬 View route: Clip lookup result:`, clip ? {
      id: clip.id,
      title: clip.title || 'No title',
      userId: clip.userId,
      username: clip.user?.username || 'No username',
      videoUrl: clip.videoUrl ? 'Present' : 'Missing',
      videoType: clip.videoType || 'No type'
    } : 'Not found');
    
    if (!clip) {
      console.log(`❌ View route: Clip ${clipId} not found in database`);
      return res.redirect('/');
    }

    // Ensure user data is present - if missing, try to fetch it
    if (!clip.user) {
      console.log(`⚠️ View route: Clip ${clipId} missing user data, attempting to fetch`);
      if (clip.userId) {
        try {
          const user = await storage.getUser(clip.userId);
          if (user) {
            clip.user = user;
          }
        } catch (userError) {
          console.log(`⚠️ Warning: Could not fetch user data for clip ${clipId}:`, userError);
        }
      }
    }

    // If we still don't have user data, create a fallback
    if (!clip.user || !clip.user.username) {
      console.log(`❌ View route: Clip ${clipId} has missing/invalid user data, redirecting to clips page`);
      // Redirect to the clip page directly and let it handle the error
      return res.redirect(`/clips/${clipId}`);
    }

    // Check if video URL exists
    if (!clip.videoUrl) {
      console.log(`❌ View route: Clip ${clipId} has no video URL`);
      return res.redirect(`/clips/${clipId}`); // Still redirect to clip page, let it handle the error
    }

    // Check if this is a reel or clip to redirect appropriately
    const redirectUrl = clip?.videoType === 'reel' ? `/reels/${clipId}` : `/clips/${clipId}`;
    console.log(`✅ View route: Redirecting to ${redirectUrl}`);
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('❌ View route error:', error);
    // Graceful fallback - redirect to clip page and let it handle the error
    console.log('🔄 Redirecting to clip page as fallback');
    res.redirect(`/clips/${req.params.id}`);
  }
});

// View screenshot by ID
router.get('/screenshot/:id', async (req, res) => {
  try {
    const screenshotId = parseInt(req.params.id);
    console.log(`🔍 Screenshot view route: Attempting to load screenshot ID ${screenshotId}`);
    
    if (isNaN(screenshotId) || screenshotId <= 0) {
      console.log(`❌ Screenshot view route: Invalid screenshot ID provided: ${req.params.id}`);
      return res.redirect('/trending');
    }

    const screenshot = await storage.getScreenshot(screenshotId);
    console.log(`📷 Screenshot view route: Screenshot lookup result:`, screenshot ? {
      id: screenshot.id,
      title: screenshot.title || 'No title',
      userId: screenshot.userId,
      imageUrl: screenshot.imageUrl ? 'Present' : 'Missing'
    } : 'Not found');
    
    if (!screenshot) {
      console.log(`❌ Screenshot view route: Screenshot ${screenshotId} not found in database`);
      return res.redirect('/trending');
    }

    if (!screenshot.imageUrl) {
      console.log(`❌ Screenshot view route: Screenshot ${screenshotId} has no image URL`);
      return res.redirect('/trending');
    }

    try {
      // Increment view count (don't fail if this errors)
      await storage.incrementScreenshotViews(screenshotId);
      
      // Award 1 point to the content owner for receiving a view
      const { LeaderboardService } = await import("../leaderboard-service");
      await LeaderboardService.awardPoints(
        screenshot.userId,
        'view',
        `Screenshot #${screenshotId} received a view`
      );
    } catch (viewError) {
      console.log(`⚠️ Warning: Could not increment view count for screenshot ${screenshotId}:`, viewError);
    }

    // Get user for proper redirect
    const user = await storage.getUser(screenshot.userId);
    const username = user?.username || 'unknown';
    
    if (!user || !username || username === 'unknown') {
      console.log(`❌ Screenshot view route: Screenshot ${screenshotId} has missing user data`);
      return res.redirect('/trending');
    }
    
    const redirectUrl = `/@${username}/screenshots/${screenshotId}`;
    console.log(`✅ Screenshot view route: Redirecting to ${redirectUrl}`);
    
    // Redirect to the shared content page
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('❌ Screenshot view route error:', error);
    // Graceful fallback instead of error page
    console.log('🔄 Redirecting to trending page as fallback');
    res.redirect('/trending');
  }
});

// Handle shared screenshot URLs with shareCode: /@username/screenshot/shareCode
router.get('/@:username/screenshot/:shareCode', async (req, res) => {
  try {
    const { username, shareCode } = req.params;
    console.log(`🔗 Profile screenshot share route: Attempting to load screenshot with shareCode ${shareCode} from user ${username}`);
    
    if (!shareCode || !username) {
      console.log(`❌ Profile screenshot share route: Missing username or shareCode`);
      return res.redirect('/trending');
    }

    // Look up the screenshot by shareCode
    const screenshot = await storage.getScreenshotByShareCode(shareCode);
    
    if (!screenshot) {
      console.log(`❌ Profile screenshot share route: Screenshot with shareCode ${shareCode} not found`);
      return res.redirect('/trending');
    }

    // Get the user who owns this screenshot
    const user = await storage.getUser(screenshot.userId);
    
    if (!user || user.username !== username) {
      console.log(`❌ Profile screenshot share route: Username mismatch or user not found. Expected: ${username}, Found: ${user?.username || 'none'}`);
      return res.redirect('/trending');
    }

    try {
      // Increment view count (don't fail if this errors)
      await storage.incrementScreenshotViews(screenshot.id);
    } catch (viewError) {
      console.log(`⚠️ Warning: Could not increment view count for screenshot ${screenshot.id}:`, viewError);
    }

    // Redirect to the profile page with screenshot ID
    const redirectUrl = `/@${username}/screenshots/${screenshot.id}`;
    console.log(`✅ Profile screenshot share route: Redirecting to ${redirectUrl}`);
    
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('❌ Profile screenshot share route error:', error);
    // Graceful fallback
    console.log('🔄 Redirecting to trending page as fallback');
    res.redirect('/trending');
  }
});

export default router;