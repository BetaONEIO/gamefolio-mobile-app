import { Env } from '@/constants/Env';

const SUPABASE_STORAGE_URL = `${Env.SUPABASE_URL}/storage/v1/object`;
const BUCKET_NAME = 'gamefolio-media';

export interface UploadResult {
  url: string;
  path: string;
}

export async function uploadToSupabase(
  fileUri: string,
  fileName: string,
  contentType: string
): Promise<UploadResult> {
  try {
    console.log('[Supabase Upload] Starting upload...');
    console.log('[Supabase Upload] File URI:', fileUri);
    console.log('[Supabase Upload] File Name:', fileName);
    console.log('[Supabase Upload] Content Type:', contentType);

    const response = await fetch(fileUri);
    const blob = await response.blob();
    
    console.log('[Supabase Upload] Blob size:', blob.size, 'bytes');

    const uploadPath = `${Date.now()}_${fileName}`;
    const uploadUrl = `${SUPABASE_STORAGE_URL}/${BUCKET_NAME}/${uploadPath}`;

    console.log('[Supabase Upload] Upload URL:', uploadUrl);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Env.SUPABASE_ANON_KEY}`,
        'Content-Type': contentType,
      },
      body: blob,
    });

    console.log('[Supabase Upload] Response status:', uploadResponse.status);

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[Supabase Upload] Error response:', errorText);
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const responseData = await uploadResponse.json();
    console.log('[Supabase Upload] Success:', responseData);

    const publicUrl = `${Env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${uploadPath}`;

    return {
      url: publicUrl,
      path: uploadPath,
    };
  } catch (error) {
    console.error('[Supabase Upload] Error:', error);
    throw error;
  }
}

export function getContentType(fileType: 'clips' | 'reels' | 'screenshots', uri: string): string {
  if (fileType === 'screenshots') {
    if (uri.toLowerCase().endsWith('.png')) return 'image/png';
    if (uri.toLowerCase().endsWith('.jpg') || uri.toLowerCase().endsWith('.jpeg')) return 'image/jpeg';
    return 'image/jpeg';
  }
  
  if (uri.toLowerCase().endsWith('.mov')) return 'video/quicktime';
  if (uri.toLowerCase().endsWith('.webm')) return 'video/webm';
  return 'video/mp4';
}

export function generateFileName(fileType: 'clips' | 'reels' | 'screenshots', uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase() || 'mp4';
  return `${fileType}_${Date.now()}.${extension}`;
}
