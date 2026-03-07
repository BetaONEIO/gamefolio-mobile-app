import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

// Configure FFmpeg with static binary
ffmpeg.setFfmpegPath(ffmpegStatic!);

export class VideoThumbnailService {
  private static readonly THUMBNAILS_DIR = path.join(process.cwd(), 'uploads', 'thumbnails');

  static async ensureThumbnailsDirectory(): Promise<void> {
    try {
      await fs.access(this.THUMBNAILS_DIR);
    } catch {
      await fs.mkdir(this.THUMBNAILS_DIR, { recursive: true });
    }
  }

  static async generateThumbnail(videoPath: string, clipId: number): Promise<string> {
    await this.ensureThumbnailsDirectory();
    
    const thumbnailPath = path.join(this.THUMBNAILS_DIR, `${clipId}.jpg`);
    
    return new Promise((resolve, reject) => {
      console.log(`Generating thumbnail for clip ${clipId} from video: ${videoPath}`);
      
      ffmpeg(videoPath)
        .seekInput(1) // Seek to 1 second into the video
        .frames(1)
        .size('320x180') // 16:9 aspect ratio thumbnail
        .output(thumbnailPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command: ' + commandLine);
        })
        .on('end', async () => {
          try {
            console.log(`Thumbnail generated successfully at: ${thumbnailPath}`);
            
            // Check if file exists before trying to optimize
            try {
              await fs.access(thumbnailPath);
            } catch {
              throw new Error('Thumbnail file was not created');
            }
            
            // Optimize the thumbnail with sharp (optional - skip if it fails)
            try {
              const optimizedPath = thumbnailPath.replace('.jpg', '_optimized.jpg');
              await sharp(thumbnailPath, { failOn: 'none' })
                .jpeg({ quality: 80, progressive: true })
                .toFile(optimizedPath);
              
              // Replace original with optimized version
              await fs.unlink(thumbnailPath);
              await fs.rename(optimizedPath, thumbnailPath);
              console.log('Thumbnail optimized with Sharp');
            } catch (sharpError) {
              console.log('Sharp optimization failed, using original thumbnail:', sharpError);
              // Continue with the original thumbnail
            }
            
            resolve(thumbnailPath);
          } catch (error) {
            console.error('Error in thumbnail post-processing:', error);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('FFmpeg error generating thumbnail:', error);
          reject(error);
        })
        .run();
    });
  }

  static async getThumbnailPath(clipId: number): Promise<string | null> {
    const thumbnailPath = path.join(this.THUMBNAILS_DIR, `${clipId}.jpg`);
    
    try {
      await fs.access(thumbnailPath);
      return thumbnailPath;
    } catch {
      return null;
    }
  }

  static async deleteThumbnail(clipId: number): Promise<void> {
    const thumbnailPath = path.join(this.THUMBNAILS_DIR, `${clipId}.jpg`);
    
    try {
      await fs.unlink(thumbnailPath);
    } catch {
      // Thumbnail doesn't exist, which is fine
    }
  }
}