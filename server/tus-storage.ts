import { FileStore } from '@tus/file-store';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

export class SupabaseTusStore extends FileStore {
  private supabase;
  private bucketName: string;

  constructor() {
    const tempDir = path.join(process.cwd(), 'temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Call parent constructor with temp directory
    super({ directory: tempDir });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_ANON_KEY');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
    
    this.bucketName = 'gamefolio-media';
  }



  async finishUpload(id: string, userId: number, uploadType: 'video' | 'reel'): Promise<{ url: string; path: string }> {
    // Get upload info from FileStore
    const upload = await this.getUpload(id);
    if (!upload) {
      throw new Error('Upload not found');
    }

    // Read the uploaded file
    const tempPath = path.join((this as any).configstore.directory, id);
    if (!fs.existsSync(tempPath)) {
      throw new Error('Upload file not found');
    }

    const fileBuffer = fs.readFileSync(tempPath);
    
    // Generate filename
    const timestamp = Date.now();
    const randomId = randomBytes(8).toString('hex');
    const extension = this.getExtensionFromMetadata(upload);
    const prefix = uploadType === 'video' ? 'videos' : 'reels';
    const filename = `${prefix}/${timestamp}-${randomId}${extension}`;
    const filePath = `users/${userId}/${filename}`;
    
    // Upload to Supabase
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filePath, fileBuffer, {
        contentType: upload.metadata?.filetype || 'video/mp4',
        cacheControl: '31536000', // 1 year
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    // Clean up temp files
    await this.remove(id);

    return {
      url: publicUrl,
      path: filePath
    };
  }

  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  private getExtensionFromMetadata(upload: any): string {
    if (upload.metadata?.filename) {
      return path.extname(upload.metadata.filename);
    }
    if (upload.metadata?.filetype) {
      // Map MIME types to extensions
      const mimeToExt: { [key: string]: string } = {
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'video/quicktime': '.mov',
        'video/x-msvideo': '.avi',
        'video/x-ms-wmv': '.wmv'
      };
      return mimeToExt[upload.metadata.filetype] || '.mp4';
    }
    return '.mp4';
  }
}

export const supabaseTusStore = new SupabaseTusStore();