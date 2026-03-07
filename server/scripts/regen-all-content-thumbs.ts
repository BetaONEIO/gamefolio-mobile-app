import { db } from '../db';
import { clips, screenshots } from '@shared/schema';
import { desc, eq, isNull, or, sql } from 'drizzle-orm';
import { VideoProcessor } from '../video-processor';
import { supabaseStorage } from '../supabase-storage';
import path from 'path';
import fs from 'fs/promises';

function extractStoragePath(url: string): string | null {
  const match = url.match(/gamefolio-media\/(.+)$/);
  return match ? match[1] : null;
}

async function checkFileExists(url: string): Promise<boolean> {
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

async function downloadViaSupabase(url: string, outputPath: string): Promise<boolean> {
  const storagePath = extractStoragePath(url);
  if (!storagePath) return false;
  
  try {
    const { data, error } = await supabaseStorage.supabase.storage
      .from('gamefolio-media')
      .download(storagePath);
    
    if (error || !data) return false;
    
    const buffer = Buffer.from(await data.arrayBuffer());
    await fs.writeFile(outputPath, buffer);
    return true;
  } catch {
    return false;
  }
}

async function processAllClips() {
  console.log('🎬 Processing ALL clips and reels...\n');
  
  const allClips = await db.select().from(clips).orderBy(desc(clips.createdAt));
  console.log(`📊 Total clips/reels: ${allClips.length}\n`);
  
  const tempDir = path.join(process.cwd(), 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  
  let valid = 0, regenerated = 0, noVideo = 0, errors = 0;
  
  for (const clip of allClips) {
    if (!clip.videoUrl) {
      noVideo++;
      continue;
    }
    
    // Check if thumbnail exists
    if (clip.thumbnailUrl) {
      const thumbExists = await checkFileExists(clip.thumbnailUrl);
      if (thumbExists) {
        valid++;
        continue;
      }
    }
    
    // Need to regenerate
    console.log(`🔄 #${clip.id}: Regenerating thumbnail...`);
    const tempPath = path.join(tempDir, `clip_${clip.id}_${Date.now()}.mp4`);
    
    const downloaded = await downloadViaSupabase(clip.videoUrl, tempPath);
    if (!downloaded) {
      console.log(`   ⏭️  Video file not found`);
      noVideo++;
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
        console.log(`   ✅ Generated`);
        regenerated++;
      }
      await fs.unlink(tempPath).catch(() => {});
    } catch (err: any) {
      console.log(`   ❌ Error: ${err.message}`);
      errors++;
      await fs.unlink(tempPath).catch(() => {});
    }
  }
  
  console.log(`\n📊 Clips Summary:`);
  console.log(`   ✅ Valid: ${valid}`);
  console.log(`   🔄 Regenerated: ${regenerated}`);
  console.log(`   ⏭️  No video: ${noVideo}`);
  console.log(`   ❌ Errors: ${errors}`);
  
  return { valid, regenerated, noVideo, errors };
}

async function processScreenshots() {
  console.log('\n\n📸 Processing screenshots...\n');
  
  const allScreenshots = await db.select().from(screenshots);
  console.log(`📊 Total screenshots: ${allScreenshots.length}\n`);
  
  let valid = 0, missing = 0;
  
  for (const ss of allScreenshots) {
    if (ss.imageUrl) {
      const exists = await checkFileExists(ss.imageUrl);
      if (exists) {
        valid++;
      } else {
        console.log(`❌ #${ss.id}: Image missing - ${ss.title}`);
        missing++;
      }
    } else {
      missing++;
    }
  }
  
  console.log(`\n📊 Screenshots Summary:`);
  console.log(`   ✅ Valid: ${valid}`);
  console.log(`   ❌ Missing: ${missing}`);
}

async function main() {
  await processAllClips();
  await processScreenshots();
  console.log('\n✅ Complete!');
}

main().catch(console.error);
