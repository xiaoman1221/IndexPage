/**
 * Section text assembly.
 *
 * The entry animation assembles the first screen from particles. This module
 * extends the same language to every following section: when a section enters
 * the viewport its text is rasterised into glyph pixels, the real text is
 * hidden for a moment, particles fly in and settle exactly on the glyphs, then
 * the particles fade out while the text fades back in.
 *
 * The effect is skipped for `prefers-reduced-motion` and can be disabled from
 * `config.json` (`assembly.enabled: false`).
 */

import { rasterizeText, type GlyphPoint } from './textRaster';
import { readThemeColors } from './theme';

type Rgb = [number, number, number];

interface AssemblyOptions {
  enabled?: boolean;
  max?: number;
}

interface AssemblyParticle {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  size: number;
  color: string;
  alpha: number;
  delay: number;
  glow: boolean;
}

interface SaveStyle {
  element: HTMLElement;
  style: string | null;
}

export interface AssemblyRun {
  finish: () => void;
}

/* Elements whose text takes part in the assembly. Kept explicit so decorative
   copy and nodes with their own particle renderer (the quote) are untouched. */
export const SECTION_TEXT_SELECTOR = [
  '.sec-index',
  '.sec-titles h2 > span',
  '.sec-titles h2 > small',
  '.sec-note',
  '.display-quote',
  '.body-copy',
  '.stat-number',
  '.stat sup',
  '.stat small',
  '.id-panel-head span',
  '.spec-list dt',
  '.spec-list dd',
  '.id-code',
  '.id-avatar-caption',
  '.field-lead p',
  '.field-lead span',
  '.tech-stack-label',
  '.tech-chip',
  '.cap-index',
  '.cap-title',
  '.cap-item h3 small',
  '.cap-main p',
  '.cap-tags span',
  '.cap-meter em',
  '.works-quote',
  '.work-no',
  '.work-serial',
  '.work-tags span',
  '.work-body h3',
  '.work-body p',
  '.work-foot span',
  '.work-client',
  '.track-hint',
  '.carousel-count',
  '.contact-kicker',
  '.mail-link span',
  '.mail-link i',
  '.contact-line',
  '.contact-no',
  '.contact-label',
  '.contact-card b',
  '.contact-card i',
  '.work-foot i',
].join(',');

const SECTION_IDS = ['profile', 'field', 'works', 'contact'];

const FLIGHT = 900;
const MAX_DELAY = 220;
const HOLD = 180;
const FADE = 480;

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

const shuffle = <T>(items: T[]): T[] => {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
};

const readPalette = () => {
  const style = getComputedStyle(document.documentElement);
  const accent = hexToRgb(style.getPropertyValue('--acid'), [230, 255, 46]);
  const { mix } = readThemeColors();
  return {
    accent: mixRgb(accent, mix, 0.16),
    ink: hexToRgb(style.getPropertyValue('--ink'), [237, 237, 228]),
    light: mixRgb(accent, mix, 0.62),
  };
};

const collectTargets = (section: HTMLElement): HTMLElement[] => {
  const viewport = window.innerHeight;

  return Array.from(
    section.querySelectorAll<HTMLElement>(SECTION_TEXT_SELECTOR),
  ).filter((element) => {
    if (!element.textContent?.trim()) return false;
    if (element.closest('[aria-hidden="true"]')) return false;
    // The quote terminal drives its own typewriter + particle halo.
    if (element.closest('.quote-terminal')) return false;

    const rect = element.getBoundingClientRect();
    if (rect.width < 3 || rect.height < 3) return false;
    // Assemble the coming screen as well: the heading enters first, the copy
    // right below it is hidden and assembled before it is scrolled into view.
    if (rect.bottom < -viewport || rect.top > viewport * 2) return false;

    return true;
  });
};

/** Finalise reveal transitions so every target sits at its resting position. */
const prepareStyles = (
  section: HTMLElement,
  targets: HTMLElement[],
): SaveStyle[] => {
  const saved = new Map<HTMLElement, string | null>();
  const remember = (element: HTMLElement) => {
    if (saved.has(element)) return;
    saved.set(element, element.getAttribute('style'));
  };

  const reveals = new Set<HTMLElement>();
  for (const target of targets) {
    for (
      let parent: HTMLElement | null = target;
      parent && parent !== section.parentElement;
      parent = parent.parentElement
    ) {
      if (parent.hasAttribute('data-reveal')) reveals.add(parent);
      if (parent === section) break;
    }
  }

  // Every reveal element that wraps a target is snapped to its resting state:
  // opacity/transform animations may still be running when the section enters,
  // and the glyph positions have to be measured at the final layout.
  for (const reveal of reveals) {
    remember(reveal);
    reveal.classList.add('is-in');
    reveal.style.setProperty('transition', 'none', 'important');
    reveal.style.setProperty('transform', 'none', 'important');
  }

  for (const target of targets) {
    remember(target);
    target.style.setProperty('opacity', '0', 'important');
    target.style.setProperty('transition', 'none', 'important');
  }

  // Force layout so the rasterisation below reads the final positions.
  void section.getBoundingClientRect();

  return Array.from(saved, ([element, style]) => ({ element, style }));
};

const restoreStyles = (saved: SaveStyle[]) => {
  for (const { element, style } of saved) {
    if (style === null) element.removeAttribute('style');
    else element.setAttribute('style', style);
  }
};

const allocate = (
  groups: GlyphPoint[][],
  budget: number,
): GlyphPoint[] => {
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

const createOverlay = () => {
  const canvas = document.createElement('canvas');
  canvas.className = 'assembly-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.max(1, Math.round(viewportWidth * dpr));
  canvas.height = Math.max(1, Math.round(viewportHeight * dpr));

  document.body.append(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    canvas.remove();
    return null;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { canvas, ctx, viewportWidth, viewportHeight };
};

/**
 * Play the assembly for one section. Returns `null` when there is nothing to
 * animate (empty section, missing canvas).
 */
const startRun = (
  section: HTMLElement,
  budget: number,
): AssemblyRun | null => {
  const targets = collectTargets(section);
  if (targets.length === 0) return null;

  const saved = prepareStyles(section, targets);

  const groups: GlyphPoint[][] = [];
  for (const target of targets) {
    const points = rasterizeText(target, { ignoreOpacity: true });
    if (points.length > 0) groups.push(points);
  }

  const overlay = createOverlay();
  if (!overlay || groups.length === 0) {
    restoreStyles(saved);
    overlay?.canvas.remove();
    return null;
  }

  const { canvas, ctx, viewportWidth, viewportHeight } = overlay;
  const scroll0 = window.scrollY;
  const palette = readPalette();
  const points = allocate(groups, budget);

  const particles: AssemblyParticle[] = points.map((point) => {
    const roll = Math.random();
    const color =
      roll < 0.56
        ? palette.accent
        : roll < 0.94
          ? palette.ink
          : palette.light;

    return {
      sx: randomBetween(0, viewportWidth),
      sy: randomBetween(0, viewportHeight) + scroll0,
      tx: point.x,
      ty: point.y + scroll0,
      size: randomBetween(1, 2.1),
      color: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
      alpha: randomBetween(0.5, 1),
      delay: randomBetween(0, MAX_DELAY / 1000),
      glow: Math.random() < 0.07,
    };
  });

  let raf = 0;
  let done = false;
  const start = performance.now();
  const duration = FLIGHT + MAX_DELAY + HOLD;

  const draw = (elapsed: number) => {
    const scrollY = window.scrollY;
    ctx.clearRect(0, 0, viewportWidth, viewportHeight);
    ctx.globalCompositeOperation = 'lighter';

    for (const particle of particles) {
      const local = clamp(
        (elapsed - particle.delay * 1000) / FLIGHT,
        0,
        1,
      );
      const eased = 1 - Math.pow(1 - local, 3);
      const x = particle.sx + (particle.tx - particle.sx) * eased;
      const y = particle.sy + (particle.ty - particle.sy) * eased - scrollY;

      if (
        x < -4 ||
        x > viewportWidth + 4 ||
        y < -4 ||
        y > viewportHeight + 4
      ) {
        continue;
      }

      const alpha = particle.alpha * Math.min(1, local * 2.4);

      if (particle.glow) {
        ctx.globalAlpha = alpha * 0.12;
        ctx.fillStyle = particle.color;
        ctx.fillRect(
          x - particle.size * 2.4,
          y - particle.size * 2.4,
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
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    restoreStyles(saved);
    canvas.classList.add('is-fading');
    window.setTimeout(() => {
      canvas.remove();
    }, FADE);
  };

  const tick = (now: number) => {
    const elapsed = now - start;
    draw(Math.min(elapsed, FLIGHT + MAX_DELAY));

    if (elapsed < duration) {
      raf = requestAnimationFrame(tick);
      return;
    }
    raf = 0;
    finish();
  };

  raf = requestAnimationFrame(tick);

  return { finish };
};

export function initSectionAssembly(options: AssemblyOptions = {}) {
  if (options.enabled === false) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const budget = clamp(Math.round(options.max ?? 3200), 800, 8000);
  const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(
    (element): element is HTMLElement => Boolean(element),
  );
  if (sections.length === 0) return;

  const visible = new WeakMap<Element, boolean>();
  let active: AssemblyRun | null = null;

  const play = (section: HTMLElement) => {
    if (active) {
      active.finish();
      active = null;
    }
    active = startRun(section, budget);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const section = entry.target as HTMLElement;

        if (!entry.isIntersecting) {
          visible.set(section, false);
          continue;
        }

        if (visible.get(section)) continue;
        visible.set(section, true);
        play(section);
      }
    },
    // Bottom inset: wait until a sliver of the section is properly on screen,
    // so the section heading (which sits below the section's top padding) is
    // already visible when the assembly starts.
    { rootMargin: '0px 0px -15% 0px', threshold: 0 },
  );

  sections.forEach((section) => {
    visible.set(section, false);
    observer.observe(section);
  });
}

