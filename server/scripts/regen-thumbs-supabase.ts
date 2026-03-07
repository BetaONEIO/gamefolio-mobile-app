import { db } from '../db';
import { clips } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';
import { VideoProcessor } from '../video-processor';
import { supabaseStorage } from '../supabase-storage';
import path from 'path';
import fs from 'fs/promises';

// Extract storage path from full URL
function extractStoragePath(url: string): string | null {
  const match = url.match(/gamefolio-media\/(.+)$/);
  return match ? match[1] : null;
}

async function downloadViaSupabase(url: string, outputPath: string): Promise<boolean> {
  const storagePath = extractStoragePath(url);
  if (!storagePath) return false;
  
  try {
    const { data, error } = await supabaseStorage.supabase.storage
      .from('gamefolio-media')
      .download(storagePath);
    
    if (error || !data) {
      console.log(`   ❌ Download error: ${error?.message || 'No data'}`);
      return false;
    }
    
    const buffer = Buffer.from(await data.arrayBuffer());
    await fs.writeFile(outputPath, buffer);
    console.log(`   📦 Downloaded ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);
    return true;
  } catch (err: any) {
    console.log(`   ❌ Exception: ${err.message}`);
    return false;
  }
}

async function checkThumbnailExists(url: string): Promise<boolean> {
  const storagePath = extractStoragePath(url);
  if (!storagePath) return false;
  
  try {
    const { data, error } = await supabaseStorage.supabase.storage
      .from('gamefolio-media')
      .download(storagePath);
    return !error && data !== null;
  } catch {
    return false;
  }
}

async function regenerateThumbnails() {
  console.log('🎬 Regenerating thumbnails using Supabase client...\n');
  
  const allClips = await db.select().from(clips).orderBy(desc(clips.createdAt)).limit(50);
  console.log(`📊 Processing ${allClips.length} most recent clips\n`);
  
  const tempDir = path.join(process.cwd(), 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  
  let processed = 0, skipped = 0, valid = 0, errors = 0;
  
  for (const clip of allClips) {
    if (!clip.videoUrl) {
      skipped++;
      continue;
    }
    
    // Check if thumbnail already exists
    if (clip.thumbnailUrl) {
      const thumbExists = await checkThumbnailExists(clip.thumbnailUrl);
      if (thumbExists) {
        console.log(`✅ #${clip.id}: Valid thumbnail exists`);
        valid++;
        continue;
      }
    }
    
    console.log(`🔄 #${clip.id}: "${clip.title}" - downloading video...`);
    const tempPath = path.join(tempDir, `clip_${clip.id}_${Date.now()}.mp4`);
    
    const downloaded = await downloadViaSupabase(clip.videoUrl, tempPath);
    if (!downloaded) {
      console.log(`   ⏭️  Video not accessible`);
      skipped++;
      continue;
    }
    
    try {
      const thumbUrl = await VideoProcessor.generateAutoThumbnail(
        tempPath,
        clip.userId,
        `thumb_${clip.id}`,
        (clip.videoType as 'clip' | 'reel') || 'clip'
      );
      
      if (thumbUrl) {
        await db.update(clips).set({ thumbnailUrl: thumbUrl }).where(eq(clips.id, clip.id));
        console.log(`   ✅ Generated thumbnail`);
        processed++;
      }
      
      await fs.unlink(tempPath).catch(() => {});
    } catch (err: any) {
      console.log(`   ❌ Generation failed: ${err.message}`);
      errors++;
      await fs.unlink(tempPath).catch(() => {});
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Already valid: ${valid}`);
  console.log(`   🔄 Regenerated: ${processed}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
}

regenerateThumbnails().catch(console.error);
