import { useEffect, useState } from 'react';
import { getCachedMediaUrl } from '../services/media-cache';
import { getMediaUrl } from '../services/player';

interface MediaItem {
  item_id: number;
  media_url: string;
  mime_type: string;
  duration_seconds: number;
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

function MediaZone({ zone }: { zone: Zone }) {
  const [index, setIndex] = useState(0);
  const [source, setSource] = useState<string | null>(null);
  const item = zone.items[index];

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
    const timer = setTimeout(() => setIndex((current) => {
      if (current < zone.items.length - 1) return current + 1;
      return zone.loop ? 0 : current;
    }), item.duration_seconds * 1000);
    return () => clearTimeout(timer);
  }, [item, zone.items.length, zone.loop]);

  if (!item || !source) return <div className="w-full h-full bg-black" />;
  const next = () => setIndex((current) => current < zone.items.length - 1 ? current + 1 : zone.loop ? 0 : current);

  if (item.mime_type.startsWith('video/')) {
    return <video key={item.item_id} src={source} autoPlay muted className="w-full h-full object-cover" onEnded={next} />;
  }
  if (item.mime_type.startsWith('audio/')) {
    return <audio key={item.item_id} src={source} autoPlay onEnded={next} />;
  }
  return <img key={item.item_id} src={source} alt="" className="w-full h-full object-cover" />;
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
          return <div key={zone.id} className="absolute overflow-hidden" style={style}><MediaZone zone={zone} /></div>;
        }
        if (zone.zone_type === 'CLOCK') {
          return <div key={zone.id} className="absolute flex items-center justify-center text-white text-4xl" style={style}>{new Date().toLocaleTimeString()}</div>;
        }
        if (zone.zone_type === 'TEXT') {
          return <div key={zone.id} className="absolute flex items-center justify-center text-white" style={style}>{String(zone.config.text || zone.name)}</div>;
        }
        return <div key={zone.id} className="absolute bg-black" style={style} />;
      })}
    </div>
  );
}