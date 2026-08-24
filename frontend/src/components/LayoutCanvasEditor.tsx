import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Maximize2, Move } from 'lucide-react';

type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export interface ZoneRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BackgroundZone extends ZoneRect {
  id: number | string;
  name: string;
  zone_type: string;
  z_index?: number;
}

interface LayoutCanvasEditorProps {
  layoutWidth: number;
  layoutHeight: number;
  backgroundColor: string;
  value: ZoneRect;
  onChange: (next: ZoneRect) => void;
  backgroundZones?: BackgroundZone[];
  label?: string;
  minWidth?: number;
  minHeight?: number;
  snap?: number;
}

interface InteractionState {
  mode: 'move' | 'resize';
  handle?: ResizeHandle;
  startX: number;
  startY: number;
  startRect: ZoneRect;
}

const HANDLE_POINTS: Array<{ handle: ResizeHandle; className: string; cursor: string }> = [
  { handle: 'nw', className: 'left-[-6px] top-[-6px]', cursor: 'nwse-resize' },
  { handle: 'n', className: 'left-1/2 top-[-6px] -translate-x-1/2', cursor: 'ns-resize' },
  { handle: 'ne', className: 'right-[-6px] top-[-6px]', cursor: 'nesw-resize' },
  { handle: 'e', className: 'right-[-6px] top-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  { handle: 'se', className: 'right-[-6px] bottom-[-6px]', cursor: 'nwse-resize' },
  { handle: 's', className: 'left-1/2 bottom-[-6px] -translate-x-1/2', cursor: 'ns-resize' },
  { handle: 'sw', className: 'left-[-6px] bottom-[-6px]', cursor: 'nesw-resize' },
  { handle: 'w', className: 'left-[-6px] top-1/2 -translate-y-1/2', cursor: 'ew-resize' },
];

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function snapValue(value: number, snap?: number) {
  if (!snap || snap <= 1) return value;
  return Math.round(value / snap) * snap;
}

function clampRect(
  rect: ZoneRect,
  layoutWidth: number,
  layoutHeight: number,
  minWidth: number,
  minHeight: number,
) {
  const boundedWidth = clamp(rect.width, minWidth, layoutWidth);
  const boundedHeight = clamp(rect.height, minHeight, layoutHeight);
  const boundedX = clamp(rect.x, 0, Math.max(0, layoutWidth - boundedWidth));
  const boundedY = clamp(rect.y, 0, Math.max(0, layoutHeight - boundedHeight));

  return {
    x: boundedX,
    y: boundedY,
    width: boundedWidth,
    height: boundedHeight,
  };
}

function resizeRect(
  rect: ZoneRect,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  layoutWidth: number,
  layoutHeight: number,
  minWidth: number,
  minHeight: number,
) {
  let next = { ...rect };

  if (handle.includes('w')) {
    next.x = rect.x + deltaX;
    next.width = rect.width - deltaX;
  }
  if (handle.includes('e')) {
    next.width = rect.width + deltaX;
  }
  if (handle.includes('n')) {
    next.y = rect.y + deltaY;
    next.height = rect.height - deltaY;
  }
  if (handle.includes('s')) {
    next.height = rect.height + deltaY;
  }

  next = clampRect(next, layoutWidth, layoutHeight, minWidth, minHeight);
  return next;
}

export default function LayoutCanvasEditor({
  layoutWidth,
  layoutHeight,
  backgroundColor,
  value,
  onChange,
  backgroundZones = [],
  label = 'Active zone',
  minWidth = 120,
  minHeight = 80,
  snap = 10,
}: LayoutCanvasEditorProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);

  useEffect(() => {
    if (!interaction) return;
    const currentInteraction = interaction;

    function handlePointerMove(event: PointerEvent) {
      const stage = stageRef.current;
      if (!stage) return;

      const bounds = stage.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;

      const scaleX = layoutWidth / bounds.width;
      const scaleY = layoutHeight / bounds.height;
      const deltaX = (event.clientX - currentInteraction.startX) * scaleX;
      const deltaY = (event.clientY - currentInteraction.startY) * scaleY;

      const next =
        currentInteraction.mode === 'move'
          ? clampRect(
              {
                ...currentInteraction.startRect,
                x: currentInteraction.startRect.x + deltaX,
                y: currentInteraction.startRect.y + deltaY,
              },
              layoutWidth,
              layoutHeight,
              minWidth,
              minHeight,
            )
          : resizeRect(
              currentInteraction.startRect,
              currentInteraction.handle!,
              deltaX,
              deltaY,
              layoutWidth,
              layoutHeight,
              minWidth,
              minHeight,
            );

      onChange({
        x: snapValue(next.x, snap),
        y: snapValue(next.y, snap),
        width: snapValue(next.width, snap),
        height: snapValue(next.height, snap),
      });
    }

    function handlePointerUp() {
      setInteraction(null);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [interaction, layoutHeight, layoutWidth, minHeight, minWidth, onChange, snap]);

  function beginInteraction(
    mode: 'move' | 'resize',
    event: ReactPointerEvent<HTMLElement>,
    handle?: ResizeHandle,
  ) {
    event.preventDefault();
    event.stopPropagation();

    setInteraction({
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startRect: value,
    });
  }

  const activeStyle = {
    left: `${(value.x / layoutWidth) * 100}%`,
    top: `${(value.y / layoutHeight) * 100}%`,
    width: `${(value.width / layoutWidth) * 100}%`,
    height: `${(value.height / layoutHeight) * 100}%`,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
        <span>Drag the box to move it. Use the handles to resize.</span>
        <span>
          {Math.round(value.x)},{Math.round(value.y)} | {Math.round(value.width)} x {Math.round(value.height)}
        </span>
      </div>

      <div
        ref={stageRef}
        className="relative w-full overflow-hidden rounded-2xl border border-gray-700 bg-black select-none"
        style={{
          aspectRatio: `${layoutWidth} / ${layoutHeight}`,
          backgroundColor,
          touchAction: 'none',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148, 163, 184, 0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.14) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {backgroundZones.map((zone) => (
          <div
            key={zone.id}
            className="absolute rounded-lg border border-white/10 bg-white/5 text-[10px] text-white/70"
            style={{
              left: `${(zone.x / layoutWidth) * 100}%`,
              top: `${(zone.y / layoutHeight) * 100}%`,
              width: `${(zone.width / layoutWidth) * 100}%`,
              height: `${(zone.height / layoutHeight) * 100}%`,
              zIndex: zone.z_index ?? 0,
            }}
          >
            <div className="px-2 py-1">
              <div className="truncate font-medium">{zone.name}</div>
              <div className="truncate text-white/50">{zone.zone_type}</div>
            </div>
          </div>
        ))}

        <div
          className="absolute rounded-xl border-2 border-sky-400 bg-sky-400/15 shadow-[0_0_0_1px_rgba(56,189,248,0.45)]"
          style={activeStyle}
          onPointerDown={(event) => beginInteraction('move', event)}
        >
          <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-slate-950/80 px-2 py-1 text-[11px] font-medium text-sky-200 backdrop-blur">
            <Move className="h-3 w-3" />
            <span className="truncate">{label}</span>
          </div>

          <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-slate-950/80 px-2 py-1 text-[11px] font-medium text-slate-200 backdrop-blur">
            <Maximize2 className="h-3 w-3" />
            <span>{Math.round(value.width)} x {Math.round(value.height)}</span>
          </div>

          {HANDLE_POINTS.map((handle) => (
            <button
              key={handle.handle}
              type="button"
              aria-label={`Resize ${handle.handle}`}
              className={`absolute h-3.5 w-3.5 rounded-full border border-sky-100 bg-sky-400 shadow ${handle.className}`}
              style={{ cursor: handle.cursor, touchAction: 'none' }}
              onPointerDown={(event) => beginInteraction('resize', event, handle.handle)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
