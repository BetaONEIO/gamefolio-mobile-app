import { db } from '../db';
import { clips } from '@shared/schema';
import { isNotNull, and, ne, eq } from 'drizzle-orm';
import { VideoProcessor } from '../video-processor';
import path from 'path';
import fs from 'fs/promises';

async function downloadVideo(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
}

async function regenerateInvalidThumbnails() {
  console.log('Checking for clips with invalid thumbnail URLs...\n');
  
  const clipsWithThumbnails = await db
    .select({ id: clips.id, title: clips.title, thumbnailUrl: clips.thumbnailUrl, userId: clips.userId, videoUrl: clips.videoUrl, videoType: clips.videoType })
    .from(clips)
    .where(and(isNotNull(clips.thumbnailUrl), ne(clips.thumbnailUrl, '')));
  
  console.log(`Found ${clipsWithThumbnails.length} clips with thumbnail URLs\n`);
  
  const invalidClips = [];
  
  for (const clip of clipsWithThumbnails) {
    if (!clip.thumbnailUrl) continue;
    
    try {
      const response = await fetch(clip.thumbnailUrl, { method: 'HEAD' });
      if (!response.ok) {
        console.log(`❌ Clip #${clip.id}: ${clip.title} - Status ${response.status}`);
        invalidClips.push(clip);
      }
    } catch (error) {
      console.log(`❌ Clip #${clip.id}: ${clip.title} - Error`);
      invalidClips.push(clip);
    }
  }
  
  console.log(`\n📊 Found ${invalidClips.length} clips with invalid thumbnails\n`);
  
  if (invalidClips.length === 0) {
    console.log('✅ All clips have valid thumbnails!');
    process.exit(0);
  }
  
  const tempDir = path.join(process.cwd(), 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const clip of invalidClips) {
    console.log(`\n🔄 Regenerating thumbnail for clip #${clip.id}: ${clip.title}`);
    
    if (!clip.videoUrl) {
      console.log(`  ⚠️ No video URL, skipping`);
      errorCount++;
      continue;
    }
    
    try {
      const tempVideoPath = path.join(tempDir, `repair_${clip.id}_${Date.now()}.mp4`);
      await downloadVideo(clip.videoUrl, tempVideoPath);
      
      const videoType = clip.videoType || 'clip';
      const newThumbnailUrl = await VideoProcessor.generateAutoThumbnail(
        tempVideoPath,
        clip.userId,
        `repair_thumb_${clip.id}`,
        videoType as 'clip' | 'reel'
      );
      
      await db.update(clips).set({ thumbnailUrl: newThumbnailUrl }).where(eq(clips.id, clip.id));
      
      await fs.unlink(tempVideoPath).catch(() => {});
      console.log(`  ✅ Success!`);
      successCount++;
    } catch (error) {
      console.log(`  ❌ Failed:`, error);
      errorCount++;
    }
  }
  
  console.log(`\n✅ Repaired: ${successCount}, ❌ Failed: ${errorCount}`);
  process.exit(0);
}

regenerateInvalidThumbnails();
