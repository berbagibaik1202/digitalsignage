import { useEffect, useRef, useState } from 'react';
import { getCachedMediaUrl } from '../services/media-cache';
import { getMediaUrl } from '../services/player';
import {
  getTransitionClass,
  isImageMime,
  normalizeTransitionEffect,
  resolveTransitionDurationMs,
  type TransitionEffect,
} from './mediaTransition';
import ClockDisplay from './clockDisplay';
import TextMarquee from './TextMarquee';

interface MediaItem {
  item_id: number;
  media_url: string;
  mime_type: string;
  duration_seconds: number;
  transition?: string;
  transition_duration_ms?: number;
}

interface Zone {
  id: number;
  name: string;
  zone_type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  config: Record<string, unknown>;
  loop: boolean;
  items: MediaItem[];
}

interface Layout {
  width: number;
  height: number;
  background_color: string;
  zones: Zone[];
}

interface TransitionState {
  fromItem: MediaItem;
  toItem: MediaItem;
  fromSource: string;
  toSource: string | null;
  effect: TransitionEffect;
  durationMs: number;
}

function getNextIndex(currentIndex: number, total: number, loop: boolean): number | null {
  if (currentIndex < total - 1) return currentIndex + 1;
  if (loop) return 0;
  return null;
}

function renderMedia(item: MediaItem, source: string, onEnded?: () => void) {
  if (item.mime_type.startsWith('video/')) {
    return <video key={item.item_id} src={source} autoPlay muted className="w-full h-full" style={{ objectFit: 'fill' }} onEnded={onEnded} />;
  }
  if (item.mime_type.startsWith('audio/')) {
    return <audio key={item.item_id} src={source} autoPlay onEnded={onEnded} />;
  }
  return <img key={item.item_id} src={source} alt="" className="w-full h-full object-cover" />;
}

type YouTubeKind = 'video' | 'playlist';

interface YouTubeEmbedInfo {
  kind: YouTubeKind;
  embedUrl: string;
  videoId?: string;
  playlistId?: string;
  previewUrl?: string;
  label: string;
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is not available'));
  }

  const win = window as Window & {
    YT?: { Player?: new (target: HTMLElement | string, options: any) => any };
    onYouTubeIframeAPIReady?: () => void;
  };

  if (win.YT?.Player) {
    return Promise.resolve();
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise<void>((resolve, reject) => {
    const previousCallback = win.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => {
      if (!win.YT?.Player) {
        youtubeApiPromise = null;
        reject(new Error('YouTube API timeout'));
      }
    }, 15000);

    win.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      if (typeof previousCallback === 'function') {
        previousCallback();
      }
      resolve();
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-youtube-iframe-api="true"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.dataset.youtubeIframeApi = 'true';
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        youtubeApiPromise = null;
        reject(new Error('Failed to load YouTube API'));
      };
      document.head.appendChild(script);
    }
  }).catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });

  return youtubeApiPromise;
}

function parseYouTubeUrl(rawUrl: string): YouTubeEmbedInfo | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const playlistId = url.searchParams.get('list') || '';

    if (host === 'youtu.be' || host.endsWith('youtube.com')) {
      let videoId = '';

      if (host === 'youtu.be') {
        videoId = url.pathname.split('/').filter(Boolean)[0] || '';
      } else if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v') || '';
      } else if (url.pathname.startsWith('/embed/')) {
        videoId = url.pathname.split('/').filter(Boolean)[1] || '';
      } else if (url.pathname.startsWith('/shorts/')) {
        videoId = url.pathname.split('/').filter(Boolean)[1] || '';
      }

      if ((url.pathname.includes('/playlist') || url.pathname.includes('/videoseries') || (!videoId && playlistId)) && playlistId) {
        const embedUrl = new URL('https://www.youtube.com/embed/videoseries');
        embedUrl.searchParams.set('list', playlistId);
        embedUrl.searchParams.set('autoplay', '1');
        embedUrl.searchParams.set('mute', '1');
        embedUrl.searchParams.set('playsinline', '1');
        embedUrl.searchParams.set('rel', '0');
        embedUrl.searchParams.set('modestbranding', '1');
        return {
          kind: 'playlist',
          embedUrl: embedUrl.toString(),
          playlistId,
          label: 'YouTube Playlist',
        };
      }

      if (videoId) {
        const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
        embedUrl.searchParams.set('autoplay', '1');
        embedUrl.searchParams.set('mute', '1');
        embedUrl.searchParams.set('playsinline', '1');
        embedUrl.searchParams.set('rel', '0');
        embedUrl.searchParams.set('modestbranding', '1');
        return {
          kind: 'video',
          embedUrl: embedUrl.toString(),
          videoId,
          previewUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          label: 'YouTube Video',
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function MediaZone({ zone }: { zone: Zone }) {
  const [index, setIndex] = useState(0);
  const [source, setSource] = useState<string | null>(null);
  const [transitionState, setTransitionState] = useState<TransitionState | null>(null);
  const [transitionSource, setTransitionSource] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const item = zone.items[index];

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    timerRef.current = null;
    transitionTimerRef.current = null;
  };

  const advanceToIndex = (nextIndex: number) => {
    const currentItem = zone.items[index];
    const nextItem = zone.items[nextIndex];
    if (!currentItem || !nextItem) return;

    if (!isImageMime(currentItem.mime_type)) {
      setIndex(nextIndex);
      return;
    }

    const effect = normalizeTransitionEffect(currentItem.transition || nextItem.transition);
    const durationMs = resolveTransitionDurationMs(currentItem, nextItem);
    const fromSource = source || getMediaUrl(currentItem.media_url);
    clearTimers();
    setTransitionState({
      fromItem: currentItem,
      toItem: nextItem,
      fromSource,
      toSource: null,
      effect,
      durationMs,
    });

    transitionTimerRef.current = setTimeout(() => {
      setIndex(nextIndex);
      setTransitionState(null);
      setTransitionSource(null);
    }, durationMs);
  };

  useEffect(() => {
    if (!item) return;
    let objectUrl: string | null = null;
    getCachedMediaUrl(item.media_url, getMediaUrl).then((cachedUrl) => {
      objectUrl = cachedUrl;
      setSource(cachedUrl || getMediaUrl(item.media_url));
    });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item]);

  useEffect(() => {
    if (!item || item.mime_type.startsWith('video/') || item.mime_type.startsWith('audio/')) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const nextIndex = getNextIndex(index, zone.items.length, zone.loop);
      if (nextIndex === null) return;
      advanceToIndex(nextIndex);
    }, item.duration_seconds * 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item, index, zone.items.length, zone.loop]);

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

  useEffect(() => () => clearTimers(), []);

  if (!item || !source) return <div className="w-full h-full bg-black" />;
  const next = () => {
    const nextIndex = getNextIndex(index, zone.items.length, zone.loop);
    if (nextIndex === null) return;
    advanceToIndex(nextIndex);
  };
  const isTransitioning = transitionState?.fromItem.item_id === item.item_id;
  const incomingSource = transitionSource || (transitionState ? getMediaUrl(transitionState.toItem.media_url) : '');
  const handleItemComplete = () => {
    const nextIndex = getNextIndex(index, zone.items.length, zone.loop);
    if (nextIndex === null) return;
    advanceToIndex(nextIndex);
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      <div style={{ opacity: isTransitioning ? 0 : 1 }} className="w-full h-full">
        {renderMedia(item, source, handleItemComplete)}
      </div>

      {isTransitioning && transitionState && (
        <div className="media-transition-layer pointer-events-none z-10">
          <img
            src={transitionState.fromSource}
            alt=""
            className={`w-full h-full object-cover ${getTransitionClass(transitionState.effect, 'exit')}`}
            style={{ animationDuration: `${transitionState.durationMs}ms` }}
          />
          {isImageMime(transitionState.toItem.mime_type) && (
            <img
              src={incomingSource}
              alt=""
              className={`w-full h-full object-cover ${getTransitionClass(transitionState.effect, 'enter')}`}
              style={{ animationDuration: `${transitionState.durationMs}ms` }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function resolveEmbeddedUrl(rawUrl: string): string {
  const parsed = parseYouTubeUrl(rawUrl);
  if (parsed) {
    return parsed.embedUrl;
  }

  try {
    return new URL(rawUrl).toString();
  } catch {
    return rawUrl;
  }
}

function YouTubeZone({ zone }: { zone: Zone }) {
  const url = typeof zone.config.url === 'string' ? zone.config.url : typeof zone.config.source_url === 'string' ? zone.config.source_url : '';
  const parsed = parseYouTubeUrl(url);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(parsed ? 'loading' : 'error');
  const [errorMessage, setErrorMessage] = useState<string | null>(parsed ? null : 'URL YouTube tidak valid');
  const playerRef = useRef<HTMLDivElement | null>(null);
  const playerInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!parsed) {
      setStatus('error');
      setErrorMessage('URL YouTube tidak valid');
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    setStatus('loading');
    setErrorMessage(null);

    const mount = playerRef.current;
    if (!mount) {
      return;
    }

    mount.innerHTML = '';

    loadYouTubeIframeApi()
      .then(() => {
        if (cancelled || !mount) return;
        const win = window as Window & {
          YT?: {
            Player?: new (target: HTMLElement | string, options: any) => any;
          };
        };

        if (!win.YT?.Player) {
          throw new Error('YouTube player API unavailable');
        }

        playerInstanceRef.current?.destroy?.();
        playerInstanceRef.current = new win.YT.Player(mount, {
          width: '100%',
          height: '100%',
          videoId: parsed.kind === 'video' ? parsed.videoId : undefined,
          playerVars: parsed.kind === 'playlist'
            ? {
                listType: 'playlist',
                list: parsed.playlistId,
                autoplay: 1,
                mute: 1,
                playsinline: 1,
                rel: 0,
                modestbranding: 1,
              }
            : {
                autoplay: 1,
                mute: 1,
                playsinline: 1,
                rel: 0,
                modestbranding: 1,
              },
          events: {
            onReady: (event: { target: { mute: () => void; playVideo: () => void } }) => {
              if (timeoutId) {
                window.clearTimeout(timeoutId);
                timeoutId = null;
              }
              event.target.mute();
              event.target.playVideo();
              if (!cancelled) setStatus('ready');
            },
            onError: () => {
              if (timeoutId) {
                window.clearTimeout(timeoutId);
                timeoutId = null;
              }
              if (cancelled) return;
              setStatus('error');
              setErrorMessage('Embed YouTube ditolak atau video tidak tersedia untuk disematkan.');
            },
          },
        });

        timeoutId = window.setTimeout(() => {
          if (!cancelled) {
            setStatus('error');
            setErrorMessage('YouTube gagal dimuat. Kemungkinan embedding diblokir.');
          }
        }, 12000);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage('Gagal memuat YouTube player.');
        }
      });

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      playerInstanceRef.current?.destroy?.();
      playerInstanceRef.current = null;
    };
  }, [parsed?.embedUrl, parsed?.kind, parsed?.playlistId, parsed?.videoId]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      {parsed?.previewUrl && (
        <img
          src={parsed.previewUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover blur-lg scale-105"
          style={{ opacity: status === 'ready' ? 0.15 : 0.35 }}
        />
      )}

      <div ref={playerRef} className="absolute inset-0" style={{ opacity: status === 'ready' ? 1 : 0, transition: 'opacity 200ms ease' }} />

      {status !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/55 to-black/85 p-4 text-center text-white">
          <div className="max-w-[90%]">
            <div className="text-[0.8rem] font-semibold uppercase tracking-[0.2em] text-white/70">{parsed?.label || 'YouTube'}</div>
            <div className="mt-2 text-lg font-semibold">{status === 'error' ? 'Preview gagal dimuat' : 'Memuat preview'}</div>
            <div className="mt-1 text-sm text-white/75">{errorMessage || 'Mencoba membuka embed YouTube yang sesuai.'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function UrlZone({ zone }: { zone: Zone }) {
  const url = typeof zone.config.url === 'string' ? zone.config.url : typeof zone.config.source_url === 'string' ? zone.config.source_url : '';

  if (!url) {
    return <div className="w-full h-full bg-black" />;
  }

  const parsed = parseYouTubeUrl(url);
  if (parsed) {
    return <YouTubeZone zone={zone} />;
  }

  const embeddedUrl = resolveEmbeddedUrl(url);

  return (
    <iframe
      title={zone.name}
      src={embeddedUrl}
      loading="eager"
      referrerPolicy="no-referrer"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      className="w-full h-full border-0 bg-black"
    />
  );
}

export default function LayoutView({ layout }: { layout: Layout }) {
  return (
    <div className="w-screen h-screen overflow-hidden" style={{ backgroundColor: layout.background_color }}>
      {layout.zones.map((zone) => {
        const style = {
          left: `${(zone.x / layout.width) * 100}%`,
          top: `${(zone.y / layout.height) * 100}%`,
          width: `${(zone.width / layout.width) * 100}%`,
          height: `${(zone.height / layout.height) * 100}%`,
          zIndex: zone.z_index,
        };
        if (zone.zone_type === 'MEDIA') {
          return (
            <div key={zone.id} className="absolute overflow-hidden" style={style}>
              <MediaZone zone={zone} />
            </div>
          );
        }
        if (zone.zone_type === 'CLOCK') {
          return (
            <div key={zone.id} className="absolute flex items-center justify-center overflow-hidden" style={style}>
              <ClockDisplay config={zone.config} />
            </div>
          );
        }
        if (zone.zone_type === 'TEXT') {
          const text = String(zone.config.text || zone.name);
          const backgroundColor = typeof zone.config.background_color === 'string' ? zone.config.background_color : '#000000';
          const fontFamily = typeof zone.config.font_family === 'string' ? zone.config.font_family : 'ui-sans-serif, system-ui, sans-serif';
          const fontSize = Number(zone.config.font_size) || 56;

          return (
            <div key={zone.id} className="absolute overflow-hidden" style={style}>
              <TextMarquee
                text={text}
                style={{
                  backgroundColor,
                  color: '#ffffff',
                  fontFamily,
                  fontSize: `${fontSize}px`,
                  fontWeight: 700,
                }}
              />
            </div>
          );
        }
        if (zone.zone_type === 'WEB' || zone.zone_type === 'RSS') {
          return (
            <div key={zone.id} className="absolute overflow-hidden" style={style}>
              <UrlZone zone={zone} />
            </div>
          );
        }
        return <div key={zone.id} className="absolute bg-black" style={style} />;
      })}
    </div>
  );
}
