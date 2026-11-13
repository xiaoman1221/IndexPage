/**
 * Hitokoto quote → particle text.
 *
 * The quote is rasterised with the same font metrics as the DOM, sampled into
 * coloured particles and drawn over the (visually hidden) blockquote. When the
 * hitokoto refreshes, the old particles fly into the new glyph positions.
 * The real text stays in the DOM for layout, selection and screen readers.
 */

import { extractText } from './textRaster';
import { readThemeColors, watchColorScheme } from './theme';

const TAU = Math.PI * 2;

export interface QuoteParticleOptions {
  enabled?: boolean;
  max?: number;
}

interface Mote {
  x: number;
  y: number;
  tx: number;
  ty: number;
  fromX: number;
  fromY: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  baseAlpha: number;
  phase: number;
  twinkle: number;
  color: string;
  glow: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

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

export class QuoteParticleText {
  private readonly source: HTMLElement;
  private readonly card: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly max: number;

  private motes: Mote[] = [];
  private width = 0;
  private height = 0;
  private dpr = 1;

  private raf = 0;
  private running = false;
  private visible = false;
  private last = 0;
  private time = 0;

  private morphing = false;
  private morphStart = 0;
  private readonly morphDuration = 0.75;

  private updateTimer = 0;
  private resizeTimer = 0;
  private dirty = true;
  private hasParticles = false;
  private suspended = false;
  private color = '#ffffff';

  private readonly mutationObserver: MutationObserver;
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;

  constructor(source: HTMLElement, options: QuoteParticleOptions = {}) {
    this.source = source;
    this.card =
      (source.closest('.quote-terminal') as HTMLElement | null) ??
      (source.parentElement as HTMLElement);
    this.max = clamp(Math.round(options.max ?? 2600), 200, 4000);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas 2D is not available.');

    this.canvas = canvas;
    this.ctx = context;
    canvas.className = 'quote-particle-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    this.card.append(canvas);

    this.mutationObserver = new MutationObserver(() => this.queueUpdate());
    this.mutationObserver.observe(source, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    this.resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.queueUpdate(), 160);
    });
    this.resizeObserver.observe(source);

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        this.visible = entries.some((entry) => entry.isIntersecting);
        if (this.visible) {
          if (this.dirty) this.queueUpdate();
          this.start();
        } else {
          this.stop();
        }
      },
      { threshold: 0.05 },
    );
    this.intersectionObserver.observe(this.card);

    document.addEventListener('visibilitychange', this.handleVisibility);
    watchColorScheme(() => this.handleTheme());

    if (document.fonts) {
      void document.fonts.ready.then(() => this.queueUpdate());
    }

    this.queueUpdate();
  }

  /* --------------------------------------------------------------- events */

  private handleTheme = () => {
    if (this.suspended) return;
    this.queueUpdate();
  };

  private handleVisibility = () => {
    if (document.hidden) {
      this.stop();
    } else if (this.visible) {
      this.start();
    }
  };

  /* ------------------------------------------------------------- building */

  private queueUpdate() {
    this.dirty = true;
    if (this.suspended) return;
    window.clearTimeout(this.updateTimer);
    this.updateTimer = window.setTimeout(() => {
      if (!this.visible || this.suspended) return;
      this.build();
      this.start();
    }, 80);
  }

  /** Pause the halo while the typewriter is writing (no rebuild per keystroke). */
  setSuspended(value: boolean) {
    if (this.suspended === value) return;
    this.suspended = value;
    if (value) {
      this.dirty = false;
      this.disable();
    } else {
      this.queueUpdate();
    }
  }

  private build() {
    this.dirty = false;

    const rect = this.source.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 12) return;

    const cardRect = this.card.getBoundingClientRect();
    const cardStyle = getComputedStyle(this.card);
    const borderLeft = Number.parseFloat(cardStyle.borderLeftWidth) || 0;
    const borderTop = Number.parseFloat(cardStyle.borderTopWidth) || 0;

    this.width = rect.width;
    this.height = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.canvas.style.left = `${rect.left - cardRect.left - borderLeft}px`;
    this.canvas.style.top = `${rect.top - cardRect.top - borderTop}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.color = readThemeColors().quote;
    const points = this.sampleText(rect);
    if (!points || points.length < 24) {
      this.disable();
      return;
    }

    for (let index = points.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [points[index], points[swap]] = [points[swap], points[index]];
    }

    const budget =
      window.innerWidth < 720 ? Math.min(this.max, 1600) : this.max;
    const count = Math.min(budget, points.length);
    const previous = this.motes;
    const firstRun = previous.length === 0;

    const next: Mote[] = [];
    for (let index = 0; index < count; index += 1) {
      const point = points[index % points.length];
      const old = previous.length
        ? previous[index % previous.length]
        : null;

      next.push({
        x: firstRun ? randomBetween(0, rect.width) : old!.x,
        y: firstRun ? randomBetween(0, rect.height) : old!.y,
        fromX: firstRun ? 0 : old!.x,
        fromY: firstRun ? 0 : old!.y,
        tx: point.x + randomBetween(-0.5, 0.5),
        ty: point.y + randomBetween(-0.5, 0.5),
        vx: 0,
        vy: 0,
        size: randomBetween(0.65, 1.1),
        alpha: 0,
        baseAlpha: randomBetween(0.6, 0.94),
        phase: Math.random() * TAU,
        twinkle: 0.6 + Math.random() * 1.4,
        color: this.color,
        glow: Math.random() < 0.04,
      });
    }

    if (firstRun) {
      for (const mote of next) {
        mote.fromX = mote.x;
        mote.fromY = mote.y;
      }
    }

    this.motes = next;
    this.hasParticles = true;
    this.card.classList.add('has-quote-particles');
    this.canvas.dataset.points = String(points.length);
    this.canvas.dataset.motes = String(count);

    this.morphing = true;
    this.morphStart = this.time;
    this.wake();
  }

  private disable() {
    this.hasParticles = false;
    this.motes = [];
    this.stop();
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.card.classList.remove('has-quote-particles');
  }

  /**
   * Render the quote with the blockquote's own font metrics, then collect the
   * glyph pixels as particle targets in CSS pixels.
   */
  private sampleText(
    rect: DOMRect,
  ): Array<{ x: number; y: number }> | null {
    const text = extractText(this.source);
    if (!text) return null;

    const style = getComputedStyle(this.source);
    const fontSize = Number.parseFloat(style.fontSize) || 18;
    const lineHeight =
      Number.parseFloat(style.lineHeight) || fontSize * 1.9;
    const fontFamily = style.fontFamily || 'sans-serif';
    const fontWeight = style.fontWeight || '400';

    const sample = document.createElement('canvas');
    sample.width = Math.max(1, Math.ceil(rect.width));
    sample.height = Math.max(1, Math.ceil(rect.height));
    const ctx = sample.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';

    const lines = wrapText(ctx, text, rect.width);
    const leading = Math.max(0, (lineHeight - fontSize) / 2);

    lines.forEach((line, index) => {
      const y = index * lineHeight + leading;
      if (y > rect.height) return;
      ctx.fillText(line, 0, y);
    });

    let pixels: Uint8ClampedArray;
    try {
      pixels = ctx.getImageData(0, 0, sample.width, sample.height).data;
    } catch {
      return null;
    }

    const points: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < sample.height; y += 1) {
      for (let x = 0; x < sample.width; x += 1) {
        if (pixels[(y * sample.width + x) * 4 + 3] < 110) continue;
        points.push({ x: x + 0.5, y: y + 0.5 });
      }
    }

    return points.length >= 24 ? points : null;
  }

  /* --------------------------------------------------------------- motion */

  private start() {
    if (this.running || !this.hasParticles) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private wake() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.start();
  }

  private loop = (now: number) => {
    if (!this.running) return;

    const delta = clamp((now - this.last) / 1000, 0.008, 0.05) || 1 / 60;
    this.last = now;
    this.time += delta;

    this.step(delta);
    this.draw();

    this.raf = requestAnimationFrame(this.loop);
  };

  private step(delta: number) {
    const frameScale = clamp(delta * 60, 0.25, 2);

    if (this.morphing) {
      const elapsed = Math.max(0, this.time - this.morphStart);

      for (const mote of this.motes) {
        const delay =
          clamp(mote.fromX / Math.max(1, this.width), 0, 1) *
          this.morphDuration *
          0.3;
        const span = Math.max(0.001, this.morphDuration - delay);
        const t = clamp((elapsed - delay) / span, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);

        mote.x = mote.fromX + (mote.tx - mote.fromX) * eased;
        mote.y = mote.fromY + (mote.ty - mote.fromY) * eased;
        mote.alpha += (mote.baseAlpha - mote.alpha) * 0.2 * frameScale;
      }

      if (elapsed >= this.morphDuration) this.morphing = false;
      return;
    }

    const damping = Math.pow(0.88, frameScale);

    for (const mote of this.motes) {
      let forceX = (mote.tx - mote.x) * 0.035;
      let forceY = (mote.ty - mote.y) * 0.035;

      forceX += Math.sin(this.time * 1.1 + mote.phase) * 0.01;
      forceY += Math.cos(this.time * 0.9 + mote.phase * 1.4) * 0.01;

      mote.vx = (mote.vx + forceX * frameScale) * damping;
      mote.vy = (mote.vy + forceY * frameScale) * damping;
      mote.vx = clamp(mote.vx, -6, 6);
      mote.vy = clamp(mote.vy, -6, 6);
      mote.x += mote.vx * frameScale;
      mote.y += mote.vy * frameScale;
      mote.alpha += (mote.baseAlpha - mote.alpha) * 0.1 * frameScale;
    }
  }

  private draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    for (const mote of this.motes) {
      const twinkle =
        0.86 + 0.14 * Math.sin(this.time * mote.twinkle + mote.phase * 2);
      const alpha = mote.alpha * twinkle;

      if (mote.glow) {
        ctx.globalAlpha = alpha * 0.12;
        ctx.fillStyle = mote.color;
        ctx.fillRect(
          mote.x - mote.size * 2.4,
          mote.y - mote.size * 2.4,
          mote.size * 5,
          mote.size * 5,
        );
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = mote.color;
      ctx.fillRect(
        mote.x - mote.size / 2,
        mote.y - mote.size / 2,
        mote.size,
        mote.size,
      );
    }

    ctx.globalAlpha = 1;
  }
}

export function initQuoteParticles(
  options: QuoteParticleOptions = {},
): QuoteParticleText | null {
  if (options.enabled === false) return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return null;
  }

  const source = document.querySelector<HTMLElement>('#quote-text');
  if (!source) return null;

  try {
    return new QuoteParticleText(source, options);
  } catch (error) {
    console.warn('[quote-particles] disabled:', error);
    return null;
  }
}
