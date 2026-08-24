export type TransitionEffect =
  | 'none'
  | 'fade'
  | 'zoom'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down';

export const DEFAULT_IMAGE_TRANSITION_MS = 700;

interface TransitionDurationSource {
  transition_duration_ms?: number | string | null;
}

export function isImageMime(mimeType?: string | null): boolean {
  return typeof mimeType === 'string' && mimeType.startsWith('image/');
}

export function resolveTransitionDurationMs(
  currentItem?: TransitionDurationSource | null,
  nextItem?: TransitionDurationSource | null
): number {
  const candidates = [currentItem?.transition_duration_ms, nextItem?.transition_duration_ms];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) {
      return Math.round(value);
    }
  }

  return DEFAULT_IMAGE_TRANSITION_MS;
}

export function normalizeTransitionEffect(value?: string | null): TransitionEffect {
  const effect = (value || '').toLowerCase();

  if (effect === 'fade' || effect === 'zoom' || effect === 'slide-left' || effect === 'slide-right' || effect === 'slide-up' || effect === 'slide-down') {
    return effect;
  }

  return 'fade';
}

export function getTransitionClass(effect: TransitionEffect, phase: 'enter' | 'exit'): string {
  const phaseSuffix = phase === 'enter' ? 'in' : 'out';

  switch (effect) {
    case 'zoom':
      return `media-transition-zoom-${phaseSuffix}`;
    case 'slide-left':
      return `media-transition-slide-left-${phaseSuffix}`;
    case 'slide-right':
      return `media-transition-slide-right-${phaseSuffix}`;
    case 'slide-up':
      return `media-transition-slide-up-${phaseSuffix}`;
    case 'slide-down':
      return `media-transition-slide-down-${phaseSuffix}`;
    case 'none':
    case 'fade':
    default:
      return `media-transition-fade-${phaseSuffix}`;
  }
}
