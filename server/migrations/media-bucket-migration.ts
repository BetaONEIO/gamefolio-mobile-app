import { createClient } from '@supabase/supabase-js';
import { db } from '../db';

// Initialize Supabase client only when needed to avoid startup errors
function getSupabaseClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_ANON_KEY');
  }
  
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
}

interface MigrationOptions {
  sourceBucket: string;
  destinationBucket: string;
  preserveMetadata: boolean;
  includeSubfolders: boolean;
  deleteFromSource: boolean;
  dryRun?: boolean;
}

interface MigrationResult {
  success: boolean;
  migratedFiles: number;
  errors: string[];
  skippedFiles: string[];
  totalSize: number;
}

export class MediaBucketMigration {
  constructor() {
    // Direct database access for migration operations
  }

  async migrateStorage(options: MigrationOptions): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedFiles: 0,
      errors: [],
      skippedFiles: [],
      totalSize: 0
    };

    console.log(`🚀 Starting migration from "${options.sourceBucket}" to "${options.destinationBucket}"`);
    
    if (options.dryRun) {
      console.log('📋 DRY RUN MODE - No files will be moved');
    }

    try {
      const supabase = getSupabaseClient();
      
      // 1. Ensure destination bucket exists
      const { data: destBucket, error: destError } = await supabase.storage.getBucket(options.destinationBucket);
      if (destError || !destBucket) {
        console.log(`📦 Creating destination bucket: ${options.destinationBucket}`);
        const { error: createError } = await supabase.storage.createBucket(options.destinationBucket, {
          public: true,
          allowedMimeTypes: ['image/*', 'video/*'],
          fileSizeLimit: 1073741824 // 1GB
        });
        if (createError) {
          result.errors.push(`Failed to create destination bucket: ${createError.message}`);
          return result;
        }
      }

      // 2. List all files in source bucket
      console.log(`📂 Listing files in source bucket: ${options.sourceBucket}`);
      const { data: files, error: listError } = await supabase.storage
        .from(options.sourceBucket)
        .list('', {
          limit: 1000,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (listError) {
        result.errors.push(`Failed to list files in source bucket: ${listError.message}`);
        return result;
      }

      if (!files || files.length === 0) {
        console.log('✅ No files found in source bucket');
        result.success = true;
        return result;
      }

      console.log(`📁 Found ${files.length} files to migrate`);

      // 3. Migrate files recursively
      for (const file of files) {
        await this.migrateFile(file.name, options, result);
        
        // If it's a folder, migrate its contents
        if (options.includeSubfolders && !file.name.includes('.')) {
          await this.migrateFolderContents(file.name, options, result);
        }
      }

      // 4. Update database references
      if (!options.dryRun) {
        console.log('🔄 Updating database references...');
        await this.updateDatabaseReferences(options.sourceBucket, options.destinationBucket);
      }

      result.success = result.errors.length === 0;
      console.log(`✅ Migration completed: ${result.migratedFiles} files migrated, ${result.errors.length} errors`);
      
    } catch (error) {
      result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ Migration failed:', error);
    }

    return result;
  }

  private async migrateFile(filePath: string, options: MigrationOptions, result: MigrationResult): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      // Skip if file already exists in destination
      const { data: existingFile } = await supabase.storage
        .from(options.destinationBucket)
        .list('', { search: filePath });

      if (existingFile && existingFile.length > 0) {
        result.skippedFiles.push(filePath);
        console.log(`⏭️  Skipping existing file: ${filePath}`);
        return;
      }

      if (options.dryRun) {
        console.log(`📋 Would migrate: ${filePath}`);
        result.migratedFiles++;
        return;
      }

      // Download from source
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(options.sourceBucket)
        .download(filePath);

      if (downloadError) {
        result.errors.push(`Failed to download ${filePath}: ${downloadError.message}`);
        return;
      }

      // Get file metadata
      const { data: metadata } = await supabase.storage
        .from(options.sourceBucket)
        .list('', { search: filePath });

      // Upload to destination
      const { error: uploadError } = await supabase.storage
        .from(options.destinationBucket)
        .upload(filePath, fileData, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        result.errors.push(`Failed to upload ${filePath}: ${uploadError.message}`);
        return;
      }

      // Delete from source if requested
      if (options.deleteFromSource) {
        const { error: deleteError } = await supabase.storage
          .from(options.sourceBucket)
          .remove([filePath]);

        if (deleteError) {
          result.errors.push(`Failed to delete ${filePath} from source: ${deleteError.message}`);
        }
      }

      result.migratedFiles++;
      result.totalSize += fileData.size;
      console.log(`✅ Migrated: ${filePath} (${(fileData.size / 1024 / 1024).toFixed(2)} MB)`);

    } catch (error) {
      result.errors.push(`Error migrating ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async migrateFolderContents(folderPath: string, options: MigrationOptions, result: MigrationResult): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const { data: folderFiles, error: listError } = await supabase.storage
        .from(options.sourceBucket)
        .list(folderPath);

      if (listError || !folderFiles) return;

      for (const file of folderFiles) {
        const fullPath = `${folderPath}/${file.name}`;
        await this.migrateFile(fullPath, options, result);
      }
    } catch (error) {
      result.errors.push(`Error migrating folder ${folderPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async updateDatabaseReferences(sourceBucket: string, destinationBucket: string): Promise<void> {
    try {
      const { clips, users, screenshots } = await import('@shared/schema');
      const { eq, like } = await import('drizzle-orm');
      
      // Update video clips
      const clipsResult = await db.select().from(clips);
      for (const clip of clipsResult) {
        let updates: any = {};
        
        if (clip.videoUrl?.includes(sourceBucket)) {
          updates.videoUrl = clip.videoUrl.replace(sourceBucket, destinationBucket);
        }
        if (clip.thumbnailUrl?.includes(sourceBucket)) {
          updates.thumbnailUrl = clip.thumbnailUrl.replace(sourceBucket, destinationBucket);
        }
        
        if (Object.keys(updates).length > 0) {
          await db.update(clips).set(updates).where(eq(clips.id, clip.id));
        }
      }

      // Update screenshots
      const screenshotsResult = await db.select().from(screenshots);
      for (const screenshot of screenshotsResult) {
        if (screenshot.imageUrl?.includes(sourceBucket)) {
          const updatedUrl = screenshot.imageUrl.replace(sourceBucket, destinationBucket);
          await db.update(screenshots).set({ imageUrl: updatedUrl }).where(eq(screenshots.id, screenshot.id));
        }
      }

      // Update user avatars and banners
      const usersResult = await db.select().from(users);
      for (const user of usersResult) {
        let updateData: any = {};
        
        if (user.profileImageUrl?.includes(sourceBucket)) {
          updateData.profileImageUrl = user.profileImageUrl.replace(sourceBucket, destinationBucket);
        }
        if (user.bannerUrl?.includes(sourceBucket)) {
          updateData.bannerUrl = user.bannerUrl.replace(sourceBucket, destinationBucket);
        }
        
        if (Object.keys(updateData).length > 0) {
          await db.update(users).set(updateData).where(eq(users.id, user.id));
        }
      }

      console.log('✅ Database references updated successfully');
    } catch (error) {
      console.error('❌ Failed to update database references:', error);
      throw error;
    }
  }

  async validateMigration(destinationBucket: string): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const supabase = getSupabaseClient();
      
      // Check if bucket exists
      const { data: bucket, error } = await supabase.storage.getBucket(destinationBucket);
      if (error || !bucket) {
        issues.push(`Destination bucket "${destinationBucket}" does not exist`);
        return { valid: false, issues };
      }

      const { clips, users, screenshots } = await import('@shared/schema');
      
      // Validate clip URLs
      const clipsResult = await db.select().from(clips);
      for (const clip of clipsResult) {
        if (clip.videoUrl && !clip.videoUrl.includes(destinationBucket)) {
          issues.push(`Clip ${clip.id} has invalid video URL: ${clip.videoUrl}`);
        }
        if (clip.thumbnailUrl && !clip.thumbnailUrl.includes(destinationBucket)) {
          issues.push(`Clip ${clip.id} has invalid thumbnail URL: ${clip.thumbnailUrl}`);
        }
      }

      // Validate screenshot URLs
      const screenshotsResult = await db.select().from(screenshots);
      for (const screenshot of screenshotsResult) {
        if (screenshot.imageUrl && !screenshot.imageUrl.includes(destinationBucket)) {
          issues.push(`Screenshot ${screenshot.id} has invalid image URL: ${screenshot.imageUrl}`);
        }
      }

      console.log(`✅ Migration validation completed: ${issues.length} issues found`);
      return { valid: issues.length === 0, issues };

    } catch (error) {
      issues.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, issues };
    }
  }
}

export default MediaBucketMigration;