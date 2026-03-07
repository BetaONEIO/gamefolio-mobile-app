import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

export class SupabaseStorage {
  private supabase;
  private supabaseAdmin;
  private bucketName: string;
  private allowedBuckets: string[];
  private disallowedBuckets: string[];
  private strictMode: boolean;
  private preventLocalStorageFallback: boolean;

  constructor() {
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

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        }
      );
      console.log('🔑 Supabase admin client initialized with service role key');
    } else {
      this.supabaseAdmin = this.supabase;
      console.warn('⚠️  No SUPABASE_SERVICE_ROLE_KEY found - admin operations will use anon key');
    }

    // Enforce strict Supabase-only storage rules
    this.bucketName = 'gamefolio-media';
    this.allowedBuckets = ['gamefolio-media', 'gamefolio-assets', 'gamefolio-name-tags', 'gamefolio-profile-borders', 'gamefolio-backgrounds'];
    this.disallowedBuckets = ['gamefoliowebappmediacontent', 'gamefolio-media-v2'];
    this.strictMode = true;
    this.preventLocalStorageFallback = true;

    console.log('🔒 Supabase storage initialized in strict mode - local storage fallback disabled');

    // Verify bucket exists on initialization (non-blocking)
    this.checkBucket().then(exists => {
      if (!exists) {
        console.error(`⚠️  Supabase bucket '${this.bucketName}' validation failed - but continuing startup`);
        console.error('This may cause issues with file uploads. Please ensure the bucket exists.');
      }
    }).catch(error => {
      console.error('⚠️  Bucket validation failed:', error.message);
      console.error('Continuing startup - file operations may fail if bucket doesn\'t exist');
    });
  }

  async listAllBuckets(): Promise<{ id: string; name: string; public: boolean; createdAt: string }[]> {
    try {
      const { data, error } = await this.supabaseAdmin.storage.listBuckets();
      if (error) {
        console.error('Error listing buckets:', error.message);
        return [];
      }
      return (data || [])
        .filter(b => !this.disallowedBuckets.includes(b.name))
        .map(b => ({
          id: b.id,
          name: b.name,
          public: b.public,
          createdAt: b.created_at,
        }));
    } catch (error) {
      console.error('Error listing all buckets:', error);
      return [];
    }
  }

  /**
   * Enforce bucket usage rules
   */
  private validateBucketAccess(bucketName: string): void {
    if (this.strictMode) {
      if (!this.allowedBuckets.includes(bucketName)) {
        throw new Error(`Access denied: Bucket "${bucketName}" is not in the allowed list: ${this.allowedBuckets.join(', ')}`);
      }

      if (this.disallowedBuckets.includes(bucketName)) {
        throw new Error(`Access denied: Bucket "${bucketName}" is explicitly disallowed`);
      }
    }
  }

  /**
   * Prevent local storage fallback
   */
  private preventLocalStorage(): void {
    if (this.preventLocalStorageFallback) {
      throw new Error('Local storage fallback is disabled. All media must use Supabase storage exclusively.');
    }
  }

  /**
   * Sanitize folder path to prevent path traversal attacks
   * Removes dangerous patterns like .., leading slashes, and normalizes the path
   */
  private sanitizeFolderPath(folderPath: string): string {
    if (!folderPath) return '';
    
    // Remove path traversal patterns
    let sanitized = folderPath
      .replace(/\.\./g, '')  // Remove .. sequences
      .replace(/^\/+/, '')   // Remove leading slashes
      .replace(/\/+/g, '/')  // Normalize multiple slashes
      .replace(/\/+$/, '');  // Remove trailing slashes
    
    // Split and filter out empty segments and hidden folders
    const segments = sanitized.split('/').filter(segment => 
      segment && 
      segment !== '.' && 
      !segment.startsWith('.')
    );
    
    return segments.join('/');
  }

  /**
   * Check if storage bucket exists and provide helpful error if not
   */
  async checkBucket() {
    this.validateBucketAccess(this.bucketName);

    try {
      // Use list operation instead of getBucket as it's more reliable
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list('', { limit: 1 });

      if (error && (error.message.includes('not found') || error.message.includes('Bucket not found'))) {
        console.error(`Supabase storage bucket '${this.bucketName}' not found.`);
        console.error('Please create the bucket manually in your Supabase dashboard:');
        console.error('1. Go to Storage in your Supabase dashboard');
        console.error('2. Click "Create bucket"');
        console.error(`3. Name it '${this.bucketName}'`);
        console.error('4. Set it to public');
        console.error('5. Allow image/* and video/* file types');
        return false;
      } else if (error) {
        console.error('Error checking bucket:', error);
        return false;
      }

      console.log(`✅ Supabase bucket '${this.bucketName}' is accessible`);
      return true;
    } catch (error) {
      console.error('Error checking Supabase storage:', error);
      return false;
    }
  }

  /**
   * Generate a unique filename with proper extension
   */
  private generateFilename(originalName: string, type: 'video' | 'image' | 'thumbnail'): string {
    const timestamp = Date.now();
    const randomId = randomBytes(8).toString('hex');
    const extension = path.extname(originalName);
    const prefix = type === 'video' ? 'videos' : type === 'thumbnail' ? 'thumbnails' : 'images';

    return `${prefix}/${timestamp}-${randomId}${extension}`;
  }

  /**
   * Upload a file to Supabase storage
   */
  async uploadFile(
    file: Express.Multer.File, 
    type: 'video' | 'image' | 'thumbnail',
    userId: number
  ): Promise<{ url: string; path: string }> {
    try {
      const filename = this.generateFilename(file.originalname, type);
      const filePath = `users/${userId}/${filename}`;

      // Read file buffer
      const fileBuffer = await readFile(file.path);

      // Upload to Supabase
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, fileBuffer, {
          contentType: file.mimetype,
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

      return {
        url: publicUrl,
        path: filePath
      };
    } catch (error) {
      console.error('Error uploading file to Supabase:', error);
      throw error;
    }
  }

  /**
   * Upload a buffer directly to Supabase storage
   */
  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    contentType: string,
    type: 'video' | 'image' | 'thumbnail',
    userId: number
  ): Promise<{ url: string; path: string }> {
    try {
      const generatedFilename = this.generateFilename(filename, type);
      const filePath = `users/${userId}/${generatedFilename}`;

      // Upload to Supabase
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, buffer, {
          contentType,
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

      return {
        url: publicUrl,
        path: filePath
      };
    } catch (error) {
      console.error('Error uploading buffer to Supabase:', error);
      throw error;
    }
  }

  /**
   * Get signed URL for direct client-side upload to Supabase
   */
  async getSignedUploadUrl(filePath: string, contentType: string): Promise<{ uploadUrl: string; publicUrl: string }> {
    try {
      this.validateBucketAccess(this.bucketName);
      
      // Create a signed upload URL
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUploadUrl(filePath);
      
      if (error) {
        console.error('Error creating signed upload URL:', error);
        throw error;
      }
      
      // Get the public URL for this file
      const { data: { publicUrl } } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);
      
      return {
        uploadUrl: data.signedUrl,
        publicUrl: publicUrl
      };
    } catch (error) {
      console.error('Error generating signed upload URL:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Supabase storage
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.error('Error deleting file from Supabase:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting file from Supabase:', error);
      return false;
    }
  }

  /**
   * Get file URL from Supabase storage
   */
  getFileUrl(filePath: string): string {
    const { data: { publicUrl } } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    return publicUrl;
  }

  /**
   * Move file from local storage to Supabase storage
   */
  async migrateLocalFile(
    localFilePath: string,
    filename: string,
    contentType: string,
    type: 'video' | 'image' | 'thumbnail',
    userId: number
  ): Promise<{ url: string; path: string }> {
    try {
      // Read local file
      const fileBuffer = await readFile(localFilePath);

      // Upload to Supabase
      const result = await this.uploadBuffer(fileBuffer, filename, contentType, type, userId);

      // Optionally delete local file after successful upload
      try {
        fs.unlinkSync(localFilePath);
      } catch (deleteError) {
        console.warn('Could not delete local file after migration:', deleteError);
      }

      return result;
    } catch (error) {
      console.error('Error migrating local file to Supabase:', error);
      throw error;
    }
  }

  /**
   * Check if a file exists in Supabase storage
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(path.dirname(filePath), {
          search: path.basename(filePath)
        });

      if (error) {
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage stats for a user
   */
  async getUserStorageStats(userId: number): Promise<{
    totalFiles: number;
    totalSize: number;
    videoFiles: number;
    imageFiles: number;
  }> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(`users/${userId}`, {
          limit: 1000
        });

      if (error) {
        console.error('Error getting user storage stats:', error);
        return { totalFiles: 0, totalSize: 0, videoFiles: 0, imageFiles: 0 };
      }

      const stats = {
        totalFiles: data.length,
        totalSize: data.reduce((sum, file) => sum + (file.metadata?.size || 0), 0),
        videoFiles: data.filter(file => file.metadata?.mimetype?.startsWith('video/')).length,
        imageFiles: data.filter(file => file.metadata?.mimetype?.startsWith('image/')).length
      };

      return stats;
    } catch (error) {
      console.error('Error calculating user storage stats:', error);
      return { totalFiles: 0, totalSize: 0, videoFiles: 0, imageFiles: 0 };
    }
  }

  /**
   * Generate a signed URL for accessing private bucket content
   * @param storagePath - The path within the bucket (e.g., 'users/16/thumbnails/xxx.jpg')
   * @param expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns Signed URL or null if generation fails
   */
  async getSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      // Check if file is a GIF - need to bypass image transformation to preserve animation
      const isGif = storagePath.toLowerCase().endsWith('.gif');
      
      // For GIFs, use download option to bypass imgproxy transformation which strips animation
      const options = isGif ? { download: false } : undefined;

      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(storagePath, expiresIn, options);

      if (error) {
        console.error('Error generating signed URL:', error.message);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      return null;
    }
  }

  /**
   * Generate multiple signed URLs at once for better performance
   * @param storagePaths - Array of storage paths
   * @param expiresIn - Expiration time in seconds
   * @returns Map of original paths to signed URLs
   */
  async getSignedUrls(storagePaths: string[], expiresIn: number = 3600): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrls(storagePaths, expiresIn);

      if (error) {
        console.error('Error generating signed URLs:', error.message);
        return results;
      }

      if (data) {
        data.forEach((item, index) => {
          if (item.signedUrl) {
            results.set(storagePaths[index], item.signedUrl);
          }
        });
      }

      return results;
    } catch (error) {
      console.error('Error generating signed URLs:', error);
      return results;
    }
  }

  /**
   * Extract storage path and bucket name from a public URL
   * @param publicUrl - The full public URL
   * @returns Object with bucket and path, or null if not a valid Supabase URL
   */
  extractStorageInfo(publicUrl: string): { bucket: string; path: string } | null {
    if (!publicUrl) return null;
    
    const match = publicUrl.match(/(gamefolio-media|gamefolio-assets|gamefolio-name-tags|gamefolio-profile-borders)\/(.+)$/);
    if (match) {
      return { bucket: match[1], path: match[2] };
    }
    return null;
  }

  /**
   * Extract storage path from a public URL (for backward compatibility)
   * @param publicUrl - The full public URL
   * @returns The storage path or null if not a valid Supabase URL
   */
  extractStoragePath(publicUrl: string): string | null {
    const info = this.extractStorageInfo(publicUrl);
    return info ? info.path : null;
  }

  /**
   * Convert a public URL to a signed URL (supports both buckets)
   * @param publicUrl - The full public URL
   * @param expiresIn - Expiration time in seconds
   * @returns Signed URL or null if conversion fails
   */
  async convertToSignedUrl(publicUrl: string, expiresIn: number = 3600): Promise<string | null> {
    const info = this.extractStorageInfo(publicUrl);
    if (!info) return null;
    
    return this.getSignedUrlForBucket(info.bucket, info.path, expiresIn);
  }

  /**
   * Generate a signed URL for any supported bucket
   * @param bucketName - The bucket name
   * @param storagePath - The path within the bucket
   * @param expiresIn - Expiration time in seconds
   * @returns Signed URL or null if generation fails
   */
  async getSignedUrlForBucket(bucketName: string, storagePath: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      if (!this.allowedBuckets.includes(bucketName)) {
        console.error(`Bucket "${bucketName}" is not in the allowed list`);
        return null;
      }

      // Check if file is a GIF - need to bypass image transformation to preserve animation
      const isGif = storagePath.toLowerCase().endsWith('.gif');

      // For GIFs, use download option to bypass imgproxy transformation which strips animation
      const options = isGif ? { download: false } : undefined;

      const client = this.supabaseAdmin || this.supabase;
      const { data, error } = await client.storage
        .from(bucketName)
        .createSignedUrl(storagePath, expiresIn, options);

      if (error) {
        console.error(`Error generating signed URL for ${bucketName}:`, error.message);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      return null;
    }
  }

  /**
   * Expose supabase client for direct access (needed for scripts)
   */
  get client() {
    return this.supabase;
  }

  /**
   * List all files in a bucket (for admin asset management)
   * @param bucketName - The bucket name to list files from
   * @param folderPath - Optional folder path within the bucket
   * @returns Array of file objects with metadata
   */
  async listBucketFiles(bucketName: string, folderPath: string = ''): Promise<{
    name: string;
    id: string;
    size: number;
    createdAt: string;
    publicUrl: string;
    path: string;
  }[]> {
    try {
      if (this.disallowedBuckets.includes(bucketName)) {
        console.error(`Bucket "${bucketName}" is explicitly disallowed`);
        return [];
      }

      // Validate folder path to prevent path traversal attacks
      const sanitizedPath = this.sanitizeFolderPath(folderPath);

      const client = this.supabaseAdmin;
      const { data, error } = await client.storage
        .from(bucketName)
        .list(sanitizedPath, {
          limit: 1000,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) {
        console.error(`Error listing files from ${bucketName}:`, error.message);
        return [];
      }

      if (!data) return [];

      const actualFiles = data.filter(item => item.id);
      
      const files = await Promise.all(
        actualFiles.map(async (item) => {
          const fullPath = sanitizedPath ? `${sanitizedPath}/${item.name}` : item.name;
          
          const { data: signedData, error: signError } = await client.storage
            .from(bucketName)
            .createSignedUrl(fullPath, 3600);
          
          let url = '';
          if (signedData?.signedUrl) {
            url = signedData.signedUrl;
          } else {
            const { data: urlData } = client.storage
              .from(bucketName)
              .getPublicUrl(fullPath);
            url = urlData.publicUrl;
            if (signError) {
              console.warn(`Signed URL failed for ${fullPath}, falling back to public URL:`, signError.message);
            }
          }
          
          return {
            name: item.name,
            id: item.id!,
            size: item.metadata?.size || 0,
            createdAt: item.created_at || new Date().toISOString(),
            publicUrl: url,
            path: fullPath
          };
        })
      );

      return files;
    } catch (error) {
      console.error('Error listing bucket files:', error);
      return [];
    }
  }

  /**
   * List all folders in a bucket
   * @param bucketName - The bucket name
   * @param folderPath - Parent folder path
   * @returns Array of folder names
   */
  async listBucketFolders(bucketName: string, folderPath: string = ''): Promise<string[]> {
    try {
      if (this.disallowedBuckets.includes(bucketName)) {
        console.error(`Bucket "${bucketName}" is explicitly disallowed`);
        return [];
      }

      // Validate folder path to prevent path traversal attacks
      const sanitizedPath = this.sanitizeFolderPath(folderPath);

      const { data, error } = await this.supabaseAdmin.storage
        .from(bucketName)
        .list(sanitizedPath, { limit: 1000 });

      if (error) {
        console.error(`Error listing folders from ${bucketName}:`, error.message);
        return [];
      }

      if (!data) return [];

      // Folders don't have an id
      return data.filter(item => !item.id).map(item => item.name);
    } catch (error) {
      console.error('Error listing bucket folders:', error);
      return [];
    }
  }
}

// Create singleton instance
export const supabaseStorage = new SupabaseStorage();