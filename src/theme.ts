/**
 * Theme-aware colors for the canvas effects.
 *
 * The page follows the OS appearance through `prefers-color-scheme`; the CSS
 * exposes the few canvas colors as custom properties so the drawing code can
 * read the same values instead of hard-coding a dark palette.
 */

export type Rgb = [number, number, number];

const DARK_INK: Rgb = [237, 237, 228];
const DARK_MIX: Rgb = [255, 255, 255];

const parseTriplet = (value: string, fallback: Rgb): Rgb => {
  const parts = value
    .split(',')
    .map((part) => Number.parseFloat(part.trim()))
    .filter((part) => Number.isFinite(part));
  if (parts.length !== 3) return fallback;
  return [parts[0], parts[1], parts[2]];
};

export interface ThemeColors {
  /** Ink used by the background terrain / swarm / tech words. */
  ink: Rgb;
  /** Tint the accent is mixed with for particle highlights. */
  mix: Rgb;
  /** Color of the Hitokoto particle text. */
  quote: string;
}

export const readThemeColors = (): ThemeColors => {
  const style = getComputedStyle(document.documentElement);
  return {
    ink: parseTriplet(style.getPropertyValue('--scene-ink'), DARK_INK),
    mix: parseTriplet(style.getPropertyValue('--mix'), DARK_MIX),
    quote: style.getPropertyValue('--quote-particle').trim() || '#ffffff',
  };
};

/** `[237, 237, 228]` → `237, 237, 228` (for `rgba()` strings). */
export const rgbTriplet = ([r, g, b]: Rgb): string => `${r}, ${g}, ${b}`;

export const watchColorScheme = (callback: () => void) => {
  window
    .matchMedia('(prefers-color-scheme: light)')
    .addEventListener('change', callback);
};
