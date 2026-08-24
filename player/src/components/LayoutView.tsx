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
          return (
            <div key={zone.id} className="absolute overflow-hidden" style={style}>
              <TextMarquee text={String(zone.config.text || zone.name)} />
            </div>
          );
        }
        return <div key={zone.id} className="absolute bg-black" style={style} />;
      })}
    </div>
  );
}
