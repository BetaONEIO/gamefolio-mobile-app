import { Router } from 'express';
import { MediaBucketMigration } from '../migrations/media-bucket-migration';

const router = Router();

// Migration endpoint
router.post('/migrate-media-storage', async (req, res) => {
  try {
    const migration = new MediaBucketMigration();
    
    const options = {
      sourceBucket: 'gamefolio-media',
      destinationBucket: 'gamefoliowebappmediacontent',
      preserveMetadata: true,
      includeSubfolders: true,
      deleteFromSource: true,
      dryRun: req.body.dryRun || false
    };

    console.log('🚀 Starting media storage migration...');
    const result = await migration.migrateStorage(options);

    if (result.success) {
      console.log('✅ Migration completed successfully');
      res.json({
        success: true,
        message: 'Media storage migration completed successfully',
        result: {
          migratedFiles: result.migratedFiles,
          totalSize: `${(result.totalSize / 1024 / 1024).toFixed(2)} MB`,
          skippedFiles: result.skippedFiles.length,
          errors: result.errors.length
        }
      });
    } else {
      console.log('❌ Migration completed with errors');
      res.status(400).json({
        success: false,
        message: 'Migration completed with errors',
        errors: result.errors,
        result: {
          migratedFiles: result.migratedFiles,
          skippedFiles: result.skippedFiles.length
        }
      });
    }
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Dry run endpoint
router.post('/migrate-media-storage/dry-run', async (req, res) => {
  try {
    const migration = new MediaBucketMigration();
    
    const options = {
      sourceBucket: 'gamefolio-media',
      destinationBucket: 'gamefoliowebappmediacontent',
      preserveMetadata: true,
      includeSubfolders: true,
      deleteFromSource: false,
      dryRun: true
    };

    console.log('📋 Running migration dry run...');
    const result = await migration.migrateStorage(options);

    res.json({
      success: true,
      message: 'Dry run completed',
      result: {
        filesToMigrate: result.migratedFiles,
        estimatedSize: `${(result.totalSize / 1024 / 1024).toFixed(2)} MB`,
        potentialErrors: result.errors
      }
    });
  } catch (error) {
    console.error('Dry run failed:', error);
    res.status(500).json({
      success: false,
      message: 'Dry run failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Validation endpoint
router.get('/validate-migration', async (req, res) => {
  try {
    const migration = new MediaBucketMigration();
    const validation = await migration.validateMigration('gamefoliowebappmediacontent');

    res.json({
      success: true,
      valid: validation.valid,
      issues: validation.issues,
      message: validation.valid ? 'Migration is valid' : 'Migration has issues'
    });
  } catch (error) {
    console.error('Validation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Validation failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;