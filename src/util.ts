import type { Rgb } from './theme';

/**
 * Small shared helpers used by the config loader, renderer, canvas effects
 * and interactions. Everything here is dependency-free except the `Rgb`
 * tuple type, which lives in `theme.ts`.
 */

/** Zero-pad a number: `pad(3)` → `"03"`. */
export const pad = (value: number, length = 2): string =>
  String(value).padStart(length, '0');

/**
 * Whole calendar days between an ISO date (`YYYY-MM-DD`) and today, in the
 * visitor's local time zone. Returns 0 for an invalid date.
 */
export const daysSince = (iso: string): number => {
  const start = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;

  const now = new Date();
  const startDay = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((nowDay - startDay) / 86_400_000);
};

/** Clamp a number into the inclusive `[min, max]` range. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Random float in `[min, max)`. */
export const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min);

/** Twoπ, used by every canvas animation. */
export const TAU = Math.PI * 2;

/** Cubic ease-out shared by the canvas flight animations. */
export const easeOutCubic = (value: number): number => 1 - Math.pow(1 - value, 3);

/** In-place Fisher–Yates shuffle; returns the same array for chaining. */
export const shuffle = <T>(items: T[]): T[] => {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
};

/**
 * Parse `#rgb` / `#rrggbb` into an RGB triplet; invalid input falls back to
 * the provided default so a bad config value can never break a canvas.
 */
export const hexToRgb = (hex: string | undefined, fallback: Rgb): Rgb => {
  if (!hex) return fallback;

  let value = hex.trim().replace(/^#/, '');
  if (value.length === 3) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('');
  }
  if (!/^[0-9a-f]{6}$/i.test(value)) return fallback;

  const numeric = Number.parseInt(value, 16);
  return [(numeric >> 16) & 255, (numeric >> 8) & 255, numeric & 255];
};

/** Linear mix of two colors: amount `0` → from, `1` → to. */
export const mixRgb = (from: Rgb, to: Rgb, amount: number): Rgb => [
  Math.round(from[0] + (to[0] - from[0]) * amount),
  Math.round(from[1] + (to[1] - from[1]) * amount),
  Math.round(from[2] + (to[2] - from[2]) * amount),
];

/**
 * Greedy, character-based text wrapping for the canvas rasterisers. Breaks
 * per visible glyph (CJK-safe) and trims the leading space of each wrapped
 * line, mirroring how the DOM lays out the same paragraph.
 */
export const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    if (!paragraph) continue;

    let line = '';
    for (const char of Array.from(paragraph)) {
      const next = line + char;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = char.trimStart();
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }

  return lines;
};
