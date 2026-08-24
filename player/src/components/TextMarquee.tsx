import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

interface TextMarqueeProps {
  text: string;
  style?: CSSProperties;
}

const MARQUEE_SPEED_PX_PER_SECOND = 90;

function getMarqueeDurationSeconds(distancePx: number, text: string): number {
  if (distancePx > 0) {
    return Math.max(8, Math.min(60, distancePx / MARQUEE_SPEED_PX_PER_SECOND));
  }
  return Math.max(8, Math.min(30, Math.max(text.length * 0.35, 8)));
}

export default function TextMarquee({ text, style }: TextMarqueeProps) {
  const displayText = text.trim() || ' ';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measuredText = textRef.current;
    if (!container || !measuredText) return;

    const update = () => {
      setContainerWidth(Math.ceil(container.getBoundingClientRect().width));
      setTextWidth(Math.ceil(measuredText.getBoundingClientRect().width));
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(measuredText);

    return () => observer.disconnect();
  }, [displayText, style?.fontFamily, style?.fontSize, style?.fontWeight]);

  const marqueeDistance = containerWidth + textWidth;
  const durationSeconds = getMarqueeDurationSeconds(marqueeDistance, displayText);
  const trackStyle = {
    ['--marquee-distance' as any]: `${marqueeDistance}px`,
    animationDuration: `${durationSeconds}s`,
  } as CSSProperties;

  return (
    <div ref={containerRef} className="text-marquee" aria-label={displayText} style={style}>
      <div className="text-marquee__track" style={trackStyle}>
        <span ref={textRef} className="text-marquee__content">{displayText}</span>
        <span className="text-marquee__spacer" aria-hidden="true" style={{ width: `${containerWidth}px` }} />
        <span className="text-marquee__content" aria-hidden="true">{displayText}</span>
      </div>
    </div>
  );
}
