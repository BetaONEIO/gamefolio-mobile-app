import { db } from '../db';
import { clips } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';
import { VideoProcessor } from '../video-processor';
import path from 'path';
import fs from 'fs/promises';

async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function downloadVideo(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
}

async function regenerateThumbnails() {
  console.log('🎬 Checking and regenerating thumbnails for all accessible videos...\n');
  
  // Get most recent clips first
  const allClips = await db.select().from(clips).orderBy(desc(clips.createdAt)).limit(100);
  console.log(`📊 Checking ${allClips.length} most recent clips\n`);
  
  const tempDir = path.join(process.cwd(), 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  
  let processed = 0, skipped = 0, valid = 0, errors = 0;
  
  for (const clip of allClips) {
    if (!clip.videoUrl) {
      skipped++;
      continue;
    }
    
    // Check if video exists
    const videoExists = await checkUrlExists(clip.videoUrl);
    if (!videoExists) {
      console.log(`⏭️  #${clip.id}: Video not accessible`);
      skipped++;
      continue;
    }
    
    // Check if thumbnail already exists and is valid
    if (clip.thumbnailUrl) {
      const thumbExists = await checkUrlExists(clip.thumbnailUrl);
      if (thumbExists) {
        console.log(`✅ #${clip.id}: Already has valid thumbnail`);
        valid++;
        continue;
      }
    }
    
    try {
      console.log(`🔄 #${clip.id}: Regenerating thumbnail for "${clip.title}"...`);
      const tempPath = path.join(tempDir, `clip_${clip.id}_${Date.now()}.mp4`);
      await downloadVideo(clip.videoUrl, tempPath);
      
      const thumbUrl = await VideoProcessor.generateAutoThumbnail(
        tempPath,
        clip.userId,
        `thumb_${clip.id}`,
        (clip.videoType as 'clip' | 'reel') || 'clip'
      );
      
      if (thumbUrl) {
        await db.update(clips).set({ thumbnailUrl: thumbUrl }).where(eq(clips.id, clip.id));
        console.log(`   ✅ Generated: ${thumbUrl.split('/').pop()}`);
        processed++;
      }
      
      await fs.unlink(tempPath).catch(() => {});
    } catch (err: any) {
      console.log(`   ❌ Failed: ${err.message}`);
      errors++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Already valid: ${valid}`);
  console.log(`   🔄 Regenerated: ${processed}`);
  console.log(`   ⏭️  Skipped (no video): ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
}

regenerateThumbnails().catch(console.error);
