/**
 * Full-screen pager.
 *
 * Every module (and the closing footer) becomes a 100svh slide. A single wheel
 * notch, swipe, arrow key or nav click advances exactly one module. Changing
 * modules runs a particle transition: the outgoing text dissolves into dots,
 * the track slides, and the particles recompose into the incoming module's
 * text. Glyph targets are cached during idle so transitions never rasterise on
 * the main thread.
 *
 * Slides taller than the viewport fall back to internal scrolling; the pager
 * only advances once the slide reaches its scroll boundary.
 */

import { SECTION_TEXT_SELECTOR } from './assembly';
import { rasterizeText, type GlyphPoint } from './textRaster';
import { readThemeColors } from './theme';

type Rgb = [number, number, number];

interface SlideCache {
  elements: HTMLElement[];
  points: GlyphPoint[];
}

interface TransitionParticle {
  sx: number;
  sy: number;
  mx: number;
  my: number;
  ex: number;
  ey: number;
  size: number;
  color: string;
  delay: number;
}

export interface PagerHandle {
  active: boolean;
}

const HERO_TEXT_SELECTOR = [
  '.hero-title .line > span',
  '.hero-sub',
  '.eyebrow span',
  '.btn-text b',
  '.btn-text small',
  '.meta-item small',
  '.meta-item b',
  '.scroll-cue span',
].join(',');

const QUOTE_TEXT_SELECTOR = [
  '#quote-text',
  '.qt-command',
  '.qt-prompt-line',
  '.qt-meta',
  '.qt-title',
  '.qt-state',
  '.quote-refresh',
].join(',');

const FOOTER_TEXT_SELECTOR = [
  '#ticker-track span',
  '.footer-copy',
  '.footer-credits a',
  '.footer-filings a',
  '.footer-top',
].join(',');

const SLIDE_TEXT_SELECTOR = [
  SECTION_TEXT_SELECTOR,
  HERO_TEXT_SELECTOR,
  QUOTE_TEXT_SELECTOR,
  FOOTER_TEXT_SELECTOR,
].join(',');

const TRANSITION_MS = 1100;
const REVEAL_AT = 0.86;
const POINT_BUDGET = 1800;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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
  const { mix, ink } = readThemeColors();
  return {
    accent: mixRgb(accent, mix, 0.18),
    ink,
    light: mixRgb(accent, mix, 0.62),
  };
};

const allocate = (groups: GlyphPoint[][], budget: number): GlyphPoint[] => {
  const total = groups.reduce((sum, group) => sum + group.length, 0);
  if (total === 0) return [];

  const scale = total > budget ? budget / total : 1;
  const points: GlyphPoint[] = [];

  for (const group of groups) {
    const take = Math.min(
      group.length,
      Math.max(16, Math.round(group.length * scale)),
    );
    if (take >= group.length) {
      points.push(...group);
      continue;
    }
    shuffle(group);
    points.push(...group.slice(0, take));
  }

  if (points.length > budget) {
    shuffle(points);
    points.length = budget;
  }

  return shuffle(points);
};

export function initPager(): PagerHandle {
  const main = document.getElementById('main');
  if (!main || document.documentElement.classList.contains('pager')) {
    return { active: false };
  }

  document.documentElement.classList.add('pager');

  const slides = Array.from(
    main.querySelectorAll<HTMLElement>(':scope > section, :scope > .slide-footer'),
  );
  if (slides.length < 2) {
    document.documentElement.classList.remove('pager');
    return { active: false };
  }

  const reduced = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const count = slides.length;
  const navLinks = Array.from(
    document.querySelectorAll<HTMLElement>('[data-nav]'),
  );
  const railDots = Array.from(
    document.querySelectorAll<HTMLElement>('[data-rail]'),
  );
  const header = document.getElementById('site-header');
  const progressBar = document.querySelector<HTMLElement>(
    '#scroll-progress-bar',
  );

  const caches = new Map<HTMLElement, SlideCache>();
  let cacheQueue: HTMLElement[] = [];

  let index = 0;
  let busy = false;
  let wheelLocked = false;
  let wheelTimer = 0;
  let resizeTimer = 0;
  let touchStartY = 0;
  let touchStartX = 0;
  let touchCandidate = false;
  let touchSlide: HTMLElement | null = null;

  /* ------------------------------------------------------------- text cache */

  const collectTargets = (slide: HTMLElement): HTMLElement[] =>
    Array.from(
      slide.querySelectorAll<HTMLElement>(SLIDE_TEXT_SELECTOR),
    ).filter((element) => {
      if (!element.textContent?.trim()) return false;
      if (element.closest('[aria-hidden="true"]')) return false;

      const rect = element.getBoundingClientRect();
      return rect.width >= 3 && rect.height >= 3;
    });

  const buildCache = (slide: HTMLElement): SlideCache => {
    const elements = collectTargets(slide);
    const slideRect = slide.getBoundingClientRect();
    const scroll = slide.scrollTop;
    const groups: GlyphPoint[][] = [];

    for (const element of elements) {
      element.classList.add('pager-text');
      const points = rasterizeText(element);
      if (points.length > 0) groups.push(points);
    }

    const points = allocate(groups, POINT_BUDGET).map((point) => ({
      x: point.x - slideRect.left,
      y: point.y - slideRect.top + scroll,
    }));

    return { elements, points };
  };

  const buildNextCache = () => {
    const slide = cacheQueue.shift();
    if (!slide) return;
    caches.set(slide, buildCache(slide));
    if (cacheQueue.length > 0) scheduleCacheBuild();
  };

  const scheduleCacheBuild = () => {
    const host = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
    };
    if (host.requestIdleCallback) {
      host.requestIdleCallback(buildNextCache, { timeout: 1200 });
    } else {
      window.setTimeout(buildNextCache, 60);
    }
  };

  const ensureCache = (slide: HTMLElement): SlideCache => {
    const cached = caches.get(slide);
    if (cached) return cached;
    const built = buildCache(slide);
    caches.set(slide, built);
    return built;
  };

  /* ------------------------------------------------------------ transition */

  const hideText = (from: number, to: number) => {
    slides[from].classList.add('is-dissolving');
    slides[to].classList.add('is-dissolving');
    return () => {
      slides[from].classList.remove('is-dissolving');
      slides[to].classList.remove('is-dissolving');
    };
  };

  const runParticleTransition = (
    from: number,
    to: number,
    done: () => void,
  ) => {
    if (reduced) {
      done();
      return;
    }

    const outgoing = ensureCache(slides[from]);
    const incoming = ensureCache(slides[to]);
    const fromScroll = slides[from].scrollTop;
    const toScroll = slides[to].scrollTop;

    const outPoints = outgoing.points;
    const inPoints = incoming.points;
    if (outPoints.length === 0 || inPoints.length === 0) {
      done();
      return;
    }

    const total = Math.max(outPoints.length, inPoints.length);

    document.body.classList.add('is-paging');

    // Hide both text sets while their glyph dots are on the move.
    const restore = hideText(from, to);

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const canvas = document.createElement('canvas');
    canvas.className = 'pager-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    document.body.append(canvas);

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      canvas.remove();
      restore();
      done();
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const palette = readPalette();
    const countPoints = Math.min(POINT_BUDGET, total);
    const particles: TransitionParticle[] = [];

    for (let i = 0; i < countPoints; i += 1) {
      const out = outPoints[i % outPoints.length];
      const into = inPoints[i % inPoints.length];
      const roll = Math.random();
      const color =
        roll < 0.62
          ? palette.accent
          : roll < 0.94
            ? palette.ink
            : palette.light;

      particles.push({
        sx: out.x,
        sy: out.y - fromScroll,
        mx: Math.random() * width,
        my: Math.random() * height,
        ex: into.x,
        ey: into.y - toScroll,
        size: 1 + Math.random() * 1.1,
        color: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
        delay: Math.random() * 0.08,
      });
    }

    let frame = 0;
    let fallback = 0;
    let finished = false;
    let revealed = false;
    const start = performance.now();

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
      if (!revealed) {
        revealed = true;
        restore();
      }
      document.body.classList.remove('is-paging');
      canvas.classList.add('is-fading');
      window.setTimeout(() => canvas.remove(), 260);
      done();
    };

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      restore();
    };

    const easeInOut = (value: number) =>
      value < 0.5
        ? 4 * value * value * value
        : 1 - Math.pow(-2 * value + 2, 3) / 2;

    const frameStep = (now: number) => {
      const t = clamp((now - start) / TRANSITION_MS, 0, 1);

      if (t >= REVEAL_AT) reveal();
      if (t >= 1) {
        finish();
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (const particle of particles) {
        const dissolve = clamp((t - particle.delay) / 0.4, 0, 1);
        const converge = clamp((t - 0.42 - particle.delay * 0.4) / 0.44, 0, 1);
        const easedDissolve = 1 - Math.pow(1 - dissolve, 3);
        const easedConverge = easeInOut(converge);

        let x = particle.sx + (particle.mx - particle.sx) * easedDissolve;
        let y = particle.sy + (particle.my - particle.sy) * easedDissolve;
        if (converge > 0) {
          x = particle.mx + (particle.ex - particle.mx) * easedConverge;
          y = particle.my + (particle.ey - particle.my) * easedConverge;
        }

        let alpha = 0.25 + 0.75 * Math.min(1, dissolve * 2);
        if (converge > 0) alpha = 0.75 + 0.25 * easedConverge;
        if (t > 0.9) alpha *= 1 - (t - 0.9) / 0.1;
        if (alpha <= 0.01) continue;

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
      frame = requestAnimationFrame(frameStep);
    };

    fallback = window.setTimeout(finish, TRANSITION_MS + 500);
    frame = requestAnimationFrame(frameStep);
  };

  /* ----------------------------------------------------------------- state */

  const applyTransform = (animate: boolean) => {
    if (!animate) main.classList.add('is-instant');
    main.style.transform = `translate3d(0, ${-index * 100}%, 0)`;
    if (!animate) {
      void main.offsetHeight;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => main.classList.remove('is-instant')),
      );
    }
  };

  const updateState = () => {
    const slide = slides[index];
    const id = slide.id;

    for (const link of navLinks) {
      const active = link.dataset.nav === id;
      link.classList.toggle('is-active', active);
      link.setAttribute('aria-current', active ? 'location' : 'false');
    }
    for (const dot of railDots) {
      dot.classList.toggle('is-active', dot.dataset.rail === id);
    }

    document.body.classList.toggle('is-past-hero', index > 0);
    document.body.classList.toggle(
      'is-at-bottom',
      index === slides.length - 1,
    );
    header?.classList.toggle('is-scrolled', index > 0);

    if (progressBar) {
      progressBar.style.width = `${(index / Math.max(1, slides.length - 1)) * 100}%`;
    }

    if (window.location.hash !== `#${id}`) {
      history.replaceState(null, '', `#${id}`);
    }

    // Keep off-screen modules out of the tab order and the accessibility tree.
    slides.forEach((slideElement, slideIndex) => {
      if ('inert' in slideElement) {
        slideElement.inert = slideIndex !== index;
      }
    });
  };

  const goTo = (next: number) => {
    if (next < 0 || next >= count || next === index || busy) return;

    const from = index;
    index = next;
    applyTransform(true);
    updateState();

    busy = true;
    runParticleTransition(from, next, () => {
      busy = false;
    });
  };

  /* ------------------------------------------------------------- gestures */

  const canScroll = (slide: HTMLElement, direction: number): boolean => {
    const max = slide.scrollHeight - slide.clientHeight;
    // Ignore a few pixels of decorative overflow (giant background type).
    if (max <= 24) return false;
    return direction > 0
      ? slide.scrollTop < max - 2
      : slide.scrollTop > 2;
  };

  window.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || event.defaultPrevented) return;
      const delta = event.deltaY;
      if (Math.abs(delta) < 3) return;

      const direction = delta > 0 ? 1 : -1;

      if (busy) {
        event.preventDefault();
        return;
      }

      const slide = slides[index];
      if (canScroll(slide, direction)) return;

      event.preventDefault();
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        wheelLocked = false;
      }, 220);

      if (wheelLocked) return;
      wheelLocked = true;
      goTo(index + direction);
    },
    { passive: false },
  );

  window.addEventListener(
    'touchstart',
    (event) => {
      if (busy || event.touches.length !== 1) {
        touchCandidate = false;
        touchSlide = null;
        return;
      }
      const touch = event.touches[0];
      touchStartY = touch.clientY;
      touchStartX = touch.clientX;
      touchSlide = slides[index];
      touchCandidate = false;
    },
    { passive: true },
  );

  window.addEventListener(
    'touchmove',
    (event) => {
      if (!touchSlide || busy) return;
      const touch = event.touches[0];
      const dy = touchStartY - touch.clientY;
      const dx = touchStartX - touch.clientX;

      if (Math.abs(dy) < 12 || Math.abs(dy) <= Math.abs(dx)) {
        touchCandidate = false;
        return;
      }

      const direction = dy > 0 ? 1 : -1;
      if (canScroll(touchSlide, direction)) {
        touchCandidate = false;
        return;
      }

      touchCandidate = true;
      if (event.cancelable) event.preventDefault();
    },
    { passive: false },
  );

  window.addEventListener(
    'touchend',
    (event) => {
      if (!touchCandidate || !touchSlide) {
        touchCandidate = false;
        return;
      }

      const touch = event.changedTouches[0];
      const dy = touchStartY - touch.clientY;
      const dx = touchStartX - touch.clientX;
      touchCandidate = false;
      touchSlide = null;

      if (Math.abs(dy) > 52 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        goTo(index + (dy > 0 ? 1 : -1));
      }
    },
    { passive: true },
  );

  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey) return;

    const target = event.target instanceof Element ? event.target : null;
    if (
      target?.closest(
        'input, textarea, select, [contenteditable="true"], [role="scrollbar"]',
      )
    ) {
      return;
    }
    if (event.key === ' ' && target?.closest('button, a')) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'PageDown':
        event.preventDefault();
        goTo(index + 1);
        break;
      case 'ArrowUp':
      case 'PageUp':
        event.preventDefault();
        goTo(index - 1);
        break;
      case ' ':
        event.preventDefault();
        goTo(index + (event.shiftKey ? -1 : 1));
        break;
      case 'Home':
        event.preventDefault();
        goTo(0);
        break;
      case 'End':
        event.preventDefault();
        goTo(count - 1);
        break;
      default:
        break;
    }
  });

  document.addEventListener('click', (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const anchor = (event.target as Element | null)?.closest(
      'a[href^="#"]',
    ) as HTMLAnchorElement | null;
    if (!anchor) return;

    const id = anchor.getAttribute('href')?.slice(1);
    if (!id) return;

    const next = slides.findIndex((slide) => slide.id === id);
    if (next < 0) return;

    event.preventDefault();
    goTo(next);
  });

  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      main.classList.add('is-instant');
      applyTransform(false);
      caches.clear();
      cacheQueue = slides.slice();
      scheduleCacheBuild();
    }, 200);
  });

  /* ----------------------------------------------------------------- boot */

  let initial = slides.findIndex(
    (slide) => `#${slide.id}` === window.location.hash,
  );
  if (initial < 0) initial = 0;
  index = initial;

  applyTransform(false);
  updateState();

  cacheQueue = slides.slice();
  scheduleCacheBuild();

  return { active: true };
}
