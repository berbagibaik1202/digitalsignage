import { useState, useEffect, useRef, useCallback } from 'react';
import { getManifest, reportPlayback, getMediaUrl, getPlayerSessionToken } from '../services/player';
import { cacheManifest, getCachedManifest, getCachedMediaUrl, type CachedManifest } from '../services/media-cache';
import LayoutView from './LayoutView';
import {
  getTransitionClass,
  isImageMime,
  normalizeTransitionEffect,
  resolveTransitionDurationMs,
  type TransitionEffect,
} from './mediaTransition';

interface ManifestItem {
  item_id: number;
  media_id: number;
  media_url: string;
  mime_type: string;
  duration_seconds: number;
  transition?: string;
  transition_duration_ms?: number;
}

interface Manifest {
  manifest_version: number;
  playlist_id?: number;
  loop: boolean;
  items: ManifestItem[];
  layout?: CachedManifest['layout'];
}

interface TransitionState {
  fromItem: ManifestItem;
  toItem: ManifestItem;
  fromSource: string;
  toSource: string | null;
  effect: TransitionEffect;
  durationMs: number;
}

interface PlayerViewProps {
  onError?: (error: string) => void;
}

function getNextIndex(currentIndex: number, total: number, loop: boolean): number | null {
  if (currentIndex < total - 1) return currentIndex + 1;
  if (loop) return 0;
  return null;
}

function renderMedia(item: ManifestItem, source: string, onEnded?: () => void) {
  if (item.mime_type.startsWith('image/')) {
    return (
      <img
        key={item.item_id}
        src={source}
        alt=""
        className="w-full h-full object-cover"
      />
    );
  }

  if (item.mime_type.startsWith('video/')) {
    return (
      <video
        key={item.item_id}
        src={source}
        autoPlay
        muted
        className="w-full h-full object-cover"
        onEnded={onEnded}
      />
    );
  }

  if (item.mime_type.startsWith('audio/')) {
    return (
      <>
        <audio key={item.item_id} src={source} autoPlay onEnded={onEnded} />
        <div className="w-full h-full bg-black flex items-center justify-center">
          <div className="text-6xl">AUDIO</div>
        </div>
      </>
    );
  }

  return (
    <img
      key={item.item_id}
      src={source}
      alt=""
      className="w-full h-full object-cover"
    />
  );
}

export default function PlayerView({ onError }: PlayerViewProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBlack, setIsBlack] = useState(false);
  const [mediaSource, setMediaSource] = useState<string | null>(null);
  const [transitionState, setTransitionState] = useState<TransitionState | null>(null);
  const [transitionSource, setTransitionSource] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const manifestVersionRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    timerRef.current = null;
    transitionTimerRef.current = null;
  }, []);

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
        setTransitionState(null);
        setTransitionSource(null);
        setError(null);
      } else {
        const cachedManifest = getCachedManifest();
        if (cachedManifest && (cachedManifest.items.length > 0 || cachedManifest.layout)) {
          manifestVersionRef.current = cachedManifest.manifest_version;
          setManifest(cachedManifest);
          setTransitionState(null);
          setTransitionSource(null);
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
        setTransitionState(null);
        setTransitionSource(null);
        setError(null);
      } else {
        setError(err.message || 'Gagal memuat manifest');
        onError?.(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  useEffect(() => {
    const interval = setInterval(fetchManifest, 60000);
    return () => clearInterval(interval);
  }, [fetchManifest]);

  const advanceToIndex = useCallback((nextIndex: number) => {
    if (!manifest) return;

    const item = manifest.items[currentIndex];
    const nextItem = manifest.items[nextIndex];
    if (!item || !nextItem) return;

    const shouldAnimate = isImageMime(item.mime_type) || isImageMime(nextItem.mime_type);
    if (!shouldAnimate) {
      setCurrentIndex(nextIndex);
      return;
    }

    const effect = normalizeTransitionEffect(item.transition || nextItem.transition);
    const durationMs = resolveTransitionDurationMs(item, nextItem);
    const fromSource = mediaSource || getMediaUrl(item.media_url);

    clearTimers();
    setTransitionState({
      fromItem: item,
      toItem: nextItem,
      fromSource,
      toSource: null,
      effect,
      durationMs,
    });

    transitionTimerRef.current = setTimeout(() => {
      setCurrentIndex(nextIndex);
      setTransitionState(null);
      setTransitionSource(null);
    }, durationMs);
  }, [clearTimers, currentIndex, manifest, mediaSource]);

  const playCurrentItem = useCallback(() => {
    if (!manifest || manifest.items.length === 0 || manifest.layout) return;

    const item = manifest.items[currentIndex];
    if (!item) return;

    startTimeRef.current = Date.now();

    reportPlayback({
      playlist_id: manifest.playlist_id,
      media_id: item.item_id,
      action: 'START',
      started_at: new Date().toISOString(),
    });

    if (item.mime_type.startsWith('video/') || item.mime_type.startsWith('audio/')) {
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      reportPlayback({
        playlist_id: manifest.playlist_id,
        media_id: item.item_id,
        action: 'END',
        ended_at: new Date().toISOString(),
        duration_ms: Date.now() - startTimeRef.current,
      });

      const nextIndex = getNextIndex(currentIndex, manifest.items.length, manifest.loop);
      if (nextIndex === null) {
        setIsBlack(true);
        return;
      }

      advanceToIndex(nextIndex);
    }, item.duration_seconds * 1000);
  }, [advanceToIndex, currentIndex, manifest]);

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

  useEffect(() => {
    if (!transitionState || !isImageMime(transitionState.toItem.mime_type)) {
      setTransitionSource(null);
      return;
    }

    let objectUrl: string | null = null;
    let active = true;
    getCachedMediaUrl(transitionState.toItem.media_url, getMediaUrl).then((cachedUrl) => {
      if (!active) return;
      objectUrl = cachedUrl;
      setTransitionSource(cachedUrl || getMediaUrl(transitionState.toItem.media_url));
    }).catch(() => {
      if (!active) return;
      setTransitionSource(getMediaUrl(transitionState.toItem.media_url));
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [transitionState?.toItem.item_id, transitionState?.toItem.media_url, transitionState?.toItem.mime_type]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

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

  if (error) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">WARN</div>
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

  const currentItem = manifest.items[currentIndex];
  const currentMediaUrl = mediaSource || getMediaUrl(currentItem.media_url);
  const isTransitioning = transitionState?.fromItem.item_id === currentItem.item_id;
  const transitionIncomingSource = transitionSource || (transitionState ? getMediaUrl(transitionState.toItem.media_url) : '');
  const handleCurrentItemComplete = useCallback(() => {
    if (!manifest || manifest.items.length === 0 || manifest.layout) return;

    const item = manifest.items[currentIndex];
    if (!item) return;

    reportPlayback({
      playlist_id: manifest.playlist_id,
      media_id: item.item_id,
      action: 'END',
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startTimeRef.current,
    });

    const nextIndex = getNextIndex(currentIndex, manifest.items.length, manifest.loop);
    if (nextIndex === null) {
      setIsBlack(true);
      return;
    }

    advanceToIndex(nextIndex);
  }, [advanceToIndex, currentIndex, manifest]);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <div style={{ opacity: isTransitioning ? 0 : 1 }} className="w-full h-full">
        {renderMedia(currentItem, currentMediaUrl, handleCurrentItemComplete)}
      </div>

      {isTransitioning && transitionState && (
        <div className="media-transition-layer pointer-events-none z-10">
          {isImageMime(transitionState.fromItem.mime_type) && (
            <img
              src={transitionState.fromSource}
              alt=""
              className={`w-full h-full object-cover ${getTransitionClass(transitionState.effect, 'exit')}`}
              style={{ animationDuration: `${transitionState.durationMs}ms` }}
              onError={() => {
                reportPlayback({
                  playlist_id: manifest.playlist_id,
                  media_id: transitionState.fromItem.item_id,
                  action: 'ERROR',
                  error_message: 'Transition source failed to load',
                });
              }}
            />
          )}
          {isImageMime(transitionState.toItem.mime_type) && (
            <img
              src={transitionIncomingSource}
              alt=""
              className={`w-full h-full object-cover ${getTransitionClass(transitionState.effect, 'enter')}`}
              style={{ animationDuration: `${transitionState.durationMs}ms` }}
            />
          )}
        </div>
      )}

      <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-800">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{
            animation: `progress ${currentItem.duration_seconds}s linear`,
          }}
        />
      </div>

      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
