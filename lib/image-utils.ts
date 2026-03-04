import { supabaseAdmin } from '@/lib/supabase';
import { Env } from '@/constants/Env';

const SUPABASE_PUBLIC_PATTERN = /\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/;
const SUPABASE_AUTH_PATTERN = /\/storage\/v1\/object\/(?!public\/)(?!sign\/)([^\/]+)\/(.+)$/;

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

const SIGNED_URL_EXPIRY = 3600;
const CACHE_BUFFER = 300;

export async function signUrl(publicUrl: string | null | undefined): Promise<string | null> {
  if (!publicUrl) return null;

  if (!publicUrl.includes(Env.SUPABASE_URL) && !publicUrl.includes('/storage/v1/object/')) {
    return publicUrl;
  }

  if (publicUrl.includes('/storage/v1/object/sign/') || publicUrl.includes('token=')) {
    return publicUrl;
  }

  const cached = signedUrlCache.get(publicUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  let bucket: string | null = null;
  let path: string | null = null;

  let match = publicUrl.match(SUPABASE_PUBLIC_PATTERN);
  if (match) {
    [, bucket, path] = match;
  }

  if (!bucket || !path) {
    const authMatch = publicUrl.match(SUPABASE_AUTH_PATTERN);
    if (authMatch) {
      [, bucket, path] = authMatch;
    }
  }

  if (!bucket || !path) {
    return publicUrl;
  }

  try {
    const decodedPath = decodeURIComponent(path);
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(decodedPath, SIGNED_URL_EXPIRY);

    if (error || !data?.signedUrl) {
      console.warn('[SignURL] Failed to sign:', bucket + '/' + decodedPath.substring(0, 30), error?.message);
      return publicUrl;
    }

    signedUrlCache.set(publicUrl, {
      url: data.signedUrl,
      expiresAt: Date.now() + (SIGNED_URL_EXPIRY - CACHE_BUFFER) * 1000,
    });

    return data.signedUrl;
  } catch (err) {
    console.warn('[SignURL] Error:', err);
    return publicUrl;
  }
}

export async function signMediaFields<T extends Record<string, any>>(
  obj: T,
  fields: string[]
): Promise<T> {
  const result = { ...obj };
  await Promise.all(
    fields.map(async (field) => {
      if (result[field] && typeof result[field] === 'string') {
        (result as any)[field] = await signUrl(result[field]);
      }
    })
  );
  return result;
}

export async function signClipData(clip: any): Promise<any> {
  if (!clip) return clip;
  const signed = { ...clip };
  [signed.videoUrl, signed.thumbnailUrl] = await Promise.all([
    signUrl(clip.videoUrl),
    signUrl(clip.thumbnailUrl),
  ]);
  if (signed.user?.avatarUrl) {
    signed.user = { ...signed.user, avatarUrl: await signUrl(clip.user.avatarUrl) };
  }
  return signed;
}

export async function signScreenshotData(screenshot: any): Promise<any> {
  if (!screenshot) return screenshot;
  const signed = { ...screenshot };
  [signed.imageUrl, signed.thumbnailUrl] = await Promise.all([
    signUrl(screenshot.imageUrl),
    signUrl(screenshot.thumbnailUrl),
  ]);
  if (signed.user?.avatarUrl) {
    signed.user = { ...signed.user, avatarUrl: await signUrl(screenshot.user.avatarUrl) };
  }
  return signed;
}

export async function signUserData(user: any): Promise<any> {
  if (!user) return user;
  const signed = { ...user };
  [signed.avatarUrl, signed.bannerUrl] = await Promise.all([
    signUrl(user.avatarUrl),
    signUrl(user.bannerUrl),
  ]);
  return signed;
}

export function getImageCacheKey(url: string | null | undefined): string | undefined {
  if (!url) return undefined;

  if (!url.includes('/storage/v1/object/sign/')) return undefined;

  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    const questionIndex = url.indexOf('?');
    if (questionIndex > 0) {
      return url.substring(0, questionIndex);
    }
    return undefined;
  }
}
