/** Same-origin path. Next rewrites `/tcno/*` to the public tile host. */
export function asset(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `/tcno${path.startsWith("/") ? path : `/${path}`}`;
}
