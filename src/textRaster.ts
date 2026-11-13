/**
 * Text → glyph pixel sampler shared by the entry animation and the per-section
 * assembly: draw an element's text with its own computed font metrics onto a
 * temporary canvas, then return one point per visible glyph pixel in viewport
 * coordinates.
 */

export interface GlyphPoint {
  x: number;
  y: number;
}

export interface RasterOptions {
  /** Sample even when the element is currently faded out (opacity: 0). */
  ignoreOpacity?: boolean;
}

/** Filled glyph pixels plus the boundary pixels that outline them. */
interface RasterDetail {
  fill: GlyphPoint[];
  outline: GlyphPoint[];
}

export const extractText = (root: HTMLElement): string => {
  let text = '';

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
      return;
    }
    if (node.nodeName === 'BR') {
      text += '\n';
      return;
    }
    node.childNodes.forEach(walk);
  };

  walk(root);

  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
};

const wrapText = (
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

/**
 * Rasterise one element's text with its computed font and content box, then
 * return glyph pixels in viewport coordinates.
 */
const rasterizeDetail = (
  element: HTMLElement,
  options: RasterOptions = {},
): RasterDetail => {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);

  const empty: RasterDetail = { fill: [], outline: [] };
  if (style.display === 'none' || style.visibility === 'hidden') return empty;
  if (!options.ignoreOpacity && style.opacity === '0') return empty;

  const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
  const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
  const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
  const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;

  const contentWidth =
    rect.width - borderLeft - borderRight - paddingLeft - paddingRight;
  const contentHeight =
    rect.height - borderTop - borderBottom - paddingTop - paddingBottom;

  if (contentWidth < 2 || contentHeight < 2) return empty;

  const text = extractText(element);
  if (!text) return empty;

  const fontSize = Number.parseFloat(style.fontSize) || 16;
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.5;
  const fontWeight = style.fontWeight || '400';
  const fontFamily = style.fontFamily || 'sans-serif';

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(contentWidth));
  canvas.height = Math.max(1, Math.ceil(contentHeight));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return empty;

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';

  const align =
    style.textAlign === 'center'
      ? 'center'
      : style.textAlign === 'right'
        ? 'right'
        : 'left';
  ctx.textAlign = align;

  const drawX =
    align === 'center'
      ? contentWidth / 2
      : align === 'right'
        ? contentWidth
        : 0;
  const leading = Math.max(0, (lineHeight - fontSize) / 2);
  const lines = style.whiteSpace.includes('nowrap')
    ? [text]
    : wrapText(ctx, text, contentWidth);

  lines.forEach((line, index) => {
    const y = index * lineHeight + leading;
    if (y > contentHeight) return;
    ctx.fillText(line, drawX, y);
  });

  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return empty;
  }

  const originX = rect.left + borderLeft + paddingLeft;
  const originY = rect.top + borderTop + paddingTop;
  const fill: GlyphPoint[] = [];
  const outline: GlyphPoint[] = [];
  const threshold = 110;

  const isOpaque = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;
    return pixels[(y * canvas.width + x) * 4 + 3] >= threshold;
  };

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (!isOpaque(x, y)) continue;

      const point = { x: originX + x + 0.5, y: originY + y + 0.5 };
      fill.push(point);

      if (
        !isOpaque(x - 1, y) ||
        !isOpaque(x + 1, y) ||
        !isOpaque(x, y - 1) ||
        !isOpaque(x, y + 1)
      ) {
        outline.push(point);
      }
    }
  }

  return { fill, outline };
};

/** Filled glyph pixels for an element, in viewport coordinates. */
export const rasterizeText = (
  element: HTMLElement,
  options: RasterOptions = {},
): GlyphPoint[] => rasterizeDetail(element, options).fill;

/** Filled glyph pixels plus the boundary stroke used by the intro. */
export const rasterizeTextDetail = (
  element: HTMLElement,
  options: RasterOptions = {},
): { fill: GlyphPoint[]; outline: GlyphPoint[] } =>
  rasterizeDetail(element, options);
