/**
 * Page-entry text assembly.
 *
 * As soon as the boot screen starts leaving, an opaque intro overlay hides the
 * real page so it is never visible before the effect. The overlay first shows
 * a breathing dot matrix, then traces the **outline** of every visible text
 * element with particles, then fills the glyphs and finally dissolves into the
 * real DOM text.
 *
 * The effect is skipped when the boot is skipped or reduced motion is on.
 */

import { rasterizeTextDetail, type GlyphPoint } from './textRaster';
import { readThemeColors } from './theme';

type Rgb = [number, number, number];

interface IntroParticle {
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  fx: number;
  fy: number;
  size: number;
  alpha: number;
  phase: number;
  delay: number;
  fillDelay: number;
  color: string;
  glow: boolean;
  trail: boolean;
}

interface IntroRun {
  start: () => void;
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
  const { mix } = readThemeColors();
  return {
    accent,
    ink: hexToRgb(style.getPropertyValue('--ink'), [237, 237, 228]),
    light: mixRgb(accent, mix, 0.55),
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

const shuffle = <T>(items: T[]): T[] => {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
};

/** Collect glyph + outline groups for every text element on the first screen. */
const collectGroups = (width: number, height: number) => {
  const fill: GlyphPoint[][] = [];
  const outline: GlyphPoint[][] = [];
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(TEXT_SELECTOR),
  );

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

    const detail = rasterizeTextDetail(element);
    if (detail.fill.length === 0) continue;

    fill.push(detail.fill);
    outline.push(detail.outline);
  }

  return { fill, outline };
};

/** Pick at most `budget` points, keeping every element represented. */
const allocate = (groups: GlyphPoint[][], budget: number): GlyphPoint[] => {
  const total = groups.reduce((sum, group) => sum + group.length, 0);
  if (total === 0) return [];

  const scale = total > budget ? budget / total : 1;
  const targets: GlyphPoint[] = [];

  for (const group of groups) {
    const take = Math.min(
      group.length,
      Math.max(18, Math.round(group.length * scale)),
    );
    if (take >= group.length) {
      targets.push(...group);
      continue;
    }
    shuffle(group);
    targets.push(...group.slice(0, take));
  }

  if (targets.length > budget) {
    shuffle(targets);
    targets.length = budget;
  }

  return shuffle(targets);
};

const prepareIntro = (): IntroRun | null => {
  const overlay = document.createElement('div');
  overlay.className = 'page-intro';

  const canvas = document.createElement('canvas');
  canvas.className = 'page-intro-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  overlay.append(canvas);
  document.body.append(overlay);
  document.body.classList.add('is-intro');

  const cleanup = () => {
    overlay.remove();
    document.body.classList.remove('is-intro');
  };

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    cleanup();
    return null;
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

  const groups = collectGroups(width, height);
  const budget = narrow ? 2200 : 4200;
  const fillTargets = allocate(groups.fill, budget);

  if (fillTargets.length === 0) {
    cleanup();
    return null;
  }

  const outlineTargets = allocate(
    groups.outline,
    Math.max(600, Math.round(budget * 0.7)),
  );
  const outlineSource =
    outlineTargets.length > 0 ? outlineTargets : fillTargets;

  const palette = readPalette();
  const count = fillTargets.length;
  const aspect = width / Math.max(1, height);
  const columns = Math.max(8, Math.round(Math.sqrt(count * aspect)));
  const rows = Math.ceil(count / columns);
  const cellWidth = width / columns;
  const cellHeight = height / rows;

  const particles: IntroParticle[] = fillTargets.map((fillPoint, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const roll = Math.random();
    const color =
      roll < 0.58 ? palette.accent : roll < 0.94 ? palette.ink : palette.light;
    const outlinePoint = outlineSource[index % outlineSource.length];

    return {
      sx:
        (column + 0.5) * cellWidth +
        randomBetween(-cellWidth * 0.18, cellWidth * 0.18),
      sy:
        (row + 0.5) * cellHeight +
        randomBetween(-cellHeight * 0.18, cellHeight * 0.18),
      ox: outlinePoint.x + randomBetween(-0.9, 0.9),
      oy: outlinePoint.y + randomBetween(-0.9, 0.9),
      fx: fillPoint.x,
      fy: fillPoint.y,
      size: randomBetween(narrow ? 0.75 : 0.85, narrow ? 1.5 : 1.75),
      alpha: randomBetween(0.45, 1),
      phase: Math.random() * Math.PI * 2,
      delay: randomBetween(0, 0.3),
      fillDelay: randomBetween(0, 0.2),
      color: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
      glow: Math.random() < 0.05,
      trail: Math.random() < 0.38,
    };
  });

  const matrixHold = narrow ? 380 : 460;
  const outlineFlight = narrow ? 620 : 780;
  const outlineHold = narrow ? 240 : 320;
  const fillAt = matrixHold + outlineFlight + outlineHold;
  const fillFlight = narrow ? 560 : 700;
  const fillHold = narrow ? 220 : 260;
  const fadeAt = fillAt + fillFlight + fillHold;

  let frame = 0;
  let started = false;
  let finished = false;
  let startTime = 0;

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    overlay.classList.add('is-leaving');
    document.body.classList.remove('is-intro');
    window.dispatchEvent(new CustomEvent('page:intro-end'));
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
    if ((tailX !== 0 || tailY !== 0) && particle.trail) {
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

  const drawFlight = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    particle: IntroParticle,
    local: number,
  ) => {
    const eased = easeOutCubic(local);
    const x = fromX + (toX - fromX) * eased;
    const y = fromY + (toY - fromY) * eased;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.hypot(dx, dy) || 1;
    const tail = (1 - eased) * 10;

    drawParticle(
      x,
      y,
      particle,
      particle.alpha * Math.min(1, 0.25 + local * 1.6),
      (dx / length) * tail,
      (dy / length) * tail,
    );
  };

  const tick = (now: number) => {
    const elapsed = now - startTime;

    if (elapsed >= fadeAt) {
      finish();
      return;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    for (const particle of particles) {
      // 1. Full-screen dot matrix, breathing before the trace begins.
      if (elapsed < matrixHold) {
        const pulse = 0.62 + 0.38 * Math.sin(now * 0.005 + particle.phase);
        drawParticle(
          particle.sx,
          particle.sy,
          particle,
          particle.alpha * 0.34 * pulse,
        );
        continue;
      }

      // 2. Fly out to the glyph outlines, tracing the first screen.
      const outlineStart = matrixHold + particle.delay * 1000;
      if (elapsed < outlineStart + outlineFlight) {
        const span = Math.max(0.2, outlineFlight - particle.delay * 1000);
        const local = clamp((elapsed - outlineStart) / span, 0, 1);
        drawFlight(
          particle.sx,
          particle.sy,
          particle.ox,
          particle.oy,
          particle,
          local,
        );
        continue;
      }

      // 3. Hold the outline: a wireframe made of particles.
      if (elapsed < fillAt) {
        const wobble = Math.sin(now * 0.004 + particle.phase) * 0.9;
        drawParticle(
          particle.ox + wobble,
          particle.oy,
          particle,
          particle.alpha * 0.92,
        );
        continue;
      }

      // 4. Fill the glyphs from the outline.
      const fillStart = fillAt + particle.fillDelay * 1000;
      if (elapsed < fillStart + fillFlight) {
        const span = Math.max(0.2, fillFlight - particle.fillDelay * 1000);
        const local = clamp((elapsed - fillStart) / span, 0, 1);
        drawFlight(
          particle.ox,
          particle.oy,
          particle.fx,
          particle.fy,
          particle,
          local,
        );
        continue;
      }

      // 5. Hold the filled text until the overlay fades into the page.
      drawParticle(particle.fx, particle.fy, particle, particle.alpha);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    frame = requestAnimationFrame(tick);
  };

  window.dispatchEvent(new CustomEvent('page:intro-start'));

  return {
    start: () => {
      if (started || finished) return;
      started = true;
      startTime = performance.now();
      frame = requestAnimationFrame(tick);
    },
  };
};

export function initPageIntro() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let run: IntroRun | null = null;
  let fallbackTimer = 0;
  let pendingStart = false;

  // The page is covered as soon as the boot starts leaving, so the real page
  // is never visible between the boot and the particle trace. The heavy text
  // rasterisation is deferred a frame so the boot wipe stays smooth.
  window.addEventListener(
    'boot:exit',
    (event) => {
      const detail = (event as CustomEvent<{ skipped?: boolean }>).detail;
      if (detail?.skipped) return;

      window.setTimeout(() => {
        run = prepareIntro();
        if (run) {
          fallbackTimer = window.setTimeout(() => run?.start(), 2600);
        }
        if (pendingStart) run?.start();
      }, 40);
    },
    { once: true },
  );

  window.addEventListener(
    'boot:done',
    (event) => {
      window.clearTimeout(fallbackTimer);
      const detail = (event as CustomEvent<{ skipped?: boolean }>).detail;
      if (detail?.skipped) return;
      if (run) run.start();
      else pendingStart = true;
    },
    { once: true },
  );
}
