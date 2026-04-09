export function redirectSystemPath({
  path,
}: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, 'http://x');
    const ref = url.searchParams.get('ref');
    if (ref) {
      return `/?ref=${encodeURIComponent(ref)}`;
    }
  } catch {}
  return path || '/';
}
