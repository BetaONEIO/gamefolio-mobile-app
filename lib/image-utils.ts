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
