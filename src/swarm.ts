/**
 * Ambient particle swarm: glowing motes that fly across the viewport.
 *
 * A calm, screen-wide layer of drifting dust that wanders on a slow sine
 * field, wraps at the edges and scatters away from the pointer. It echoes the
 * ambient + rising particles of the FlowerTerminal reference while staying in
 * the page's own ink / acid palette. The layer renders on its own fixed canvas
 * with additive blending, so it never touches layout or hit-testing.
 */

const TAU = Math.PI * 2;

type Rgb = [number, number, number];

const INK: Rgb = [237, 237, 228];
const FALLBACK_ACCENT: Rgb = [230, 255, 46];
const FALLBACK_GLOW: Rgb = [255, 255, 150];

const POINTER_RADIUS = 150;
const POINTER_PUSH = 460;
const EDGE_MARGIN = 26;

export interface SwarmOptions {
  enabled?: boolean;
  density?: number;
  interactive?: boolean;
  accent?: string;
  glow?: string;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  depth: number;
  alpha: number;
  phase: number;
  wander: number;
  twinkle: number;
  color: Rgb;
  streak: number;
}

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

class ParticleSwarm {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly reduced: boolean;
  private readonly density: number;
  private readonly interactive: boolean;
  private readonly colors: Rgb[];

  private motes: Mote[] = [];
  private width = 0;
  private height = 0;
  private dpr = 1;

  private raf = 0;
  private last = 0;
  private time = 0;
  private running = false;

  private pointerActive = false;
  private pointerX = 0;
  private pointerY = 0;
  private targetX = 0;
  private targetY = 0;

  private resizeTimer = 0;

  constructor(canvas: HTMLCanvasElement, options: SwarmOptions) {
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas 2D is not available.');

    this.canvas = canvas;
    this.ctx = context;
    this.reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    this.density = clamp(options.density ?? 1, 0.2, 3);
    this.interactive =
      (options.interactive ?? true) &&
      window.matchMedia('(pointer: fine)').matches;

    const accent = hexToRgb(options.accent, FALLBACK_ACCENT);
    const glow = hexToRgb(options.glow, FALLBACK_GLOW);
    // Mostly quiet ink dust, with a minority of accent / glow sparks so the
    // layer reads as living signal instead of noise.
    this.colors = [INK, INK, INK, INK, INK, INK, INK, glow, glow, accent];

    this.resize();

    window.addEventListener('resize', this.handleResize, { passive: true });
    if (this.interactive) {
      window.addEventListener('pointermove', this.handlePointer, {
        passive: true,
      });
      window.addEventListener('pointerdown', this.handlePointer, {
        passive: true,
      });
      document.addEventListener('pointerleave', this.handlePointerLeave);
    }
    document.addEventListener('visibilitychange', this.handleVisibility);

    this.canvas.dataset.motes = String(this.motes.length);
    this.canvas.dataset.mode = 'swarm';

    if (this.reduced) {
      this.draw();
    } else {
      this.start();
    }
  }

  /* --------------------------------------------------------------- events */

  private handleResize = () => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.resize(), 140);
  };

  private handlePointer = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    this.targetX = event.clientX;
    this.targetY = event.clientY;
    if (!this.pointerActive) {
      this.pointerX = this.targetX;
      this.pointerY = this.targetY;
      this.pointerActive = true;
    }
  };

  private handlePointerLeave = () => {
    this.pointerActive = false;
  };

  private handleVisibility = () => {
    if (this.reduced) return;
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  };

  /* -------------------------------------------------------------- geometry */

  private resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    this.canvas.width = Math.max(1, Math.round(this.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.height * this.dpr));
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.build();
  }

  private build() {
    const area = this.width * this.height;
    const base = clamp(Math.round(area / 16000), 30, 120);
    const count = Math.max(12, Math.round(base * this.density));

    this.motes = Array.from({ length: count }, () => this.createMote());
    this.canvas.dataset.motes = String(this.motes.length);

    if (this.reduced) this.draw();
  }

  private createMote(): Mote {
    const depth = 0.25 + Math.random() * 0.75;
    const angle = Math.random() * TAU;
    const speed = (10 + Math.random() * 24) * (0.5 + depth * 0.8);

    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: (0.7 + Math.random() * 1.5) * (0.55 + depth * 0.75),
      depth,
      alpha: (0.15 + Math.random() * 0.27) * (0.55 + depth * 0.65),
      phase: Math.random() * TAU,
      wander: 0.25 + Math.random() * 0.7,
      twinkle: 0.5 + Math.random() * 1.7,
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
      streak: Math.random() < 0.26 ? 0.5 + Math.random() * 0.9 : 0,
    };
  }

  /* ----------------------------------------------------------------- loop */

  private start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private tick = (now: number) => {
    if (!this.running) return;

    const delta = clamp((now - this.last) / 1000, 0.008, 0.05) || 1 / 60;
    this.last = now;
    this.time += delta;

    this.step(delta);
    this.draw();
    this.raf = requestAnimationFrame(this.tick);
  };

  private step(delta: number) {
    const { width, height } = this;
    const ease = Math.min(1, delta * 10);
    this.pointerX += (this.targetX - this.pointerX) * ease;
    this.pointerY += (this.targetY - this.pointerY) * ease;

    const friction = Math.exp(-0.55 * delta);
    const pushLimit = POINTER_RADIUS * POINTER_RADIUS;

    for (const mote of this.motes) {
      // A slow, non-repeating sine field keeps every mote on its own path.
      const force = (8 + mote.depth * 12) * delta;
      mote.vx += Math.sin(this.time * mote.wander + mote.phase) * force;
      mote.vy +=
        Math.cos(this.time * mote.wander * 0.83 + mote.phase * 1.7) * force;

      if (this.interactive && this.pointerActive) {
        const dx = mote.x - this.pointerX;
        const dy = mote.y - this.pointerY;
        const distanceSqr = dx * dx + dy * dy;

        if (distanceSqr < pushLimit) {
          const distance = Math.sqrt(distanceSqr) || 1;
          const falloff = 1 - distance / POINTER_RADIUS;
          const push =
            falloff * falloff * POINTER_PUSH * delta * (0.5 + mote.depth);

          mote.vx += (dx / distance) * push;
          mote.vy += (dy / distance) * push;
        }
      }

      mote.vx *= friction;
      mote.vy *= friction;

      const maxSpeed = 18 + mote.depth * 30;
      const speed = Math.hypot(mote.vx, mote.vy);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        mote.vx *= scale;
        mote.vy *= scale;
      }

      mote.x += mote.vx * delta;
      mote.y += mote.vy * delta;

      // Wrap instead of bounce: no clumping at the edges.
      if (mote.x < -EDGE_MARGIN) mote.x = width + EDGE_MARGIN;
      else if (mote.x > width + EDGE_MARGIN) mote.x = -EDGE_MARGIN;
      if (mote.y < -EDGE_MARGIN) mote.y = height + EDGE_MARGIN;
      else if (mote.y > height + EDGE_MARGIN) mote.y = -EDGE_MARGIN;
    }
  }

  private draw() {
    const { ctx, width, height, time } = this;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (const mote of this.motes) {
      const twinkle =
        0.68 + 0.32 * Math.sin(time * mote.twinkle + mote.phase * 2.1);
      const alpha = mote.alpha * twinkle;
      const [r, g, b] = mote.color;
      const fill = `rgb(${r}, ${g}, ${b})`;

      // Soft halo.
      ctx.globalAlpha = alpha * 0.2;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.size * 3.4, 0, TAU);
      ctx.fill();

      // A short tail along the velocity vector sells the "flying" motion.
      if (mote.streak > 0) {
        const speed = Math.hypot(mote.vx, mote.vy) || 1;
        const tail = mote.streak * (4 + speed * 0.32);
        ctx.globalAlpha = alpha * 0.38;
        ctx.strokeStyle = fill;
        ctx.lineWidth = mote.size * 0.9;
        ctx.beginPath();
        ctx.moveTo(
          mote.x - (mote.vx / speed) * tail,
          mote.y - (mote.vy / speed) * tail,
        );
        ctx.lineTo(mote.x, mote.y);
        ctx.stroke();
      }

      // Bright core.
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.size * 0.62, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

export function initSwarm(
  canvas: HTMLCanvasElement,
  options: SwarmOptions = {},
): ParticleSwarm | null {
  if (options.enabled === false) {
    canvas.remove();
    return null;
  }

  try {
    return new ParticleSwarm(canvas, options);
  } catch (error) {
    console.warn('[swarm] particle layer disabled:', error);
    canvas.remove();
    return null;
  }
}
