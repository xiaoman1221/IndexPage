/**
 * Procedural background: a wireframe terrain + an orbital core.
 *
 * The reference language is the Endfield landing page (layered video, HUD,
 * wireframe machinery). To keep the page dependency-free and fast, the scene
 * is drawn with Canvas 2D instead of a WebGL engine.
 */

const TAU = Math.PI * 2;
const FALLBACK_ACCENT = '230, 255, 46';
const FALLBACK_GLOW = '255, 255, 150';
const INK = '237, 237, 228';

export interface SceneOptions {
  enabled?: boolean;
  accent?: string;
  glow?: string;
  techStack?: string[];
}

const hexToRgb = (hex: string | undefined, fallback: string): string => {
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
  return `${(numeric >> 16) & 255}, ${(numeric >> 8) & 255}, ${numeric & 255}`;
};

interface Particle {
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
}

interface Point {
  x: number;
  y: number;
}

interface TechWord {
  text: string;
  fontSize: number;
  width: number;
  height: number;
  opacity: number;
  x: number;
  y: number;
  phase: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

export class BackgroundScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly reduced: boolean;
  private readonly accent: string;
  private readonly glow: string;

  private width = 0;
  private height = 0;
  private dpr = 1;

  private raf = 0;
  private last = 0;
  private time = 0;
  private running = false;

  private scroll = 0;
  private targetScroll = 0;
  private mouseX = 0;
  private mouseY = 0;
  private targetMouseX = 0;
  private targetMouseY = 0;

  private particles: Particle[] = [];
  private vertices: number[][] = [];
  private edges: [number, number][] = [];
  private techWords: TechWord[] = [];
  private resizeTimer = 0;

  constructor(canvas: HTMLCanvasElement, options: SceneOptions = {}) {
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      throw new Error('Canvas 2D is not available in this browser.');
    }

    this.canvas = canvas;
    this.ctx = context;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.accent = hexToRgb(options.accent, FALLBACK_ACCENT);
    this.glow = hexToRgb(options.glow, FALLBACK_GLOW);

    this.buildCore();
    this.buildTechWords(options.techStack ?? []);
    this.resize();

    window.addEventListener('resize', this.handleResize, { passive: true });
    window.addEventListener('scroll', this.handleScroll, { passive: true });
    window.addEventListener('pointermove', this.handlePointer, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibility);

    if (this.reduced) {
      this.render(1 / 60);
    } else {
      this.start();
    }
  }

  private handleResize = () => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.resize(), 120);
  };

  private handleScroll = () => {
    this.targetScroll = window.scrollY;
  };

  private handlePointer = (event: PointerEvent) => {
    this.targetMouseX = (event.clientX / this.width) * 2 - 1;
    this.targetMouseY = (event.clientY / this.height) * 2 - 1;
  };

  private handleVisibility = () => {
    if (this.reduced) return;
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  };

  private resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.buildParticles();

    if (this.reduced) {
      this.render(1 / 60);
    }
  }

  private buildParticles() {
    const count = this.width < 720 ? 46 : 86;
    this.particles = Array.from({ length: count }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height * 0.78,
      z: 0.25 + Math.random() * 0.75,
      size: 0.5 + Math.random() * 1.3,
      phase: Math.random() * TAU,
    }));
  }

  private buildCore() {
    const phi = (1 + Math.sqrt(5)) / 2;
    const raw = [
      [-1, phi, 0],
      [1, phi, 0],
      [-1, -phi, 0],
      [1, -phi, 0],
      [0, -1, phi],
      [0, 1, phi],
      [0, -1, -phi],
      [0, 1, -phi],
      [phi, 0, -1],
      [phi, 0, 1],
      [-phi, 0, -1],
      [-phi, 0, 1],
    ];
    const length = Math.hypot(1, phi);

    this.vertices = raw.map(([x, y, z]) => [x / length, y / length, z / length]);
    this.edges = [];

    for (let i = 0; i < this.vertices.length; i += 1) {
      for (let j = i + 1; j < this.vertices.length; j += 1) {
        const [ax, ay, az] = this.vertices[i];
        const [bx, by, bz] = this.vertices[j];
        const distance = Math.hypot(ax - bx, ay - by, az - bz);
        if (distance < 1.2) {
          this.edges.push([i, j]);
        }
      }
    }
  }

  private start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private loop = (now: number) => {
    if (!this.running) return;

    const delta = Math.min(0.05, (now - this.last) / 1000 || 1 / 60);
    this.last = now;
    this.time += delta;

    this.mouseX = lerp(this.mouseX, this.targetMouseX, 0.045);
    this.mouseY = lerp(this.mouseY, this.targetMouseY, 0.045);
    this.scroll = lerp(this.scroll, this.targetScroll, 0.08);

    this.render(delta);
    this.raf = requestAnimationFrame(this.loop);
  };

  private render(delta: number) {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    this.drawParticles(delta);
    this.drawCore();
    this.drawTerrain();
    this.drawTechWords();
  }

  private buildTechWords(words: string[]) {
    const fallback = [
      'AI',
      'LLM',
      'JAVA',
      'PYTHON',
      'GO',
      'TYPESCRIPT',
      'JAVASCRIPT',
      'REACT',
      'NEXT.JS',
      'VUE',
    ];
    const list = (words.length > 0 ? words : fallback).slice(0, 10);
    const anchors = [
      [0.08, 0.16],
      [0.6, 0.14],
      [0.13, 0.72],
      [0.55, 0.78],
      [0.7, 0.5],
      [0.3, 0.36],
      [0.46, 0.62],
      [0.64, 0.26],
      [0.22, 0.88],
      [0.5, 0.44],
    ];

    const canvas = document.createElement('canvas');
    const measure = canvas.getContext('2d');
    if (!measure) return;

    list.forEach((word, index) => {
      const text = word.toUpperCase();
      const fontSize = text.length <= 3 ? 20 : 12 + (index % 3) * 2;
      const font = `600 ${fontSize}px "JetBrains Mono", monospace`;

      measure.font = font;
      const width = Math.ceil(measure.measureText(text).width) + 6;
      const height = fontSize + 10;
      const anchor = anchors[index % anchors.length];

      this.techWords.push({
        text,
        fontSize,
        width,
        height,
        opacity: 0.14 + (index % 4) * 0.03,
        x: anchor[0],
        y: anchor[1],
        phase: index * 1.7,
      });
    });
  }

  private drawTechWords() {
    const { ctx, width, height } = this;
    const time = this.time;

    this.techWords.forEach((word, index) => {
      const drift = this.scroll * (0.012 + (index % 3) * 0.006);
      const wrapHeight = height + word.height + 120;
      let y =
        (word.y * height +
          drift +
          Math.sin(time * 0.16 + word.phase) * 18) %
        wrapHeight;
      if (y < -word.height) y += wrapHeight;

      let x = word.x * width + Math.sin(time * 0.12 + word.phase) * 24;
      x = clamp(x, 30, Math.max(30, width - word.width - 30));

      const opacity =
        word.opacity * (0.7 + 0.3 * Math.sin(time * 0.24 + word.phase));

      ctx.font = `600 ${word.fontSize}px "JetBrains Mono", monospace`;
      ctx.fillStyle = `rgba(${INK}, ${opacity})`;
      ctx.fillText(word.text, x, y + word.fontSize);
    });
  }

  private drawParticles(delta: number) {
    const { ctx, width, height } = this;

    for (const particle of this.particles) {
      particle.y -= (5 + particle.z * 9) * delta;
      particle.x += Math.sin(this.time * 0.35 + particle.phase) * 0.06;

      if (particle.y < -10) {
        particle.y = height * 0.8;
        particle.x = Math.random() * width;
      }
      if (particle.x < -10) particle.x = width + 10;
      if (particle.x > width + 10) particle.x = -10;

      const alpha = (0.06 + particle.z * 0.22) * (0.5 + 0.5 * Math.sin(this.time + particle.phase));
      ctx.fillStyle = `rgba(${INK}, ${alpha})`;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
  }

  private drawTerrain() {
    const { ctx, width, height } = this;
    const isSmall = width < 720;
    const columns = isSmall ? 28 : 48;
    const rows = isSmall ? 22 : 34;

    const horizon = height * 0.46 + this.mouseY * 9;
    const centerX = width * 0.5 + this.mouseX * 26;
    const focal = Math.min(width, height) * 1.04;
    const zNear = 1.5;
    const zFar = 26;
    const cameraY = 1.9;
    const travel = this.scroll * 0.0045;

    const grid: Point[][] = [];
    const depths: number[] = [];

    for (let row = 0; row < rows; row += 1) {
      const t = row / (rows - 1);
      const z = zNear * Math.pow(zFar / zNear, t);
      const rowPoints: Point[] = [];

      for (let column = 0; column < columns; column += 1) {
        const x = ((column / (columns - 1)) * 2 - 1) * 27;
        const ridge =
          Math.sin(x * 0.52 + z * 0.33 + travel + this.time * 0.16) * 0.85 +
          Math.sin(x * 1.35 - z * 0.6 - travel * 0.7 - this.time * 0.28) * 0.32 +
          Math.cos(z * 0.92 + x * 0.21 + this.time * 0.1) * 0.24;
        const y = ridge * 1.15;

        rowPoints.push({
          x: centerX + (x / z) * focal,
          y: horizon - ((y - cameraY) / z) * focal,
        });
      }

      grid.push(rowPoints);
      depths.push(t);
    }

    const sweep = (this.time * 0.11) % 1;

    for (let row = 0; row < rows; row += 1) {
      const depth = depths[row];
      const band = Math.exp(-Math.pow((depth - sweep) * 5.5, 2));
      const alpha = 0.03 + (1 - depth) * 0.16 + band * 0.34;
      const size = 1.1 + (1 - depth) * 1.5 + band * 1.7;

      ctx.fillStyle = `rgba(${INK}, ${alpha})`;

      for (let column = 0; column < columns; column += 1) {
        const point = grid[row][column];
        if (
          point.x < -6 ||
          point.x > width + 6 ||
          point.y < -6 ||
          point.y > height + 6
        ) {
          continue;
        }
        ctx.fillRect(point.x, point.y, size, size);
      }
    }

    // A few brighter dots along the scan band keep the surface legible.
    const highlightRow = Math.min(
      rows - 1,
      Math.max(0, Math.round(sweep * (rows - 1))),
    );
    ctx.fillStyle = `rgba(${this.glow}, 0.22)`;
    for (let column = 0; column < columns; column += 3) {
      const point = grid[highlightRow][column];
      if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) {
        continue;
      }
      ctx.fillRect(point.x, point.y, 2, 2);
    }
  }

  private drawCore() {
    const { ctx, width, height } = this;
    const fade = clamp(1 - this.scroll / (height * 1.25), 0, 1);
    if (fade <= 0.01) return;

    const centerX = width * 0.735 + this.mouseX * 16;
    const centerY = height * 0.43 + this.mouseY * 12;
    const radius = Math.min(width, height) * (width < 720 ? 0.2 : 0.18);
    const alpha = fade * 0.72;

    const dot = (
      x: number,
      y: number,
      color: string,
      opacity: number,
      size: number,
    ) => {
      ctx.fillStyle = `rgba(${color}, ${opacity})`;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    };

    const drawRing = (
      rx: number,
      ry: number,
      rotation: number,
      count: number,
      opacity: number,
    ) => {
      ctx.save();
      ctx.rotate(rotation);
      ctx.fillStyle = `rgba(${INK}, ${opacity})`;
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * TAU;
        const x = Math.cos(angle) * rx;
        const y = Math.sin(angle) * ry;
        ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
      }
      ctx.restore();
    };

    ctx.save();
    ctx.translate(centerX, centerY);
    drawRing(
      radius * 1.58,
      radius * 0.54,
      -0.38 + this.time * 0.03,
      96,
      alpha * 0.14,
    );
    drawRing(
      radius * 1.36,
      radius * 0.48,
      0.62 - this.time * 0.024,
      72,
      alpha * 0.19,
    );
    ctx.restore();

    const rotationY = this.time * 0.14;
    const rotationX = 0.42 + Math.sin(this.time * 0.19) * 0.16;
    const cosY = Math.cos(rotationY);
    const sinY = Math.sin(rotationY);
    const cosX = Math.cos(rotationX);
    const sinX = Math.sin(rotationX);

    const projected = this.vertices.map(([x, y, z]) => {
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;
      const y1 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      const perspective = 1 / (1 + z2 * 0.3);
      return {
        x: x1 * radius * perspective,
        y: y1 * radius * perspective,
        depth: z2,
      };
    });

    for (const [startIndex, endIndex] of this.edges) {
      const a = projected[startIndex];
      const b = projected[endIndex];
      const depth = (a.depth + b.depth) / 2;
      const opacity = alpha * (0.13 + 0.14 * (1 - depth));
      const steps = 6;

      for (let stepIndex = 0; stepIndex <= steps; stepIndex += 1) {
        const t = stepIndex / steps;
        dot(
          centerX + a.x + (b.x - a.x) * t,
          centerY + a.y + (b.y - a.y) * t,
          INK,
          opacity,
          1.25,
        );
      }
    }

    for (const point of projected) {
      const size = 1.1 + (1 - point.depth) * 1.3;
      dot(
        centerX + point.x,
        centerY + point.y,
        INK,
        alpha * (0.3 + (1 - point.depth) * 0.32),
        size,
      );
    }

    const signal = 0.5 + Math.sin(this.time * 1.4) * 0.5;
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = `rgba(${this.glow}, ${alpha * 0.45})`;
    dot(
      centerX,
      centerY,
      this.accent,
      alpha * (0.38 + signal * 0.4),
      2.4 + signal * 1.8,
    );
    ctx.restore();
  }
}

export function initBackground(
  canvas: HTMLCanvasElement,
  options: SceneOptions = {},
): BackgroundScene | null {
  if (options.enabled === false) return null;
  try {
    return new BackgroundScene(canvas, options);
  } catch (error) {
    console.warn('[scene] background disabled:', error);
    return null;
  }
}
