const MANIFEST_KEY = 'cached_player_manifest';
const MEDIA_CACHE_NAME = 'digital-signage-player-media-v1';

export interface CachedManifestItem {
  item_id: number;
  media_id: number;
  media_url: string;
  mime_type: string;
  duration_seconds: number;
  transition?: string;
}

export interface CachedManifest {
  manifest_version: number;
  playlist_id?: number;
  loop: boolean;
  items: CachedManifestItem[];
}

function getMediaCache() {
  if (!('caches' in window)) return null;
  return caches.open(MEDIA_CACHE_NAME);
}

export function getCachedManifest(): CachedManifest | null {
  try {
    const value = localStorage.getItem(MANIFEST_KEY);
    return value ? JSON.parse(value) as CachedManifest : null;
  } catch {
    return null;
  }
}

export async function cacheManifest(manifest: CachedManifest, token: string | null, getMediaUrl: (url: string) => string): Promise<void> {
  const cache = await getMediaCache();
  if (!cache) throw new Error('Offline media cache is unavailable');

  for (const item of manifest.items) {
    const mediaUrl = getMediaUrl(item.media_url);
    const cached = await cache.match(mediaUrl);
    if (cached) continue;

    const response = await fetch(mediaUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new Error(`Unable to cache media (${response.status})`);
    await cache.put(mediaUrl, response);
  }

  localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
}

export async function getCachedMediaUrl(mediaUrl: string, getMediaUrl: (url: string) => string): Promise<string | null> {
  const cache = await getMediaCache();
  if (!cache) return null;

  const response = await cache.match(getMediaUrl(mediaUrl));
  if (!response) return null;

  return URL.createObjectURL(await response.blob());
}