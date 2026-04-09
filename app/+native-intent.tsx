export function redirectSystemPath({
  path,
}: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, 'http://x');

    // Handle /ref/:code path format (Universal Links: gamefolio.app/ref/CODE)
    const refPathMatch = url.pathname.match(/^\/ref\/([A-Z0-9]{1,8})$/i);
    if (refPathMatch) {
      return `/?ref=${encodeURIComponent(refPathMatch[1].toUpperCase())}`;
    }

    // Handle ?ref=CODE query param format (existing behaviour)
    const ref = url.searchParams.get('ref');
    if (ref) {
      return `/?ref=${encodeURIComponent(ref)}`;
    }
  } catch {}
  return path || '/';
}
