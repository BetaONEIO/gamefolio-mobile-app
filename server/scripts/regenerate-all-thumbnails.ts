import { db } from '../db';
import { clips } from '@shared/schema';
import { eq, or, isNull, sql } from 'drizzle-orm';
import { VideoProcessor } from '../video-processor';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';

async function downloadVideo(url: string, outputPath: string): Promise<void> {
  console.log(`  📥 Downloading from: ${url.substring(0, 80)}...`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(outputPath, buffer);
  
  const stats = await fs.stat(outputPath);
  console.log(`  📦 Downloaded ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
}

async function regenerateAllMissingThumbnails() {
  try {
    console.log('🎬 Starting thumbnail regeneration for all clips/reels with missing thumbnails...\n');
    
    const clipsWithMissingThumbnails = await db
      .select()
      .from(clips)
      .where(
        or(
          isNull(clips.thumbnailUrl),
          eq(clips.thumbnailUrl, ''),
          sql`${clips.thumbnailUrl} = 'null'`
        )
      );
    
    console.log(`📊 Found ${clipsWithMissingThumbnails.length} clips/reels with missing thumbnails\n`);
    
    if (clipsWithMissingThumbnails.length === 0) {
      console.log('✅ All clips/reels already have thumbnails. Nothing to do.');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const tempDir = path.join(process.cwd(), 'temp');
    
    await fs.mkdir(tempDir, { recursive: true });

    for (const clip of clipsWithMissingThumbnails) {
      try {
        const videoType = clip.videoType || 'clip';
        console.log(`\n🔄 Processing ${videoType} #${clip.id}: "${clip.title}"`);
        
        if (!clip.videoUrl) {
          console.log(`  ⚠️  Skipping: No video URL`);
          errorCount++;
          continue;
        }

        const tempVideoPath = path.join(tempDir, `${videoType}_${clip.id}_${Date.now()}.mp4`);
        
        try {
          await downloadVideo(clip.videoUrl, tempVideoPath);
        } catch (downloadError) {
          console.error(`  ❌ Download failed:`, downloadError);
          errorCount++;
          continue;
        }
        
        console.log(`  🖼️  Generating thumbnail (${videoType === 'reel' ? '9:16' : '16:9'})...`);
        const newThumbnailUrl = await VideoProcessor.generateAutoThumbnail(
          tempVideoPath,
          clip.userId,
          `${videoType}_thumb_${clip.id}`,
          videoType as 'clip' | 'reel'
        );
        
        await db
          .update(clips)
          .set({ thumbnailUrl: newThumbnailUrl })
          .where(eq(clips.id, clip.id));
        
        try {
          await fs.unlink(tempVideoPath);
        } catch (cleanupError) {
        }
        
        console.log(`  ✅ Success! Thumbnail: ${newThumbnailUrl.substring(0, 60)}...`);
        successCount++;
        
      } catch (error) {
        console.error(`  ❌ Error processing ${clip.videoType || 'clip'} #${clip.id}:`, error);
        errorCount++;
        
        try {
          const tempVideoPath = path.join(tempDir, `${clip.videoType || 'clip'}_${clip.id}_*.mp4`);
          const files = await fs.readdir(tempDir);
          for (const file of files) {
            if (file.startsWith(`${clip.videoType || 'clip'}_${clip.id}_`)) {
              await fs.unlink(path.join(tempDir, file));
            }
          }
        } catch (cleanupError) {
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📈 SUMMARY');
    console.log('='.repeat(50));
    console.log(`   Total processed: ${clipsWithMissingThumbnails.length}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log('='.repeat(50));
    console.log('\n🎉 Thumbnail regeneration complete!');
    
  } catch (error) {
    console.error('❌ Fatal error during thumbnail regeneration:', error);
    throw error;
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  regenerateAllMissingThumbnails()
    .then(() => {
      console.log('\n✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { regenerateAllMissingThumbnails };
