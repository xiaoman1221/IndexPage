/**
 * Page-entry text assembly.
 *
 * Once the boot screen finishes, the first screen starts as a full-page dot
 * matrix. Its particles then fly into the glyph pixels of every visible text
 * element, so the copy assembles as a particle image. When the motion settles,
 * the particles dissolve and the real DOM text fades in in the same place.
 *
 * The effect is skipped when the boot is skipped or reduced motion is on.
 */

type Rgb = [number, number, number];

interface GlyphPoint {
  x: number;
  y: number;
}

interface IntroParticle {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  size: number;
  alpha: number;
  delay: number;
  color: string;
  glow: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

const hexToRgb = (hex: string | undefined, fallback: Rgb): Rgb => {
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

const mixRgb = (from: Rgb, to: Rgb, amount: number): Rgb => [
  Math.round(from[0] + (to[0] - from[0]) * amount),
  Math.round(from[1] + (to[1] - from[1]) * amount),
  Math.round(from[2] + (to[2] - from[2]) * amount),
];

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

const readPalette = () => {
  const style = getComputedStyle(document.documentElement);
  const accent = hexToRgb(style.getPropertyValue('--acid'), [230, 255, 46]);
  return {
    accent,
    ink: hexToRgb(style.getPropertyValue('--ink'), [237, 237, 228]),
    light: mixRgb(accent, [255, 255, 255], 0.55),
  };
};

const TEXT_SELECTOR = [
  '#brand-name',
  '#brand-sub',
  '.nav-link i',
  '.nav-link span',
  '.nav-link small',
  '#clock',
  '#header-cta-label',
  '.eyebrow span',
  '.hero-title .line > span',
  '.hero-sub',
  '.btn-text b',
  '.btn-text small',
  '.meta-item small',
  '.meta-item b',
  '.scroll-cue span',
  '#sigil-lat',
  '#sigil-lng',
  '#sigil-alt',
  '#sigil-ref',
  '.rail-dot span',
  '.rail-dot em',
  '#rail-line1',
  '#rail-line2',
  '#rail-code',
].join(',');

const extractText = (root: HTMLElement): string => {
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
const rasterizeText = (element: HTMLElement): GlyphPoint[] => {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);

  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0'
  ) {
    return [];
  }

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

  if (contentWidth < 2 || contentHeight < 2) return [];

  const text = extractText(element);
  if (!text) return [];

  const fontSize = Number.parseFloat(style.fontSize) || 16;
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.5;
  const fontWeight = style.fontWeight || '400';
  const fontFamily = style.fontFamily || 'sans-serif';

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(contentWidth));
  canvas.height = Math.max(1, Math.ceil(contentHeight));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

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
    return [];
  }

  const originX = rect.left + borderLeft + paddingLeft;
  const originY = rect.top + borderTop + paddingTop;
  const points: GlyphPoint[] = [];

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[(y * canvas.width + x) * 4 + 3] < 110) continue;
      points.push({ x: originX + x + 0.5, y: originY + y + 0.5 });
    }
  }

  return points;
};

const collectTextPoints = (
  width: number,
  height: number,
  budget: number,
): GlyphPoint[] => {
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(TEXT_SELECTOR),
  );
  const groups: GlyphPoint[][] = [];
  let total = 0;

  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (rect.width < 3 || rect.height < 3) continue;
    if (
      rect.bottom < 0 ||
      rect.top > height ||
      rect.right < 0 ||
      rect.left > width
    ) {
      continue;
    }

    const points = rasterizeText(element);
    if (points.length === 0) continue;

    groups.push(points);
    total += points.length;
  }

  if (total === 0) return [];

  const scale = total > budget ? budget / total : 1;
  const targets: GlyphPoint[] = [];

  for (const points of groups) {
    const take = Math.min(
      points.length,
      Math.max(20, Math.round(points.length * scale)),
    );

    if (take >= points.length) {
      targets.push(...points);
      continue;
    }

    for (let index = points.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [points[index], points[swap]] = [points[swap], points[index]];
    }
    targets.push(...points.slice(0, take));
  }

  if (targets.length > budget) {
    for (let index = targets.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [targets[index], targets[swap]] = [targets[swap], targets[index]];
    }
    targets.length = budget;
  }

  // Randomise arrival order so the text does not assemble left-to-right.
  for (let index = targets.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [targets[index], targets[swap]] = [targets[swap], targets[index]];
  }

  return targets;
};

const playIntro = () => {
  const overlay = document.createElement('div');
  overlay.className = 'page-intro';

  const canvas = document.createElement('canvas');
  canvas.className = 'page-intro-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  overlay.append(canvas);
  document.body.append(overlay);
  document.body.classList.add('is-intro');

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    overlay.remove();
    document.body.classList.remove('is-intro');
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const narrow = width < 720;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const targets = collectTextPoints(width, height, narrow ? 3000 : 6500);
  if (targets.length === 0) {
    overlay.remove();
    document.body.classList.remove('is-intro');
    return;
  }

  const palette = readPalette();
  const count = targets.length;
  const aspect = width / Math.max(1, height);
  const columns = Math.max(8, Math.round(Math.sqrt(count * aspect)));
  const rows = Math.ceil(count / columns);
  const cellWidth = width / columns;
  const cellHeight = height / rows;

  const particles: IntroParticle[] = targets.map((target, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const roll = Math.random();
    const color =
      roll < 0.58 ? palette.accent : roll < 0.94 ? palette.ink : palette.light;

    return {
      sx:
        (column + 0.5) * cellWidth +
        randomBetween(-cellWidth * 0.18, cellWidth * 0.18),
      sy:
        (row + 0.5) * cellHeight +
        randomBetween(-cellHeight * 0.18, cellHeight * 0.18),
      tx: target.x,
      ty: target.y,
      size: randomBetween(narrow ? 1.05 : 1.15, narrow ? 2.1 : 2.4),
      alpha: randomBetween(0.45, 1),
      delay: randomBetween(0, 0.35),
      color: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
      glow: Math.random() < 0.07,
    };
  });

  const matrixHold = narrow ? 600 : 750;
  const flight = narrow ? 1150 : 1500;
  const hold = narrow ? 260 : 320;
  const fadeAt = matrixHold + flight + hold;
  const start = performance.now();

  let finished = false;
  let frame = 0;

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    overlay.classList.add('is-leaving');
    document.body.classList.remove('is-intro');
    window.setTimeout(() => overlay.remove(), 760);
  };

  const drawParticle = (
    x: number,
    y: number,
    particle: IntroParticle,
    alpha: number,
    tailX = 0,
    tailY = 0,
  ) => {
    if (tailX !== 0 || tailY !== 0) {
      ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = particle.size * 0.8;
      ctx.beginPath();
      ctx.moveTo(x - tailX, y - tailY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    if (particle.glow) {
      ctx.globalAlpha = alpha * 0.15;
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        x - particle.size * 2.5,
        y - particle.size * 2.5,
        particle.size * 5,
        particle.size * 5,
      );
    }

    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.fillRect(
      x - particle.size / 2,
      y - particle.size / 2,
      particle.size,
      particle.size,
    );
  };

  const tick = (now: number) => {
    const elapsed = now - start;

    if (elapsed >= fadeAt) {
      finish();
      return;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    for (const particle of particles) {
      if (elapsed < matrixHold) {
        // Full-screen dot matrix, breathing before it collapses into text.
        const pulse =
          0.62 + 0.38 * Math.sin(now * 0.005 + particle.delay * 18);
        drawParticle(
          particle.sx,
          particle.sy,
          particle,
          particle.alpha * 0.34 * pulse,
        );
        continue;
      }

      const span = Math.max(0.3, (flight - particle.delay * 1000) / 1000);
      const local = clamp(
        (elapsed - matrixHold - particle.delay * 1000) / (span * 1000),
        0,
        1,
      );
      const eased = easeOutCubic(local);
      const x = particle.sx + (particle.tx - particle.sx) * eased;
      const y = particle.sy + (particle.ty - particle.sy) * eased;

      const dx = particle.tx - particle.sx;
      const dy = particle.ty - particle.sy;
      const length = Math.hypot(dx, dy) || 1;
      const tail = (1 - eased) * 12;

      drawParticle(
        x,
        y,
        particle,
        particle.alpha * Math.min(1, 0.25 + local * 1.6),
        (dx / length) * tail,
        (dy / length) * tail,
      );
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);
};

export function initPageIntro() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let started = false;

  window.addEventListener(
    'boot:done',
    (event) => {
      if (started) return;
      const detail = (event as CustomEvent<{ skipped?: boolean }>).detail;
      if (detail?.skipped) return;

      started = true;
      playIntro();
    },
    { once: true },
  );
}
