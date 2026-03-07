
import fs from 'fs';
import path from 'path';
import { supabaseStorage } from './supabase-storage';

interface MigrationStats {
  totalFiles: number;
  migratedFiles: number;
  failedFiles: number;
  totalSize: number;
  errors: string[];
}

export class LocalToSupabaseMigration {
  private stats: MigrationStats = {
    totalFiles: 0,
    migratedFiles: 0,
    failedFiles: 0,
    totalSize: 0,
    errors: []
  };

  async migrateAttachedAssets(): Promise<MigrationStats> {
    const attachedAssetsDir = path.join(process.cwd(), 'attached_assets');
    
    console.log('🚀 Starting migration of attached_assets to Supabase...');
    
    if (!fs.existsSync(attachedAssetsDir)) {
      console.log('📁 No attached_assets directory found');
      return this.stats;
    }

    const files = fs.readdirSync(attachedAssetsDir);
    this.stats.totalFiles = files.length;
    
    console.log(`📊 Found ${files.length} files to migrate`);

    for (const file of files) {
      const filePath = path.join(attachedAssetsDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile()) {
        await this.migrateFile(filePath, file);
      }
    }

    console.log('✅ Migration completed!');
    console.log(`📈 Stats: ${this.stats.migratedFiles}/${this.stats.totalFiles} files migrated`);
    console.log(`📦 Total size: ${(this.stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    if (this.stats.errors.length > 0) {
      console.log('❌ Errors encountered:');
      this.stats.errors.forEach(error => console.log(`   - ${error}`));
    }

    return this.stats;
  }

  private async migrateFile(filePath: string, fileName: string): Promise<void> {
    try {
      const fileStats = fs.statSync(filePath);
      this.stats.totalSize += fileStats.size;
      
      // Skip very large files or non-media files
      if (fileStats.size > 100 * 1024 * 1024) { // 100MB limit
        console.log(`⏭️  Skipping large file: ${fileName} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`);
        return;
      }

      // Determine file type
      const ext = path.extname(fileName).toLowerCase();
      const isVideo = ['.mp4', '.mov', '.avi', '.webm'].includes(ext);
      const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      
      if (!isVideo && !isImage) {
        console.log(`⏭️  Skipping non-media file: ${fileName}`);
        return;
      }

      const fileType = isVideo ? 'video' : 'image';
      const contentType = isVideo ? 'video/mp4' : `image/${ext.slice(1)}`;
      
      // Use a default user ID for migration (you can adjust this)
      const defaultUserId = 1;
      
      console.log(`📤 Migrating: ${fileName} (${fileType})`);
      
      const result = await supabaseStorage.migrateLocalFile(
        filePath,
        fileName,
        contentType,
        fileType as 'video' | 'image' | 'thumbnail',
        defaultUserId
      );
      
      console.log(`✅ Migrated: ${fileName} -> ${result.url}`);
      this.stats.migratedFiles++;
      
    } catch (error) {
      this.stats.failedFiles++;
      const errorMsg = `Failed to migrate ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.stats.errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }
  }

  async cleanupLocalFiles(): Promise<void> {
    const attachedAssetsDir = path.join(process.cwd(), 'attached_assets');
    
    console.log('🧹 Starting cleanup of local files...');
    
    if (!fs.existsSync(attachedAssetsDir)) {
      console.log('📁 No attached_assets directory found');
      return;
    }

    const files = fs.readdirSync(attachedAssetsDir);
    let cleanedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(attachedAssetsDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        const isMedia = ['.mp4', '.mov', '.avi', '.webm', '.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
        
        if (isMedia) {
          try {
            fs.unlinkSync(filePath);
            console.log(`🗑️  Deleted: ${file}`);
            cleanedCount++;
          } catch (error) {
            console.error(`❌ Failed to delete ${file}:`, error);
          }
        }
      }
    }
    
    console.log(`✅ Cleanup completed: ${cleanedCount} files removed`);
  }
}

// Export function to run migration
export async function runMigration(cleanup: boolean = false): Promise<void> {
  const migration = new LocalToSupabaseMigration();
  
  try {
    // First check if Supabase storage is available
    const bucketExists = await supabaseStorage.checkBucket();
    if (!bucketExists) {
      throw new Error('Supabase bucket not available. Please ensure it exists and is properly configured.');
    }
    
    // Run migration
    const stats = await migration.migrateAttachedAssets();
    
    if (cleanup && stats.migratedFiles > 0) {
      console.log('⚠️  Starting local file cleanup...');
      await migration.cleanupLocalFiles();
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
