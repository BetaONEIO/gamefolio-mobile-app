const PLACEHOLDER_THUMBNAILS = {
  clip: [
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=450&fit=crop',
    'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=450&fit=crop',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=450&fit=crop',
  ],
  reel: [
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=450&h=800&fit=crop',
    'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=450&h=800&fit=crop',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=450&h=800&fit=crop',
  ],
  screenshot: [
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=600&fit=crop',
  ],
};

export const isValidThumbnailUrl = (url: string | undefined | null): boolean => {
  if (!url || url.trim() === '') return false;
  if (url === 'null' || url === 'undefined') return false;
  const invalidPatterns = ['placeholder', 'default-thumbnail', 'no-image'];
  return !invalidPatterns.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()));
};

interface ContentWithThumbnail {
  id: number;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  game?: { imageUrl?: string | null } | null;
}

export const getContentThumbnail = (
  content: ContentWithThumbnail,
  type: 'clip' | 'reel' | 'screenshot'
): string => {
  if (isValidThumbnailUrl(content.thumbnailUrl)) {
    return content.thumbnailUrl!;
  }

  if (type === 'screenshot' && isValidThumbnailUrl(content.imageUrl)) {
    return content.imageUrl!;
  }

  if (isValidThumbnailUrl(content.game?.imageUrl)) {
    return content.game!.imageUrl!;
  }

  const placeholders = PLACEHOLDER_THUMBNAILS[type];
  const placeholderIndex = content.id % placeholders.length;
  return placeholders[placeholderIndex];
};

export const getClipThumbnail = (clip: ContentWithThumbnail): string => 
  getContentThumbnail(clip, 'clip');

export const getReelThumbnail = (reel: ContentWithThumbnail): string => 
  getContentThumbnail(reel, 'reel');

export const getScreenshotThumbnail = (screenshot: ContentWithThumbnail): string => 
  getContentThumbnail(screenshot, 'screenshot');
