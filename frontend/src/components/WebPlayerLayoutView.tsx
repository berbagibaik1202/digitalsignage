import { useEffect, useState } from 'react';
import ClockDisplay from './ClockDisplay';

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
        if (zone.zone_type === 'TEXT') return <div key={zone.id} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{String(zone.config.text || zone.name)}</div>;
        return <div key={zone.id} style={{ ...style, background: '#000' }} />;
      })}
    </div>
  );
}
