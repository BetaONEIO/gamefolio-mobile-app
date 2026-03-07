import { MediaBucketMigration } from './migrations/media-bucket-migration';

// Simple migration execution script
async function executeMigration() {
  console.log('🚀 Starting media storage migration process...');
  
  const migration = new MediaBucketMigration();
  
  const options = {
    sourceBucket: 'gamefolio-media',
    destinationBucket: 'gamefoliowebappmediacontent',
    preserveMetadata: true,
    includeSubfolders: true,
    deleteFromSource: true,
    dryRun: false
  };

  try {
    // Execute the migration
    const result = await migration.migrateStorage(options);
    
    if (result.success) {
      console.log('✅ Migration completed successfully!');
      console.log(`📊 Results: ${result.migratedFiles} files migrated, ${(result.totalSize / 1024 / 1024).toFixed(2)} MB transferred`);
      
      // Validate the migration
      console.log('🔍 Validating migration...');
      const validation = await migration.validateMigration(options.destinationBucket);
      
      if (validation.valid) {
        console.log('✅ Migration validation passed!');
      } else {
        console.log('⚠️ Migration validation found issues:');
        validation.issues.forEach(issue => console.log(`   - ${issue}`));
      }
    } else {
      console.log('❌ Migration completed with errors:');
      result.errors.forEach(error => console.log(`   - ${error}`));
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  }
}

// Export for potential use in routes
export { executeMigration };

// Run if called directly
if (require.main === module) {
  executeMigration().then(() => {
    console.log('🏁 Migration process completed');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Migration process failed:', error);
    process.exit(1);
  });
}