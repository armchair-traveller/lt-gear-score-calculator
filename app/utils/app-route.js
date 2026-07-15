export function normalizeAppRoutePath(path) {
  const normalizedPath = String(path || '/').replace(/\/+$/, '')
  return normalizedPath || '/'
}
