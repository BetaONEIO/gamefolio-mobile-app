
import express from 'express';
import { runMigration } from '../migrate-to-supabase';

const router = express.Router();

// Admin authentication middleware
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.user || req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Migrate local files to Supabase storage
router.post('/migrate-to-supabase', requireAdmin, async (req, res) => {
  try {
    const { cleanup } = req.body;
    
    console.log('🚀 Starting storage migration to Supabase...');
    
    await runMigration(cleanup === true);
    
    res.json({
      success: true,
      message: 'Migration completed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Check migration status
router.get('/migration-status', requireAdmin, async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const attachedAssetsDir = path.join(process.cwd(), 'attached_assets');
    
    if (!fs.existsSync(attachedAssetsDir)) {
      return res.json({
        localFilesExist: false,
        fileCount: 0,
        totalSize: 0
      });
    }
    
    const files = fs.readdirSync(attachedAssetsDir);
    let totalSize = 0;
    let mediaFileCount = 0;
    
    for (const file of files) {
      const filePath = path.join(attachedAssetsDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        const isMedia = ['.mp4', '.mov', '.avi', '.webm', '.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
        
        if (isMedia) {
          totalSize += stat.size;
          mediaFileCount++;
        }
      }
    }
    
    res.json({
      localFilesExist: mediaFileCount > 0,
      fileCount: mediaFileCount,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
    });
    
  } catch (error) {
    console.error('Error checking migration status:', error);
    res.status(500).json({
      error: 'Failed to check migration status'
    });
  }
});

export default router;
