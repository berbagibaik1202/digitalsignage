import type { CSSProperties } from 'react';

interface TextMarqueeProps {
  text: string;
  style?: CSSProperties;
}

function getMarqueeDurationSeconds(text: string): number {
  return Math.max(8, Math.min(30, Math.max(text.length * 0.35, 8)));
}

export default function TextMarquee({ text, style }: TextMarqueeProps) {
  const displayText = text.trim() || ' ';
  const durationSeconds = getMarqueeDurationSeconds(displayText);

  return (
    <div className="text-marquee" aria-label={displayText} style={style}>
      <div
        className="text-marquee__track"
        style={{ animationDuration: `${durationSeconds}s` }}
      >
        <span className="text-marquee__content">{displayText}</span>
        <span className="text-marquee__content" aria-hidden="true">
          {displayText}
        </span>
      </div>
    </div>
  );
}
