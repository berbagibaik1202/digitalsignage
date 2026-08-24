import { useEffect, useRef, useState } from 'react';

export type ClockFormat = 'HH:MM:SS' | 'HH:MM' | 'HH:MM:SS + DATE';

interface ClockConfig {
  format?: string | null;
  font_family?: string | null;
  font_size?: number | string | null;
  font_weight?: number | string | null;
}

interface NormalizedClockConfig {
  format: ClockFormat;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
}

const DEFAULT_FONT_FAMILY = 'ui-sans-serif, system-ui, sans-serif';
const DEFAULT_FONT_SIZE = 72;
const DEFAULT_FONT_WEIGHT = 700;
const DEFAULT_FORMAT: ClockFormat = 'HH:MM:SS';

function parseNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

export function normalizeClockConfig(config?: unknown): NormalizedClockConfig {
  const raw = (config && typeof config === 'object') ? config as ClockConfig : {};
  const format = String(raw.format || '').toUpperCase().trim();

  return {
    format: format === 'HH:MM' || format === 'HH:MM:SS + DATE' || format === 'HH:MM:SS'
      ? format as ClockFormat
      : DEFAULT_FORMAT,
    fontFamily: typeof raw.font_family === 'string' && raw.font_family.trim() ? raw.font_family : DEFAULT_FONT_FAMILY,
    fontSize: parseNumber(raw.font_size, DEFAULT_FONT_SIZE, 16, 240),
    fontWeight: parseNumber(raw.font_weight, DEFAULT_FONT_WEIGHT, 100, 900),
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatClockValue(date: Date, format: ClockFormat): string {
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  const datePart = `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;

  switch (format) {
    case 'HH:MM':
      return `${hours}:${minutes}`;
    case 'HH:MM:SS + DATE':
      return `${hours}:${minutes}:${seconds} ${datePart}`;
    case 'HH:MM:SS':
    default:
      return `${hours}:${minutes}:${seconds}`;
  }
}

function ClockDigit({ char }: { char: string }) {
  const [animating, setAnimating] = useState(false);
  const previousChar = useRef(char);

  useEffect(() => {
    if (previousChar.current === char) return;

    previousChar.current = char;
    setAnimating(true);
    const timeout = setTimeout(() => setAnimating(false), 280);

    return () => clearTimeout(timeout);
  }, [char]);

  if (/\d/.test(char)) {
    return (
      <span className={`clock-digit${animating ? ' clock-digit-changing' : ''}`}>
        {char}
      </span>
    );
  }

  return <span className="clock-separator">{char === ' ' ? '\u00A0' : char}</span>;
}

export default function ClockDisplay({ config }: { config?: unknown }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const normalized = normalizeClockConfig(config);
  const text = formatClockValue(now, normalized.format);

  return (
    <span
      className="clock-display"
      style={{
        color: '#ffffff',
        fontFamily: normalized.fontFamily,
        fontSize: `${normalized.fontSize}px`,
        fontWeight: normalized.fontWeight,
      }}
      aria-label={text}
    >
      {Array.from(text).map((char, index) => (
        <ClockDigit key={index} char={char} />
      ))}
    </span>
  );
}
