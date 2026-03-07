import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { storage } from '../storage';
import { EmailService } from '../email-service';
import { nanoid } from 'nanoid';

const router = Router();

// Validation schema for report requests
const reportSchema = z.object({
  reason: z.enum([
    'inappropriate-content',
    'spam', 
    'harassment',
    'violence',
    'hate-speech',
    'copyright',
    'misleading',
    'other'
  ]),
  additionalDetails: z.string().max(500).optional()
});

// Helper function to get content info and send report email
async function processContentReport(
  contentType: 'clip' | 'screenshot' | 'comment',
  contentId: number,
  reportData: { reason: string; additionalDetails?: string },
  reporterId: number,
  res: Response
) {
  try {
    // Get content details
    let contentInfo: any = null;
    let contentAuthor: any = null;
    
    if (contentType === 'clip') {
      contentInfo = await storage.getClip(contentId);
      if (contentInfo) {
        contentAuthor = await storage.getUser(contentInfo.userId);
      }
    } else if (contentType === 'screenshot') {
      contentInfo = await storage.getScreenshot(contentId);
      if (contentInfo) {
        contentAuthor = await storage.getUser(contentInfo.userId);
      }
    } else if (contentType === 'comment') {
      contentInfo = await storage.getComment(contentId);
      if (contentInfo) {
        contentAuthor = await storage.getUser(contentInfo.userId);
      }
    }

    if (!contentInfo) {
      return res.status(404).json({ 
        error: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} not found` 
      });
    }

    if (!contentAuthor) {
      return res.status(404).json({ error: 'Content author not found' });
    }

    // Get reporter info
    const reporter = await storage.getUser(reporterId);
    if (!reporter) {
      return res.status(404).json({ error: 'Reporter not found' });
    }

    // Generate report ID
    const reportId = nanoid(8);

    // Store report in database
    let report: any;
    if (contentType === 'clip') {
      report = await storage.createClipReport({
        clipId: contentId,
        reporterId,
        reason: reportData.reason,
        additionalMessage: reportData.additionalDetails
      });
    } else if (contentType === 'screenshot') {
      report = await storage.createScreenshotReport({
        screenshotId: contentId,
        reporterId,
        reason: reportData.reason,
        additionalMessage: reportData.additionalDetails
      });
    } else if (contentType === 'comment') {
      report = await storage.createCommentReport({
        commentId: contentId,
        reporterId,
        reason: reportData.reason,
        additionalMessage: reportData.additionalDetails
      });
    }

    // Prepare content URL
    let contentUrl = '';
    if (contentType === 'clip') {
      contentUrl = `${process.env.SITE_URL || 'http://localhost:5000'}/clips/${contentId}`;
    } else if (contentType === 'screenshot') {
      contentUrl = `${process.env.SITE_URL || 'http://localhost:5000'}/profile/${contentAuthor.username}`;
    } else if (contentType === 'comment') {
      // Comments don't have direct URLs, use the parent content URL
      contentUrl = `${process.env.SITE_URL || 'http://localhost:5000'}/clips/${contentInfo.clipId || 'unknown'}`;
    }

    // Send email notification to support
    const emailSent = await EmailService.sendContentReportEmail({
      contentType,
      contentId,
      contentTitle: contentInfo.title || contentInfo.content || `${contentType} #${contentId}`,
      contentUrl,
      contentAuthorId: contentAuthor.id,
      contentAuthorUsername: contentAuthor.username,
      contentAuthorEmail: contentAuthor.email || 'unknown@gamefolio.com',
      reporterId: reporter.id,
      reporterUsername: reporter.username,
      reporterEmail: reporter.email || 'unknown@gamefolio.com',
      reason: reportData.reason,
      additionalMessage: reportData.additionalDetails,
      reportId: reportId,
      reportedAt: new Date()
    });

    if (!emailSent) {
      console.warn('Failed to send report email notification');
    }

    res.json({ 
      success: true, 
      message: 'Report submitted successfully',
      reportId 
    });

  } catch (error) {
    console.error(`Error processing ${contentType} report:`, error);
    res.status(500).json({ 
      error: `Failed to submit ${contentType} report` 
    });
  }
}

// Report a clip
router.post('/clips/:id/report', requireAuth, async (req: Request, res: Response) => {
  try {
    const clipId = parseInt(req.params.id);
    if (isNaN(clipId)) {
      return res.status(400).json({ error: 'Invalid clip ID' });
    }

    const reportData = reportSchema.parse(req.body);
    await processContentReport('clip', clipId, reportData, req.user!.id, res);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: error.errors 
      });
    }
    console.error('Error in clip report route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Report a screenshot
router.post('/screenshots/:id/report', requireAuth, async (req: Request, res: Response) => {
  try {
    const screenshotId = parseInt(req.params.id);
    if (isNaN(screenshotId)) {
      return res.status(400).json({ error: 'Invalid screenshot ID' });
    }

    const reportData = reportSchema.parse(req.body);
    await processContentReport('screenshot', screenshotId, reportData, req.user!.id, res);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: error.errors 
      });
    }
    console.error('Error in screenshot report route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Report a comment
router.post('/comments/:id/report', requireAuth, async (req: Request, res: Response) => {
  try {
    const commentId = parseInt(req.params.id);
    if (isNaN(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    const reportData = reportSchema.parse(req.body);
    await processContentReport('comment', commentId, reportData, req.user!.id, res);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: error.errors 
      });
    }
    console.error('Error in comment report route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as reportsRouter };