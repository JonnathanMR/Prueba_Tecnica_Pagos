const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export function apiUrl(path: string): string {
  if (!configuredApiBaseUrl) return path

  return `${configuredApiBaseUrl.replace(/\/+$/, '')}${path}`
}
