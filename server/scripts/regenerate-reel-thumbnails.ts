import { db } from '../db';
import { clips } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { VideoProcessor } from '../video-processor';
import { supabaseStorage } from '../supabase-storage';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import fetch from 'node-fetch';

/**
 * Script to regenerate thumbnails for all existing reels with correct 9:16 aspect ratio
 * Run this once to fix thumbnails created before the aspect ratio fix
 */

async function downloadVideo(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`);
  }
  
  const fileStream = createWriteStream(outputPath);
  return new Promise((resolve, reject) => {
    if (!response.body) {
      reject(new Error('No response body'));
      return;
    }
    response.body.pipe(fileStream);
    response.body.on('error', reject);
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });
}

async function regenerateReelThumbnails() {
  try {
    console.log('🎬 Starting reel thumbnail regeneration...');
    
    // Query all reels from the database
    const reels = await db
      .select()
      .from(clips)
      .where(eq(clips.videoType, 'reel'));
    
    console.log(`📊 Found ${reels.length} reels to process`);
    
    if (reels.length === 0) {
      console.log('✅ No reels found. Nothing to do.');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const tempDir = path.join(process.cwd(), 'temp');
    
    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });

    for (const reel of reels) {
      try {
        console.log(`\n🔄 Processing reel #${reel.id}: "${reel.title}"`);
        
        // Skip if no video URL
        if (!reel.videoUrl) {
          console.log(`⚠️  Skipping reel #${reel.id}: No video URL`);
          errorCount++;
          continue;
        }

        // Download the video temporarily
        const tempVideoPath = path.join(tempDir, `reel_${reel.id}.mp4`);
        console.log(`📥 Downloading video from: ${reel.videoUrl}`);
        await downloadVideo(reel.videoUrl, tempVideoPath);
        
        // Generate new thumbnail with correct aspect ratio (9:16)
        console.log(`🖼️  Generating new 9:16 thumbnail...`);
        const newThumbnailUrl = await VideoProcessor.generateAutoThumbnail(
          tempVideoPath,
          reel.userId,
          `reel_thumb_${reel.id}`,
          'reel' // This ensures 9:16 aspect ratio
        );
        
        // Update the database with new thumbnail URL
        await db
          .update(clips)
          .set({ thumbnailUrl: newThumbnailUrl })
          .where(eq(clips.id, reel.id));
        
        // Clean up temp video file
        await fs.unlink(tempVideoPath);
        
        console.log(`✅ Successfully regenerated thumbnail for reel #${reel.id}`);
        console.log(`   Old thumbnail: ${reel.thumbnailUrl}`);
        console.log(`   New thumbnail: ${newThumbnailUrl}`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Error processing reel #${reel.id}:`, error);
        errorCount++;
        
        // Try to clean up temp file even on error
        try {
          const tempVideoPath = path.join(tempDir, `reel_${reel.id}.mp4`);
          await fs.unlink(tempVideoPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
    }

    console.log('\n📈 Summary:');
    console.log(`   Total reels: ${reels.length}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log('\n🎉 Reel thumbnail regeneration complete!');
    
  } catch (error) {
    console.error('❌ Fatal error during thumbnail regeneration:', error);
    throw error;
  }
}

// Run the script if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  regenerateReelThumbnails()
    .then(() => {
      console.log('\n✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { regenerateReelThumbnails };
