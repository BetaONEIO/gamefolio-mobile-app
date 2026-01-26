import { supabaseAdmin } from "@/lib/supabase";
import { Env } from "@/constants/Env";

// Match both public and authenticated/private URL formats
const SUPABASE_PUBLIC_PATTERN = /\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/;
const SUPABASE_AUTH_PATTERN = /\/storage\/v1\/object\/([^\/]+)\/(.+)$/;
const SUPABASE_SIGNED_PATTERN = /\/storage\/v1\/object\/sign\/([^\/]+)\/(.+?)\?/;

export async function generateSignedUrl(publicUrl: string | null | undefined): Promise<string | null> {
  if (!publicUrl) {
    console.log('[SignedURL] URL is null/undefined');
    return null;
  }
  
  // Skip if it's not a Supabase storage URL
  if (!publicUrl.includes('/storage/v1/object/')) {
    console.log('[SignedURL] Not a Supabase storage URL, returning as-is:', publicUrl.substring(0, 50));
    return publicUrl;
  }
  
  // Skip if it's already a signed URL
  if (publicUrl.includes('/storage/v1/object/sign/') || publicUrl.includes('token=')) {
    console.log('[SignedURL] Already a signed URL, returning as-is');
    return publicUrl;
  }
  
  try {
    let bucket: string | null = null;
    let path: string | null = null;
    
    // Try matching public URL format first
    let match = publicUrl.match(SUPABASE_PUBLIC_PATTERN);
    if (match) {
      [, bucket, path] = match;
      console.log('[SignedURL] Matched public pattern - bucket:', bucket, 'path:', path?.substring(0, 30));
    }
    
    // Try matching authenticated URL format if public didn't match
    if (!bucket || !path) {
      // For authenticated URLs: /storage/v1/object/{bucket}/{path}
      const authMatch = publicUrl.match(/\/storage\/v1\/object\/(?!public\/)(?!sign\/)([^\/]+)\/(.+)$/);
      if (authMatch) {
        [, bucket, path] = authMatch;
        console.log('[SignedURL] Matched auth pattern - bucket:', bucket, 'path:', path?.substring(0, 30));
      }
    }
    
    if (!bucket || !path) {
      console.log('[SignedURL] Could not parse URL, returning as-is:', publicUrl.substring(0, 80));
      return publicUrl;
    }
    
    // Decode the path in case it has URL-encoded characters
    const decodedPath = decodeURIComponent(path);
    
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(decodedPath, 3600); // 1 hour expiry
    
    if (error) {
      console.error('[SignedURL] Error generating signed URL for bucket:', bucket, 'path:', decodedPath.substring(0, 30), 'error:', error.message);
      return publicUrl;
    }
    
    console.log('[SignedURL] Successfully generated signed URL for:', bucket + '/' + decodedPath.substring(0, 30));
    return data.signedUrl;
  } catch (error) {
    console.error('[SignedURL] Unexpected error:', error);
    return publicUrl;
  }
}

export async function signMediaUrls<T extends Record<string, any>>(obj: T, fields: string[]): Promise<T> {
  const result = { ...obj };
  
  for (const field of fields) {
    if (result[field]) {
      (result as any)[field] = await generateSignedUrl(result[field]);
    }
  }
  
  return result;
}

export async function signClipUrls(clip: any): Promise<any> {
  return {
    ...clip,
    videoUrl: await generateSignedUrl(clip.videoUrl),
    thumbnailUrl: await generateSignedUrl(clip.thumbnailUrl),
  };
}

export async function signScreenshotUrls(screenshot: any): Promise<any> {
  return {
    ...screenshot,
    imageUrl: await generateSignedUrl(screenshot.imageUrl),
    thumbnailUrl: await generateSignedUrl(screenshot.thumbnailUrl),
  };
}

export async function signUserUrls(user: any): Promise<any> {
  return {
    ...user,
    avatarUrl: await generateSignedUrl(user.avatarUrl),
    bannerUrl: await generateSignedUrl(user.bannerUrl),
  };
}
