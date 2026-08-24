import { useState, useEffect, useRef, useCallback } from 'react';
import { getManifest, reportPlayback, getMediaUrl, getPlayerSessionToken } from '../services/player';
import { cacheManifest, getCachedManifest, getCachedMediaUrl, type CachedManifest } from '../services/media-cache';
import LayoutView from './LayoutView';

interface ManifestItem {
  item_id: number;
  media_id: number;
  media_url: string;
  mime_type: string;
  duration_seconds: number;
  transition?: string;
}

interface Manifest {
  manifest_version: number;
  playlist_id?: number;
  loop: boolean;
  items: ManifestItem[];
  layout?: CachedManifest['layout'];
}

interface PlayerViewProps {
  onError?: (error: string) => void;
}

export default function PlayerView({ onError }: PlayerViewProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBlack, setIsBlack] = useState(false);
  const [mediaSource, setMediaSource] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const manifestVersionRef = useRef<number | null>(null);

  // Fetch manifest from backend
  const fetchManifest = useCallback(async () => {
    try {
      const m = await getManifest() as CachedManifest | null;
      if (m) {
        if (m.manifest_version === manifestVersionRef.current) return;

        await cacheManifest(m, getPlayerSessionToken(), getMediaUrl);
        manifestVersionRef.current = m.manifest_version;
        setManifest(m);
        setCurrentIndex(0);
        setIsBlack(false);
        setError(null);
      } else {
        const cachedManifest = getCachedManifest();
        if (cachedManifest && (cachedManifest.items.length > 0 || cachedManifest.layout)) {
          manifestVersionRef.current = cachedManifest.manifest_version;
          setManifest(cachedManifest);
          setError(null);
        } else {
          setError('Tidak ada konten yang tersedia');
        }
      }
    } catch (err: any) {
      const cachedManifest = getCachedManifest();
      if (cachedManifest && (cachedManifest.items.length > 0 || cachedManifest.layout)) {
        manifestVersionRef.current = cachedManifest.manifest_version;
        setManifest(cachedManifest);
        setError(null);
      } else {
        setError(err.message || 'Gagal memuat manifest');
        onError?.(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [onError]);

  // Initial fetch
  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  // Refetch manifest periodically (every 60 seconds)
  useEffect(() => {
    const interval = setInterval(fetchManifest, 60000);
    return () => clearInterval(interval);
  }, [fetchManifest]);

  // Play current item
  const playCurrentItem = useCallback(() => {
    if (!manifest || manifest.items.length === 0 || manifest.layout) return;

    const item = manifest.items[currentIndex];
    startTimeRef.current = Date.now();

    // Report START
    reportPlayback({
      playlist_id: manifest.playlist_id,
      media_id: item.item_id,
      action: 'START',
      started_at: new Date().toISOString(),
    });

    if (item.mime_type.startsWith('video/') || item.mime_type.startsWith('audio/')) {
      return;
    }

    // Images and unsupported media advance using the configured playlist duration.
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Report END
      reportPlayback({
        playlist_id: manifest.playlist_id,
        media_id: item.item_id,
        action: 'END',
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTimeRef.current,
      });

      // Next item
      if (currentIndex < manifest.items.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (manifest.loop) {
        setCurrentIndex(0); // Loop back to start
      } else {
        setIsBlack(true); // Show black screen
      }
    }, item.duration_seconds * 1000);
  }, [manifest, currentIndex]);

  // Play when index changes
  useEffect(() => {
    if (manifest && manifest.items.length > 0) {
      playCurrentItem();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, manifest, playCurrentItem]);

  useEffect(() => {
    if (!manifest || manifest.items.length === 0 || manifest.layout) return;

    let objectUrl: string | null = null;
    getCachedMediaUrl(manifest.items[currentIndex].media_url, getMediaUrl).then((cachedUrl) => {
      objectUrl = cachedUrl;
      setMediaSource(cachedUrl || getMediaUrl(manifest.items[currentIndex].media_url));
    });

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [currentIndex, manifest]);

  // ─── Loading Screen ────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Memuat konten...</p>
        </div>
      </div>
    );
  }

  // ─── Error Screen ──────────────────────────────────────────
  if (error) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-red-400 text-xl mb-2">Error</p>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); fetchManifest(); }}
            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  // ─── Black Screen (no content) ─────────────────────────────
  if (isBlack || !manifest || (manifest.items.length === 0 && !manifest.layout)) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <p className="text-gray-600 text-lg">Tidak ada konten</p>
      </div>
    );
  }

  if (manifest.layout) {
    return <LayoutView layout={manifest.layout} />;
  }

  // ─── Current Item ──────────────────────────────────────────

  const currentItem = manifest.items[currentIndex];
  const currentMediaUrl = mediaSource || getMediaUrl(currentItem.media_url);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden">
      {currentItem.mime_type.startsWith('image/') ? (
        <img
          key={currentItem.item_id}
          src={currentMediaUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={() => {
            reportPlayback({
              playlist_id: manifest.playlist_id,
              media_id: currentItem.item_id,
              action: 'ERROR',
              error_message: 'Image failed to load',
            });
          }}
        />
      ) : currentItem.mime_type.startsWith('video/') ? (
        <video
          key={currentItem.item_id}
          src={currentMediaUrl}
          autoPlay
          muted
          className="w-full h-full object-cover"
          onEnded={() => {
            reportPlayback({
              playlist_id: manifest.playlist_id,
              media_id: currentItem.item_id,
              action: 'END',
              ended_at: new Date().toISOString(),
              duration_ms: Date.now() - startTimeRef.current,
            });

            if (currentIndex < manifest.items.length - 1) {
              setCurrentIndex(currentIndex + 1);
            } else if (manifest.loop) {
              setCurrentIndex(0);
            } else {
              setIsBlack(true);
            }
          }}
          onError={() => {
            reportPlayback({
              playlist_id: manifest.playlist_id,
              media_id: currentItem.item_id,
              action: 'ERROR',
              error_message: 'Video failed to load',
            });
          }}
        />
      ) : currentItem.mime_type.startsWith('audio/') ? (
        <>
          {/* Audio: show black screen with audio */}
          <audio
            key={currentItem.item_id}
            src={currentMediaUrl}
            autoPlay
            onEnded={() => {
              if (currentIndex < manifest.items.length - 1) {
                setCurrentIndex(currentIndex + 1);
              } else if (manifest.loop) {
                setCurrentIndex(0);
              } else {
                setIsBlack(true);
              }
            }}
          />
          <div className="w-full h-full bg-black flex items-center justify-center">
            <div className="text-6xl">🎵</div>
          </div>
        </>
      ) : (
        /* Unknown type: show as image */
        <img
          key={currentItem.item_id}
          src={currentMediaUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      )}

      {/* Progress bar (subtle) */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-800">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{
            animation: `progress ${currentItem.duration_seconds}s linear`,
          }}
        />
      </div>

      {/* Style for progress animation */}
      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
