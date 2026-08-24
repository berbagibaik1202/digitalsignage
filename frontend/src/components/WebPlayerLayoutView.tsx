import { useEffect, useRef, useState } from 'react';
import ClockDisplay from './ClockDisplay';
import TextMarquee from './TextMarquee';

interface MediaItem {
  item_id: number;
  media_url: string;
  mime_type: string;
  duration_seconds: number;
}

export interface WebPlayerLayout {
  width: number;
  height: number;
  background_color: string;
  zones: Array<{
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
  }>;
}

interface WebPlayerLayoutViewProps {
  layout: WebPlayerLayout;
  loadMedia: (mediaUrl: string) => Promise<string>;
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

function MediaZone({ zone, loadMedia }: { zone: WebPlayerLayout['zones'][number]; loadMedia: (mediaUrl: string) => Promise<string> }) {
  const [index, setIndex] = useState(0);
  const [source, setSource] = useState<string | null>(null);
  const item = zone.items[index];

  useEffect(() => {
    if (!item) return;
    let objectUrl: string | null = null;
    loadMedia(item.media_url).then((url) => {
      objectUrl = url.startsWith('blob:') ? url : null;
      setSource(url);
    }).catch(() => setSource(null));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item, loadMedia]);

  useEffect(() => {
    if (!item || item.mime_type.startsWith('video/') || item.mime_type.startsWith('audio/')) return;
    const timer = setTimeout(() => setIndex((current) => current < zone.items.length - 1 ? current + 1 : zone.loop ? 0 : current), item.duration_seconds * 1000);
    return () => clearTimeout(timer);
  }, [item, zone.items.length, zone.loop]);

  if (!item || !source) return <div style={{ width: '100%', height: '100%', background: '#000' }} />;
  const next = () => setIndex((current) => current < zone.items.length - 1 ? current + 1 : zone.loop ? 0 : current);
  if (item.mime_type.startsWith('video/')) return <video key={item.item_id} src={source} autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'fill' }} onEnded={next} />;
  if (item.mime_type.startsWith('audio/')) return <audio key={item.item_id} src={source} autoPlay onEnded={next} />;
  return <img key={item.item_id} src={source} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
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

function YouTubeZone({ zone }: { zone: WebPlayerLayout['zones'][number] }) {
  const parsed = zone.zone_type === 'WEB' || zone.zone_type === 'RSS' ? parseYouTubeUrl(typeof zone.config.url === 'string' ? zone.config.url : typeof zone.config.source_url === 'string' ? zone.config.source_url : '') : null;
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
            PlayerState?: { PLAYING: number };
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
          if (!cancelled && status !== 'ready') {
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
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }}>
      {parsed?.previewUrl && (
        <img
          src={parsed.previewUrl}
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(10px)', transform: 'scale(1.08)', opacity: status === 'ready' ? 0.15 : 0.35 }}
        />
      )}

      <div ref={playerRef} style={{ position: 'absolute', inset: 0, opacity: status === 'ready' ? 1 : 0, transition: 'opacity 200ms ease' }} />

      {status !== 'ready' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center', color: '#fff', background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.8))' }}>
          <div style={{ maxWidth: '90%' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8 }}>
              {parsed?.label || 'YouTube'}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '1.1rem', fontWeight: 600 }}>
              {status === 'error' ? 'Preview gagal dimuat' : 'Memuat preview'}
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', opacity: 0.8 }}>
              {errorMessage || 'Mencoba membuka embed YouTube yang sesuai.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UrlZone({ zone }: { zone: WebPlayerLayout['zones'][number] }) {
  const url = typeof zone.config.url === 'string' ? zone.config.url : typeof zone.config.source_url === 'string' ? zone.config.source_url : '';
  if (!url) return <div style={{ width: '100%', height: '100%', background: '#000' }} />;
  const parsed = parseYouTubeUrl(url);

  if (parsed) {
    return <YouTubeZone zone={zone} />;
  }

  const embeddedUrl = resolveEmbeddedUrl(url);

  return (
    <iframe
      key={zone.id}
      src={embeddedUrl}
      title={zone.name}
      loading="eager"
      referrerPolicy="no-referrer"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      style={{ width: '100%', height: '100%', border: 0, background: '#000' }}
    />
  );
}

export default function WebPlayerLayoutView({ layout, loadMedia }: WebPlayerLayoutViewProps) {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: layout.background_color, position: 'relative' }}>
      {layout.zones.map((zone) => {
        const style = {
          position: 'absolute' as const,
          left: `${(zone.x / layout.width) * 100}%`, top: `${(zone.y / layout.height) * 100}%`,
          width: `${(zone.width / layout.width) * 100}%`, height: `${(zone.height / layout.height) * 100}%`,
          zIndex: zone.z_index,
          overflow: 'hidden',
        };
        if (zone.zone_type === 'MEDIA') return <div key={zone.id} style={style}><MediaZone zone={zone} loadMedia={loadMedia} /></div>;
        if (zone.zone_type === 'CLOCK') return <div key={zone.id} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><ClockDisplay config={zone.config} /></div>;
        if (zone.zone_type === 'TEXT') {
          const text = String(zone.config.text || zone.name);
          const backgroundColor = typeof zone.config.background_color === 'string' ? zone.config.background_color : '#000000';
          const fontFamily = typeof zone.config.font_family === 'string' ? zone.config.font_family : 'ui-sans-serif, system-ui, sans-serif';
          const fontSize = Number(zone.config.font_size) || 56;

          return (
            <div key={zone.id} style={{ ...style, overflow: 'hidden' }}>
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
          return <div key={zone.id} style={style}><UrlZone zone={zone} /></div>;
        }
        return <div key={zone.id} style={{ ...style, background: '#000' }} />;
      })}
    </div>
  );
}
