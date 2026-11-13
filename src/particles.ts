/**
 * Image → particle field.
 *
 * Every content image is sampled into a grid of colored particles. The
 * particles assemble on first view, drift gently, scatter away from the
 * pointer and spring back. The visual reference is the particle/dissolve
 * language used across Arknights' official site and HUD.
 */

import { readThemeColors } from './theme';

const TAU = Math.PI * 2;
const MAX_SAMPLE = 480;
const MIN_QUALITY = 0.32;

type QualityTier = 'high' | 'medium' | 'low';

interface QualityProfile {
  tier: QualityTier;
  base: number;
  scale: number;
  sampleScale: number;
  dpr: number;
}

const detectQuality = (): QualityProfile => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 720;
  const dprCap = Math.min(window.devicePixelRatio || 1, 1.5);

  if (reduced) {
    return { tier: 'high', base: 1, scale: 1, sampleScale: 1, dpr: dprCap };
  }

  if (coarse || narrow) {
    if (cores >= 8 && memory >= 6) {
      return {
        tier: 'medium',
        base: 0.8,
        scale: 0.8,
        sampleScale: 0.9,
        dpr: Math.min(dprCap, 1.25),
      };
    }
    return {
      tier: 'low',
      base: 0.58,
      scale: 0.58,
      sampleScale: 0.8,
      dpr: Math.min(dprCap, 1),
    };
  }

  if (cores >= 8 && memory >= 8) {
    return { tier: 'high', base: 1, scale: 1, sampleScale: 1, dpr: dprCap };
  }

  if (cores >= 4) {
    return {
      tier: 'medium',
      base: 0.82,
      scale: 0.82,
      sampleScale: 0.9,
      dpr: Math.min(dprCap, 1.25),
    };
  }

  return {
    tier: 'low',
    base: 0.62,
    scale: 0.62,
    sampleScale: 0.8,
    dpr: Math.min(dprCap, 1),
  };
};

const quality = detectQuality();
const qualityRoot = document.documentElement;
qualityRoot.dataset.particleTier = quality.tier;
qualityRoot.dataset.particleScale = quality.scale.toFixed(2);

let fpsWindowStart = 0;
let fpsFrames = 0;
let lowStrikes = 0;
let highStrikes = 0;

const setQualityScale = (next: number) => {
  quality.scale = clamp(next, MIN_QUALITY, 1);
  qualityRoot.dataset.particleScale = quality.scale.toFixed(2);
};

const monitorQuality = (now: number) => {
  if (!fpsWindowStart) {
    fpsWindowStart = now;
    fpsFrames = 0;
    return;
  }

  fpsFrames += 1;
  const elapsed = now - fpsWindowStart;
  if (elapsed < 1200) return;

  const fps = (fpsFrames * 1000) / elapsed;
  fpsWindowStart = now;
  fpsFrames = 0;

  if (fps < 40) {
    lowStrikes += 1;
    highStrikes = 0;
    if (lowStrikes >= 2 && quality.scale > MIN_QUALITY) {
      setQualityScale(quality.scale - 0.12);
      lowStrikes = 0;
    }
  } else if (fps > 54) {
    highStrikes += 1;
    lowStrikes = 0;
    if (highStrikes >= 5 && quality.scale < 1) {
      setQualityScale(quality.scale + 0.05);
      highStrikes = 0;
    }
  } else {
    lowStrikes = 0;
    highStrikes = 0;
  }
};

const resetMonitor = () => {
  fpsWindowStart = 0;
  fpsFrames = 0;
  lowStrikes = 0;
  highStrikes = 0;
};

/** Pause every image particle canvas (used while the entry animation runs). */
export const setParticlesPaused = (value: boolean) => {
  paused = value;
  if (value) {
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    resetMonitor();
  } else {
    wake();
  }
};


interface Particle {
  x: number;
  y: number;
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  vx: number;
  vy: number;
  fromX: number;
  fromY: number;
  size: number;
  color: string;
  alpha: number;
  baseAlpha: number;
  phase: number;
  glow: boolean;
}

interface Candidate {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
  luma: number;
  weight: number;
  background: boolean;
}

export interface ParticleMorphOptions {
  enabled?: boolean;
  words?: string[];
  /** Seconds between word changes (scatter + gather + hold). */
  interval?: number;
  /** Seconds used to burst across the screen. */
  scatter?: number;
  /** Seconds used to fly back into the new word. */
  gather?: number;
  /** Seconds the word holds still after the gather completes. */
  hold?: number;
}

export interface ParticleImageOptions {
  max?: number;
  size?: number;
  interactive?: boolean;
  scatter?: number;
  blend?: 'source-over' | 'lighter';
  lumaCutoff?: number;
  fit?: 'cover' | 'contain';
  dotMatrix?: boolean;
  dotSpacing?: number;
  dotColor?: string;
  includeBackground?: boolean;
  morph?: ParticleMorphOptions;
}

export interface ParticleSettings extends ParticleImageOptions {
  enabled?: boolean;
  density?: number;
  hero?: ParticleImageOptions;
  avatar?: ParticleImageOptions;
  works?: ParticleImageOptions;
}

interface ResolvedOptions {
  max: number;
  size: number;
  interactive: boolean;
  scatter: number;
  blend: GlobalCompositeOperation;
  lumaCutoff: number;
  fit: 'cover' | 'contain';
  dotMatrix: boolean;
  dotSpacing: number;
  dotColor: string;
  includeBackground: boolean;
  morphWords: string[];
  morphInterval: number;
  morphScatter: number;
  morphGather: number;
}

type BuildResult = 'ok' | 'retry' | 'fail';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

type Rgb = [number, number, number];

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

/* --------------------------------------------------------------------------
   One shared animation loop
   -------------------------------------------------------------------------- */

const registry = new Set<ParticleImage>();
let frameRequest = 0;
let lastFrame = 0;
let paused = false;

const wake = () => {
  if (paused || frameRequest || document.hidden) return;
  lastFrame = performance.now();
  frameRequest = requestAnimationFrame(frame);
};

function frame(now: number): void {
  frameRequest = 0;
  const delta = clamp((now - lastFrame) / 1000, 0.008, 0.05) || 1 / 60;
  lastFrame = now;

  let needsMoreFrames = false;
  for (const item of registry) {
    if (item.tick(now / 1000, delta)) needsMoreFrames = true;
  }

  if (needsMoreFrames) {
    monitorQuality(now);
    wake();
  } else {
    resetMonitor();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    resetMonitor();
  } else {
    wake();
  }
});

/* --------------------------------------------------------------------------
   Particle image
   -------------------------------------------------------------------------- */

class ParticleImage {
  private readonly source: HTMLImageElement;
  private readonly image: HTMLImageElement;
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hoverTarget: HTMLElement | null;
  private readonly options: ResolvedOptions;
  private readonly reduced = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  private readonly canHover = window.matchMedia('(pointer: fine)').matches;

  private particles: Particle[] = [];
  private width = 0;
  private height = 0;
  private dpr = 1;
  private lastWidth = 0;
  private lastHeight = 0;

  private visible = false;
  private built = false;
  private failed = false;
  private staticDrawn = false;
  private building = false;
  private lastActive = -1;

  private pointerX = 0;
  private pointerY = 0;
  private pointerActive = false;
  private hovering = false;

  private morphIndex = -1;
  private morphClock = -1;
  private morphStart = -1;
  private morphing = false;
  private morphRequest = false;
  private pointerInRegion = false;

  private resizeTimer = 0;
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;

  constructor(
    source: HTMLImageElement,
    target: HTMLImageElement,
    container: HTMLElement,
    options: ParticleImageOptions = {},
  ) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas 2D is not available.');

    this.source = source;
    this.image = target;
    this.container = container;
    this.canvas = canvas;
    this.ctx = context;

    const morphWords =
      options.morph?.enabled === false
        ? []
        : (options.morph?.words ?? [])
            .map((word) => word.trim().toUpperCase())
            .filter(
              (word, index, list) =>
                word.length > 0 &&
                word.length <= 14 &&
                list.indexOf(word) === index,
            );

    const morphInterval = clamp(options.morph?.interval ?? 5, 2, 30);
    const morphHold = clamp(
      options.morph?.hold ?? 1.5,
      0,
      Math.max(0.1, morphInterval - 0.2),
    );
    const morphFlight = Math.max(0.4, morphInterval - morphHold);
    const morphScatter = clamp(
      options.morph?.scatter ?? morphFlight * 0.44,
      0.2,
      Math.max(0.2, morphFlight - 0.2),
    );
    const morphGather = clamp(
      options.morph?.gather ?? morphFlight - morphScatter,
      0.2,
      Math.max(0.2, morphFlight - morphScatter),
    );

    this.options = {
      max: Math.max(24, Math.round(options.max ?? 1000)),
      size: options.size ?? 1,
      interactive: options.interactive ?? true,
      scatter: options.scatter ?? 1.2,
      blend: options.blend ?? 'source-over',
      lumaCutoff: options.lumaCutoff ?? 24,
      fit: options.fit ?? 'cover',
      dotMatrix: options.dotMatrix ?? true,
      dotSpacing: clamp(options.dotSpacing ?? 10, 1, 24),
      dotColor: options.dotColor ?? '#ffffff',
      includeBackground: options.includeBackground ?? false,
      morphWords,
      morphInterval,
      morphScatter,
      morphGather,
    };
    const hero =
      target.closest('.hero') as HTMLElement | null;
    this.hoverTarget = this.options.interactive
      ? hero ??
        (target.closest('.work-card, .brand, .id-avatar') as HTMLElement | null) ??
        container
      : null;

    canvas.className = 'particle-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.append(canvas);
    container.classList.add('has-particles');

    this.bindPointer();

    this.resizeObserver = new ResizeObserver(() => this.queueResize());
    this.resizeObserver.observe(container);

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        this.visible = entries.some((entry) => entry.isIntersecting);
        if (this.visible) {
          this.buildNow();
          wake();
        }
      },
      { threshold: 0.01 },
    );
    this.intersectionObserver.observe(container);

    registry.add(this);

    const rect = container.getBoundingClientRect();
    if (rect.width > 2 && rect.bottom > 0 && rect.top < window.innerHeight) {
      this.visible = true;
      this.buildNow();
    }

    wake();
  }

  /* ---------------------------------------------------------------- public */

  tick(time: number, delta: number): boolean {
    if (!this.built || !this.visible || this.failed) return false;

    const active = this.activeCount();
    if (active !== this.lastActive) {
      this.lastActive = active;
      this.canvas.dataset.active = String(active);
    }

    if (this.reduced) {
      if (!this.staticDrawn) {
        this.staticDrawn = true;
        this.drawStatic(active);
        this.hideImage();
      }
      return false;
    }

    this.tickMorph(time);
    this.step(time, delta, active);
    this.draw(active);
    this.hideImage();
    return true;
  }

  /* ---------------------------------------------------------------- morph */

  private tickMorph(time: number) {
    const words = this.options.morphWords;
    if (words.length === 0) return;

    if (this.morphClock < 0) {
      this.morphClock = time;
      return;
    }

    const due = time - this.morphClock >= this.options.morphInterval;
    const requested = this.morphRequest;

    if (!due && !requested) return;
    this.morphRequest = false;

    // Hover can request an early change, but keep a short cooldown so moving
    // in and out of the region does not machine-gun the word cycle.
    if (requested && !due && time - this.morphClock < 1.2) return;

    this.morphClock = time;

    this.morphIndex = (this.morphIndex + 1) % words.length;
    const word = words[this.morphIndex];
    const targets = this.buildTextTargets(word);
    if (!targets) return;

    // Shuffle so every particle gets a well-spread letter pixel, even when
    // several particles are stacked on the same point.
    for (let index = targets.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [targets[index], targets[swap]] = [targets[swap], targets[index]];
    }

    for (let index = 0; index < this.particles.length; index += 1) {
      const target = targets[index % targets.length];
      const particle = this.particles[index];
      particle.fromX = particle.x;
      particle.fromY = particle.y;
      // Scatter all the way across the hero viewport before reassembling.
      particle.sx = randomBetween(0, this.width);
      particle.sy = randomBetween(0, this.height);
      particle.tx = target.x + randomBetween(-1.2, 1.2);
      particle.ty = target.y + randomBetween(-1.2, 1.2);
      particle.vx = 0;
      particle.vy = 0;
    }

    this.applyMorphColors();
    this.morphStart = time;
    this.morphing = true;
    this.container.classList.add('is-scattering');
    this.canvas.dataset.morph = word;
    wake();
  }

  /**
   * Theme palette for the default (pre-word) dot matrix, so the initial art
   * already follows the site accent instead of the source image colours.
   */
  private readThemePalette(): { base: Rgb; light: Rgb } {
    const style = getComputedStyle(document.documentElement);
    const accent = hexToRgb(style.getPropertyValue('--acid'), [230, 255, 46]);
    const { mix } = readThemeColors();
    return {
      base: mixRgb(accent, mix, 0.14),
      light: mixRgb(accent, mix, 0.66),
    };
  }

  /**
   * Recolour the field with the live theme accent while the word is flying,
   * so the scatter / reassembly stays on-brand instead of using image colours.
   */
  private applyMorphColors() {
    const style = getComputedStyle(document.documentElement);
    const accent = hexToRgb(style.getPropertyValue('--acid'), [230, 255, 46]);
    const ink = hexToRgb(style.getPropertyValue('--ink'), [237, 237, 228]);
    const { mix } = readThemeColors();
    // Lift the theme accent a little so the dots stay legible on either scheme.
    const theme = mixRgb(accent, mix, 0.18);
    const light = mixRgb(accent, mix, 0.62);

    for (const particle of this.particles) {
      const roll = Math.random();
      const color = roll < 0.24 ? ink : roll < 0.96 ? theme : light;
      particle.color = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      particle.baseAlpha = Math.max(particle.baseAlpha, 0.55);
      particle.glow = Math.random() < 0.05;
    }
  }

  /**
   * Rasterise a tech word onto the visible right-hand region of the hero and
   * turn its glyph pixels into particle targets in container coordinates.
   */
  private getWordRegion() {
    // Larger, slightly left of centre, and proportional to the hero size so
    // the word keeps its scale from laptop to 4K / portrait screens.
    const aspect = this.width / Math.max(1, this.height);
    const narrow = this.width < 720;
    const wide = aspect >= 1.4;
    const widthRatio = narrow ? 0.58 : wide ? 0.48 : 0.52;
    const heightRatio = narrow ? 0.38 : wide ? 0.46 : 0.42;
    const centerX = narrow ? 0.67 : wide ? 0.72 : 0.7;
    const centerY = 0.46;
    const regionW = clamp(this.width * widthRatio, 240, this.width * 0.92);
    const regionH = clamp(this.height * heightRatio, 140, this.height * 0.72);

    return {
      left: this.width * centerX - regionW / 2,
      top: this.height * centerY - regionH / 2,
      width: regionW,
      height: regionH,
    };
  }

  private buildTextTargets(word: string): Array<{ x: number; y: number }> | null {
    const region = this.getWordRegion();
    const regionW = region.width;
    const regionH = region.height;
    const left = region.left;
    const top = region.top;

    if (regionW < 80 || regionH < 40) return null;

    const sampleScale = 0.5;
    const sampleW = Math.max(24, Math.round(regionW * sampleScale));
    const sampleH = Math.max(24, Math.round(regionH * sampleScale));

    const sample = document.createElement('canvas');
    sample.width = sampleW;
    sample.height = sampleH;
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    if (!sampleCtx) return null;

    const family = '"JetBrains Mono", ui-monospace, monospace';
    let fontSize = sampleH * 0.66;
    sampleCtx.font = `700 ${fontSize}px ${family}`;

    const maxWidth = sampleW * 0.92;
    const measured = sampleCtx.measureText(word).width;
    if (measured > maxWidth) {
      fontSize *= maxWidth / measured;
      sampleCtx.font = `700 ${fontSize}px ${family}`;
    }

    sampleCtx.textAlign = 'center';
    sampleCtx.textBaseline = 'middle';
    sampleCtx.fillStyle = '#ffffff';
    sampleCtx.fillText(word, sampleW / 2, sampleH / 2 + fontSize * 0.03);

    let pixels: Uint8ClampedArray;
    try {
      pixels = sampleCtx.getImageData(0, 0, sampleW, sampleH).data;
    } catch {
      return null;
    }

    const points: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < sampleH; y += 1) {
      for (let x = 0; x < sampleW; x += 1) {
        if (pixels[(y * sampleW + x) * 4 + 3] < 128) continue;
        points.push({
          x: left + ((x + 0.5) / sampleW) * regionW,
          y: top + ((y + 0.5) / sampleH) * regionH,
        });
      }
    }

    return points.length >= 24 ? points : null;
  }

  private activeCount(): number {
    if (this.particles.length === 0) return 0;
    return Math.min(
      this.particles.length,
      Math.max(24, Math.round(this.particles.length * quality.scale)),
    );
  }

  /* ----------------------------------------------------------------- build */

  private buildNow() {
    if (this.built || this.failed || this.building) return;

    this.building = true;
    const run = () => {
      this.building = false;
      if (!this.visible || this.built || this.failed) return;

      const result = this.build();
      if (result === 'ok') {
        this.built = true;
        this.hideImage();
        wake();
      } else if (result === 'fail') {
        this.fail();
      }
    };

    const host = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
    };

    if (host.requestIdleCallback) {
      host.requestIdleCallback(run, { timeout: 600 });
    } else {
      window.setTimeout(run, 0);
    }
  }

  private build(): BuildResult {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const image = this.source;

    if (width < 2 || height < 2) return 'retry';
    if (!image.naturalWidth || !image.naturalHeight) return 'retry';

    const sampleW = clamp(
      Math.round(width * quality.sampleScale),
      24,
      MAX_SAMPLE,
    );
    const sampleH = clamp(
      Math.round((sampleW * height) / width),
      24,
      MAX_SAMPLE,
    );

    const sample = document.createElement('canvas');
    sample.width = sampleW;
    sample.height = sampleH;
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    if (!sampleCtx) return 'fail';

    const scale =
      this.options.fit === 'contain'
        ? Math.min(sampleW / image.naturalWidth, sampleH / image.naturalHeight)
        : Math.max(sampleW / image.naturalWidth, sampleH / image.naturalHeight);
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;

    sampleCtx.clearRect(0, 0, sampleW, sampleH);
    sampleCtx.drawImage(
      image,
      (sampleW - drawW) / 2,
      (sampleH - drawH) / 2,
      drawW,
      drawH,
    );

    let pixels: Uint8ClampedArray;
    try {
      pixels = sampleCtx.getImageData(0, 0, sampleW, sampleH).data;
    } catch {
      return 'fail';
    }

    const cutoff = this.options.lumaCutoff;
    const includeBackground = this.options.includeBackground;
    const lightTheme = window.matchMedia('(prefers-color-scheme: light)').matches;
    const lumaMap = new Float32Array(sampleW * sampleH);
    let opaquePixels = 0;
    let whitePixels = 0;

    for (let index = 0; index < lumaMap.length; index += 1) {
      const offset = index * 4;
      if (pixels[offset + 3] < 24) continue;

      const r = pixels[offset];
      const g = pixels[offset + 1];
      const b = pixels[offset + 2];
      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
      lumaMap[index] = luma;
      opaquePixels += 1;

      if (luma > 232 && Math.max(r, g, b) - Math.min(r, g, b) < 24) {
        whitePixels += 1;
      }
    }

    const flatWhiteBackground =
      opaquePixels > 0 && whitePixels / opaquePixels > 0.22;

    // Prefer edges and saturated color. Flat backgrounds (especially the
    // white backdrop of an avatar/illustration) are skipped, so the particle
    // portrait stays readable instead of becoming a bright rectangle.
    const salient: Candidate[] = [];
    const fallback: Candidate[] = [];
    const edgeThreshold = 15;

    for (let y = 0; y < sampleH; y += 1) {
      for (let x = 0; x < sampleW; x += 1) {
        const index = y * sampleW + x;
        const offset = index * 4;
        const alpha = pixels[offset + 3];
        if (alpha < 24) continue;

        const r = pixels[offset];
        const g = pixels[offset + 1];
        const b = pixels[offset + 2];
        const luma = lumaMap[index];
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);

        let edge = 0;
        if (x > 0) edge = Math.max(edge, Math.abs(luma - lumaMap[index - 1]));
        if (x < sampleW - 1) {
          edge = Math.max(edge, Math.abs(luma - lumaMap[index + 1]));
        }
        if (y > 0) {
          edge = Math.max(edge, Math.abs(luma - lumaMap[index - sampleW]));
        }
        if (y < sampleH - 1) {
          edge = Math.max(edge, Math.abs(luma - lumaMap[index + sampleW]));
        }

        const weight = edge + chroma * 0.25 + luma * 0.05;
        const background =
          flatWhiteBackground && luma >= 222 && chroma < 22 && edge < 12;
        const candidate = {
          x,
          y,
          r,
          g,
          b,
          a: alpha,
          luma,
          weight,
          background,
        };

        if (edge >= edgeThreshold || (chroma >= 34 && luma >= 24)) {
          salient.push(candidate);
        }
        if (includeBackground || luma >= cutoff) {
          fallback.push(candidate);
        }
      }
    }

    // Images with a large flat white backdrop (avatars, illustrations) use the
    // edge/color set so the backdrop does not become a bright particle block.
    // Line-art SVGs keep the full luminance set, preserving their dense glow.
    const useEdges = flatWhiteBackground;
    const candidates = includeBackground
      ? fallback
      : useEdges
        ? salient.length >= 40
          ? salient
          : fallback
        : fallback.length >= 40
          ? fallback
          : salient;

    if (candidates.length < 6) return 'fail';

    // Put the strongest edges / brightest pixels first so the particle field
    // describes the artwork instead of its dark background noise.
    candidates.sort((a, b) => b.weight - a.weight);

    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, quality.dpr);

    this.canvas.width = Math.max(1, Math.round(width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(height * this.dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.imageSmoothingEnabled = false;

    const max = this.options.max;
    const particles: Particle[] = [];
    const themePalette =
      this.options.morphWords.length > 0 ? this.readThemePalette() : null;

    if (this.options.dotMatrix) {
      // One white dot per dotSpacing x dotSpacing display cell. Candidates are
      // sorted by weight, so the first candidate in a cell is the strongest.
      const spacing = this.options.dotSpacing;
      const cells = new Map<string, Candidate>();
      const maxLuma = candidates.reduce(
        (maximum, candidate) => Math.max(maximum, candidate.luma),
        0,
      );
      const minLuma = includeBackground
        ? 0
        : flatWhiteBackground
          ? maxLuma * 0.12
          : maxLuma * 0.14;

      for (const candidate of candidates) {
        if (candidate.luma < minLuma) continue;

        const px = ((candidate.x + 0.5) / sampleW) * width;
        const py = ((candidate.y + 0.5) / sampleH) * height;
        const key = `${Math.floor(px / spacing)},${Math.floor(py / spacing)}`;

        if (cells.has(key)) continue;
        cells.set(key, candidate);
        if (cells.size >= max) break;
      }

      for (const [key, candidate] of cells) {
        const [cellX, cellY] = key.split(',').map(Number);
        const tx = (cellX + 0.5) * spacing;
        const ty = (cellY + 0.5) * spacing;
        const spacingFactor = clamp(this.options.dotSpacing / 10, 0.15, 1);
        const backdrop = includeBackground && candidate.background;
        const size = backdrop
          ? 1 * this.options.size
          : clamp(
              (1.1 + (candidate.luma / 255) * 1.9) * spacingFactor,
              1,
              2.8,
            ) * this.options.size;
        const tone = candidate.luma / 255;
        const baseAlpha = backdrop
          ? lightTheme
            ? 0.05
            : 0.16
          : 0.55 + tone * 0.45;
        const themed = themePalette
          ? mixRgb(
              themePalette.base,
              themePalette.light,
              candidate.luma / 255,
            )
          : null;
        const color = backdrop
          ? `rgb(${Math.round(candidate.r * 0.3)}, ${Math.round(candidate.g * 0.34)}, ${Math.round(candidate.b * 0.42)})`
          : themed
            ? `rgb(${themed[0]}, ${themed[1]}, ${themed[2]})`
            : this.options.dotColor === 'source'
              ? `rgb(${candidate.r}, ${candidate.g}, ${candidate.b})`
              : this.options.dotColor;

        const x = tx + randomBetween(-32, 32);
        const y = ty + randomBetween(-32, 32);

        particles.push({
          x,
          y,
          tx,
          ty,
          sx: x,
          sy: y,
          vx: 0,
          vy: 0,
          fromX: x,
          fromY: y,
          size,
          color,
          alpha: 0,
          baseAlpha,
          phase: Math.random() * TAU,
          glow: !backdrop && candidate.luma > 205 && Math.random() < 0.08,
        });
      }
    } else {
      const count = Math.min(max, candidates.length);
      const baseSize =
        clamp(0.85 + (width / 1440) * 0.55, 0.85, 1.6) *
        this.options.size;

      for (let index = 0; index < count; index += 1) {
        const candidate = candidates[index];
        const tx = ((candidate.x + 0.5) / sampleW) * width;
        const ty = ((candidate.y + 0.5) / sampleH) * height;
        const size =
          baseSize *
          (0.72 + (candidate.a / 255) * 0.5) *
          randomBetween(0.82, 1.3);
        const baseAlpha =
          (0.3 + (candidate.luma / 255) * 0.7) *
          (0.55 + (candidate.a / 255) * 0.45);

        const x = tx + randomBetween(-48, 48);
        const y = ty + randomBetween(-48, 48);
        const themed = themePalette
          ? mixRgb(
              themePalette.base,
              themePalette.light,
              candidate.luma / 255,
            )
          : null;

        particles.push({
          x,
          y,
          tx,
          ty,
          sx: x,
          sy: y,
          vx: 0,
          vy: 0,
          fromX: x,
          fromY: y,
          size,
          color: themed
            ? `rgb(${themed[0]}, ${themed[1]}, ${themed[2]})`
            : `rgb(${candidate.r}, ${candidate.g}, ${candidate.b})`,
          alpha: 0,
          baseAlpha,
          phase: Math.random() * TAU,
          glow: candidate.luma > 170 && Math.random() < 0.14,
        });
      }
    }

    if (particles.length < 6) return 'fail';

    this.particles = particles;
    this.lastWidth = width;
    this.lastHeight = height;
    this.staticDrawn = false;
    this.lastActive = -1;
    this.morphClock = -1;
    this.morphing = false;
    this.container.classList.remove('is-scattering');
    delete this.canvas.dataset.morph;
    this.canvas.dataset.particles = String(particles.length);
    this.canvas.dataset.tier = quality.tier;
    this.canvas.dataset.mode = this.options.dotMatrix ? 'dots' : 'particles';
    return 'ok';
  }

  private fail() {
    this.failed = true;
    this.built = false;
    this.canvas.remove();
    this.image.classList.remove('is-particleized', 'is-particle-pending');
    this.container.classList.remove('has-particles');
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    registry.delete(this);
  }

  /* --------------------------------------------------------------- motion */

  private step(time: number, delta: number, active: number) {
    const frameScale = clamp(delta * 60, 0.25, 2);

    if (this.morphing) {
      const scatterTime = this.options.morphScatter;
      const gatherTime = this.options.morphGather;
      const duration = scatterTime + gatherTime;
      const elapsed = Math.max(0, time - this.morphStart);
      const scatterEase =
        1 - Math.pow(1 - clamp(elapsed / scatterTime, 0, 1), 3);
      const gatherEase =
        1 -
        Math.pow(
          1 - clamp((elapsed - scatterTime) / gatherTime, 0, 1),
          3,
        );

      for (let index = 0; index < active; index += 1) {
        const particle = this.particles[index];

        if (elapsed < scatterTime) {
          particle.x =
            particle.fromX + (particle.sx - particle.fromX) * scatterEase;
          particle.y =
            particle.fromY + (particle.sy - particle.fromY) * scatterEase;
        } else {
          particle.x =
            particle.sx + (particle.tx - particle.sx) * gatherEase;
          particle.y =
            particle.sy + (particle.ty - particle.sy) * gatherEase;
        }

        particle.alpha +=
          (particle.baseAlpha - particle.alpha) * 0.16 * frameScale;
      }

      if (elapsed >= duration) {
        this.morphing = false;
        this.container.classList.remove('is-scattering');
      }
      return;
    }

    const damping = Math.pow(0.9, frameScale);
    // The word field answers the cursor, but with a smaller, softer push so
    // the glyph stays readable while hovering.
    const morphField = this.options.morphWords.length > 0;
    const pointerRadius = morphField ? 72 : this.hovering ? 96 : 64;
    const pointerStrength = morphField ? 1.25 : this.hovering ? 2.2 : 0.7;

    for (let index = 0; index < active; index += 1) {
      const particle = this.particles[index];
      let forceX = (particle.tx - particle.x) * 0.025;
      let forceY = (particle.ty - particle.y) * 0.025;

      forceX += Math.sin(time * 0.8 + particle.phase) * 0.014;
      forceY += Math.cos(time * 0.66 + particle.phase) * 0.014;

      if (this.pointerActive) {
        const dx = particle.x - this.pointerX;
        const dy = particle.y - this.pointerY;
        const distanceSqr = dx * dx + dy * dy;
        const radiusSqr = pointerRadius * pointerRadius;

        if (distanceSqr < radiusSqr) {
          const distance = Math.sqrt(distanceSqr) || 1;
          const falloff = 1 - distance / pointerRadius;
          const strength = falloff * pointerStrength;
          forceX += (dx / distance) * strength;
          forceY += (dy / distance) * strength;
        }
      }

      particle.vx = (particle.vx + forceX * frameScale) * damping;
      particle.vy = (particle.vy + forceY * frameScale) * damping;
      particle.vx = clamp(particle.vx, -11, 11);
      particle.vy = clamp(particle.vy, -11, 11);
      particle.x += particle.vx * frameScale;
      particle.y += particle.vy * frameScale;
      particle.alpha +=
        (particle.baseAlpha - particle.alpha) * 0.08 * frameScale;
    }
  }

  private draw(active: number) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = this.options.blend;

    for (let index = 0; index < active; index += 1) {
      const particle = this.particles[index];
      if (!particle.glow) continue;
      ctx.globalAlpha = particle.alpha * 0.09;
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        particle.x - particle.size * 2.2,
        particle.y - particle.size * 2.2,
        particle.size * 5.4,
        particle.size * 5.4,
      );
    }

    for (let index = 0; index < active; index += 1) {
      const particle = this.particles[index];
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        particle.x - particle.size / 2,
        particle.y - particle.size / 2,
        particle.size,
        particle.size,
      );
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawStatic(active: number) {
    for (let index = 0; index < active; index += 1) {
      const particle = this.particles[index];
      particle.x = particle.tx;
      particle.y = particle.ty;
      particle.alpha = particle.baseAlpha;
    }
    this.draw(active);
  }

  /* ----------------------------------------------------------- interaction */

  private bindPointer() {
    if (!this.options.interactive || !this.hoverTarget) return;

    const target = this.hoverTarget;
    const morphField = this.options.morphWords.length > 0;

    if (!this.canHover) {
      if (morphField) this.bindTouchMorph(target);
      return;
    }

    target.addEventListener(
      'pointerenter',
      (event) => {
        this.hovering = true;
        this.updatePointer(event);
        if (morphField) {
          this.checkWordRegion();
        } else {
          this.impulse(this.options.scatter * 1.5);
        }
      },
      { passive: true },
    );

    target.addEventListener(
      'pointermove',
      (event) => {
        this.pointerActive = true;
        this.updatePointer(event);
        if (morphField) this.checkWordRegion();
        wake();
      },
      { passive: true },
    );

    target.addEventListener(
      'pointerleave',
      () => {
        this.hovering = false;
        this.pointerActive = false;
        this.pointerInRegion = false;
        wake();
      },
      { passive: true },
    );

    target.addEventListener(
      'pointerdown',
      (event) => {
        this.pointerActive = true;
        this.updatePointer(event);
        if (!morphField) this.impulse(this.options.scatter * 2.4);
      },
      { passive: true },
    );

    target.addEventListener(
      'pointerup',
      () => {
        if (!this.hovering) this.pointerActive = false;
      },
      { passive: true },
    );
  }

  private updatePointer(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerX = event.clientX - rect.left;
    this.pointerY = event.clientY - rect.top;
    this.pointerActive = true;
  }

  /** Touch screens cannot hover, so a tap inside the word region changes it. */
  private bindTouchMorph(target: HTMLElement) {
    target.addEventListener(
      'pointerdown',
      (event) => {
        if (event.pointerType === 'mouse') return;

        const rect = this.canvas.getBoundingClientRect();
        this.pointerX = event.clientX - rect.left;
        this.pointerY = event.clientY - rect.top;

        const region = this.getWordRegion();
        const margin = 28;
        const inside =
          this.pointerX >= region.left - margin &&
          this.pointerX <= region.left + region.width + margin &&
          this.pointerY >= region.top - margin &&
          this.pointerY <= region.top + region.height + margin;

        if (inside) this.requestMorph();
      },
      { passive: true },
    );
  }

  /** Entering the word region asks for the next scatter / gather cycle. */
  private checkWordRegion() {
    if (this.options.morphWords.length === 0 || !this.built) return;

    const region = this.getWordRegion();
    const margin = 18;
    const inside =
      this.pointerX >= region.left - margin &&
      this.pointerX <= region.left + region.width + margin &&
      this.pointerY >= region.top - margin &&
      this.pointerY <= region.top + region.height + margin;

    if (inside && !this.pointerInRegion) {
      this.pointerInRegion = true;
      this.requestMorph();
    } else if (!inside && this.pointerInRegion) {
      this.pointerInRegion = false;
    }
  }

  private requestMorph() {
    if (this.morphing) return;
    this.morphRequest = true;
    wake();
  }

  private impulse(strength: number) {
    const originX = this.pointerActive ? this.pointerX : this.width / 2;
    const originY = this.pointerActive ? this.pointerY : this.height / 2;
    const active = this.activeCount();

    for (let index = 0; index < active; index += 1) {
      const particle = this.particles[index];
      let dx = particle.x - originX;
      let dy = particle.y - originY;
      let distance = Math.hypot(dx, dy);

      if (distance < 1) {
        const angle = Math.random() * TAU;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        distance = 1;
      }

      const falloff = 1 - Math.min(1, distance / 240);
      const force =
        (0.55 + falloff * 2.5) *
        strength *
        randomBetween(0.75, 1.35);

      particle.vx += (dx / distance) * force;
      particle.vy += (dy / distance) * force;
    }

    wake();
  }

  /* -------------------------------------------------------------- lifecycle */

  private hideImage() {
    this.image.classList.add('is-particleized');
    this.image.classList.remove('is-particle-pending');
    this.canvas.classList.add('is-ready');
  }

  private queueResize() {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      const rect = this.container.getBoundingClientRect();
      if (
        Math.abs(rect.width - this.lastWidth) < 1 &&
        Math.abs(rect.height - this.lastHeight) < 1
      ) {
        return;
      }

      if (!this.visible) {
        this.built = false;
        return;
      }

      this.built = false;
      this.particles = [];
      this.ctx.clearRect(0, 0, this.width, this.height);
      const result = this.build();
      if (result === 'ok') {
        this.built = true;
        this.staticDrawn = false;
        this.hideImage();
        wake();
      } else if (result === 'fail') {
        this.fail();
      }
    }, 180);
  }
}

/* --------------------------------------------------------------------------
   Setup helpers
   -------------------------------------------------------------------------- */

const isCrossOrigin = (url: string): boolean => {
  if (url.startsWith('data:') || url.startsWith('blob:')) return false;
  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
};

const startParticles = (
  target: HTMLImageElement,
  source: HTMLImageElement,
  options: ParticleImageOptions,
) => {
  if (target.dataset.particlesReady === '1') return;

  const container = target.parentElement;
  if (!container) return;

  try {
    new ParticleImage(source, target, container, options);
    target.dataset.particlesReady = '1';
  } catch (error) {
    target.classList.remove('is-particle-pending');
    console.warn('[particles] image effect disabled:', error);
  }
};

const whenLoaded = (
  image: HTMLImageElement | null,
  options: ParticleImageOptions,
) => {
  if (!image) return;

  // Hide the raw bitmap until the particle field replaces it, so an image is
  // never flashed in its original form while the field is still building.
  image.classList.add('is-particle-pending');
  image.addEventListener(
    'error',
    () => image.classList.remove('is-particle-pending'),
    { once: true },
  );

  const init = () => {
    const url = image.currentSrc || image.src;
    if (!url) {
      image.classList.remove('is-particle-pending');
      return;
    }

    if (!isCrossOrigin(url)) {
      startParticles(image, image, options);
      return;
    }

    // A cross-origin image cannot be sampled unless the server allows CORS.
    // Probe with an anonymous request and keep the original visible on failure.
    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.decoding = 'async';
    probe.addEventListener(
      'load',
      () => startParticles(image, probe, options),
      { once: true },
    );
    probe.addEventListener(
      'error',
      () => {
        image.classList.remove('is-particle-pending');
        console.warn('[particles] CORS unavailable, keeping image:', url);
      },
      { once: true },
    );
    probe.src = url;
  };

  if (image.complete && image.naturalWidth > 0) {
    init();
  } else {
    image.addEventListener('load', init, { once: true });
  }
};

export function setupParticleImages(settings?: ParticleSettings) {
  if (!settings || settings.enabled === false) return;

  const density = clamp(settings.density ?? 1, 0.2, 2.5);
  const dotDefaults: ParticleImageOptions = {
    dotMatrix: settings.dotMatrix ?? true,
    dotSpacing: settings.dotSpacing ?? 10,
    dotColor: settings.dotColor ?? '#ffffff',
  };
  const scaled = (options?: ParticleImageOptions): ParticleImageOptions => ({
    ...dotDefaults,
    ...options,
    max: Math.round((options?.max ?? 1000) * density),
  });

  whenLoaded(
    document.querySelector<HTMLImageElement>('#hero-media img'),
    scaled({ ...settings.hero, morph: settings.hero?.morph ?? settings.morph }),
  );

  whenLoaded(
    document.querySelector<HTMLImageElement>('.id-avatar .id-photo'),
    scaled(settings.avatar),
  );

  document
    .querySelectorAll<HTMLImageElement>('#work-track .work-image')
    .forEach((image) => whenLoaded(image, scaled(settings.works)));
}
