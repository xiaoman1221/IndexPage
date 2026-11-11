import { config } from './config';
import { initPageIntro } from './intro';
import { setupParticleImages } from './particles';
import { initQuoteParticles } from './quoteParticles';
import { daysSince, renderSite } from './render';
import { initBackground } from './scene';
import { initSwarm } from './swarm';

const $ = <T extends Element>(selector: string, parent: ParentNode = document) =>
  parent.querySelector<T>(selector);

const $$ = <T extends Element>(selector: string, parent: ParentNode = document) =>
  Array.from(parent.querySelectorAll<T>(selector));

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const pad = (value: number) => String(value).padStart(2, '0');

/* --------------------------------------------------------------------------
   Boot sequence
   -------------------------------------------------------------------------- */

function setupBoot() {
  const boot = $<HTMLElement>('#boot');
  const bar = $<HTMLElement>('#boot-bar');
  const percent = $<HTMLElement>('#boot-percent');
  const status = $<HTMLElement>('#boot-status');
  const log = $<HTMLElement>('#boot-log');

  if (!boot || !bar || !percent || !status) return;

  boot.style.setProperty('--boot-accent', config.theme.accent || '#0066FF');

  const fallback = [
    'LINK HANDSHAKE',
    'IDENTITY VERIFY',
    'ARCHIVE SYNC',
    'SIGNAL ACQUIRED',
  ];
  const stages = [...config.boot.messages];

  while (stages.length < 4) {
    stages.push(fallback[stages.length]);
  }

  const lines: HTMLElement[] = [];

  if (log) {
    log.replaceChildren();
    stages.slice(0, 4).forEach((label, index) => {
      const line = document.createElement('span');
      line.className = 'boot-log-line';

      const idx = document.createElement('i');
      idx.textContent = pad(index);

      const text = document.createElement('b');
      text.textContent = label;

      const state = document.createElement('em');
      state.textContent = 'WAIT';

      line.append(idx, text, state);
      log.append(line);
      lines.push(line);
    });
  }

  let progress = 0;
  let finished = false;
  let skipped = false;
  let frame = 0;
  let holdTimer = 0;

  const paint = () => {
    const value = Math.min(100, Math.max(0, progress));
    bar.style.height = `${value}%`;
    boot.style.setProperty('--boot-progress', `${value}%`);
    percent.textContent = pad(Math.round(value));
  };

  const setStatus = (text: string) => {
    status.textContent = text;
  };

  const setActive = (index: number) => {
    lines.forEach((line, lineIndex) => {
      line.classList.toggle('is-done', lineIndex < index);
      line.classList.toggle('is-active', lineIndex === index);
      const state = line.querySelector('em');
      if (!state) return;
      state.textContent =
        lineIndex < index ? 'OK' : lineIndex === index ? 'SYNC' : 'WAIT';
    });
  };

  const animate = (to: number, duration: number) =>
    new Promise<void>((resolve) => {
      if (reducedMotion.matches) {
        progress = to;
        paint();
        resolve();
        return;
      }

      const from = progress;
      const start = performance.now();

      const step = (now: number) => {
        if (finished) {
          resolve();
          return;
        }

        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        progress = from + (to - from) * eased;
        paint();

        if (t < 1) {
          frame = requestAnimationFrame(step);
        } else {
          progress = to;
          paint();
          resolve();
        }
      };

      frame = requestAnimationFrame(step);
    });

  const hold = async (ms: number, text: string) => {
    setStatus(text);
    boot.classList.add('is-holding');
    await new Promise<void>((resolve) => {
      holdTimer = window.setTimeout(resolve, ms);
    });
    boot.classList.remove('is-holding');
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    window.dispatchEvent(
      new CustomEvent('boot:done', { detail: { skipped } }),
    );
    cancelAnimationFrame(frame);
    window.clearTimeout(holdTimer);
    boot.classList.remove('is-holding');
    progress = 100;
    paint();
    setStatus(stages[3] ?? fallback[3]);
    setActive(lines.length);
    boot.classList.add('is-leaving');

    const delay = reducedMotion.matches ? 0 : 360;
    window.setTimeout(() => document.body.classList.add('is-ready'), delay);
    window.setTimeout(() => boot.remove(), reducedMotion.matches ? 140 : 1550);
  };

  const skip = () => {
    skipped = true;
    finish();
  };

  boot.addEventListener('click', skip);
  window.addEventListener('keydown', skip, { once: true });

  void (async () => {
    paint();
    setStatus(stages[0] ?? fallback[0]);
    setActive(0);

    await animate(30, 850);
    if (finished) return;
    setActive(1);
    await hold(500, 'AUTHENTICATING // 身份校验');
    if (finished) return;

    setStatus(stages[1] ?? fallback[1]);
    await animate(60, 650);
    if (finished) return;
    setActive(2);
    await hold(500, 'SYNCING ARCHIVE // 档案同步');
    if (finished) return;

    setStatus(stages[2] ?? fallback[2]);
    await animate(100, 750);
    if (finished) return;
    setActive(lines.length);
    setStatus(stages[3] ?? fallback[3]);

    if (document.readyState !== 'complete') {
      await new Promise<void>((resolve) => {
        window.addEventListener('load', () => resolve(), { once: true });
        window.setTimeout(resolve, 1200);
      });
    }

    finish();
  })();
}

/* --------------------------------------------------------------------------
   Header clock
   -------------------------------------------------------------------------- */

function setupClock() {
  const clock = $('#clock');
  if (!clock) return;

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.clock.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const tick = () => {
    clock.textContent = `${formatter.format(new Date())} ${config.clock.label}`;
  };

  tick();
  window.setInterval(tick, 1000);
}

/* --------------------------------------------------------------------------
   Live telemetry strip (decorative)
   -------------------------------------------------------------------------- */

function setupTelemetry() {
  const value = $('#telemetry-value');
  const hex = $('#telemetry-hex');
  const bars = $$<HTMLElement>('.telemetry-bar i');

  if (!value && !hex && bars.length === 0) return;

  const update = () => {
    if (value) {
      value.textContent = `SIG ${(96 + Math.random() * 3.8).toFixed(1)}`;
    }

    for (const bar of bars) {
      bar.style.setProperty(
        '--v',
        `${Math.round(52 + Math.random() * 45)}%`,
      );
    }

    if (hex) {
      const code = Math.floor(Math.random() * 0xffff)
        .toString(16)
        .toUpperCase()
        .padStart(4, '0');
      hex.textContent = `0x${code}`;
    }
  };

  update();
  if (reducedMotion.matches) return;
  window.setInterval(update, 2600);
}

/* --------------------------------------------------------------------------
   Scroll state + hero parallax
   -------------------------------------------------------------------------- */

function setupScroll() {
  const header = $('#site-header');
  const progressBar = $<HTMLElement>('#scroll-progress-bar');
  const heroType = $<HTMLElement>('.hero-bg-type');
  const heroCopy = $<HTMLElement>('.hero-copy');

  let queued = false;

  const update = () => {
    queued = false;
    const scrollY = window.scrollY;
    const viewport = window.innerHeight;

    header?.classList.toggle('is-scrolled', scrollY > 36);
    document.body.classList.toggle('is-past-hero', scrollY > viewport * 0.72);

    const atBottom =
      scrollY + viewport >=
      document.documentElement.scrollHeight - 90;
    document.body.classList.toggle('is-at-bottom', atBottom);

    if (progressBar) {
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.width = `${max > 0 ? (scrollY / max) * 100 : 0}%`;
    }

    if (!reducedMotion.matches) {
      const clamped = Math.min(scrollY, viewport);

      if (heroType) {
        heroType.style.transform = `translate3d(0, ${clamped * 0.12}px, 0)`;
      }

      if (heroCopy) {
        heroCopy.style.transform = `translate3d(0, ${clamped * 0.035}px, 0)`;
        heroCopy.style.opacity = String(
          Math.max(0, 1 - clamped / (viewport * 0.96)),
        );
      }
    }
  };

  window.addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );

  update();
}

/* --------------------------------------------------------------------------
   Reveal on scroll
   -------------------------------------------------------------------------- */

function setupReveals() {
  const items = $$('[data-reveal]');
  if (items.length === 0) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-in'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, instance) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        instance.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );

  items.forEach((item) => observer.observe(item));
}

/* --------------------------------------------------------------------------
   Profile stats: count-up + live site-age counter
   -------------------------------------------------------------------------- */

function setupStats() {
  const numbers = $$<HTMLElement>('#profile-stats .stat-number');
  if (numbers.length === 0) return;

  const animate = (element: HTMLElement) => {
    const target = Number(element.dataset.value);
    if (!Number.isFinite(target)) return;

    if (reducedMotion.matches) {
      element.textContent = String(target);
      return;
    }

    const duration = 1400;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      element.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(step);
      else element.textContent = String(target);
    };

    requestAnimationFrame(step);
  };

  if (!('IntersectionObserver' in window)) {
    numbers.forEach(animate);
  } else {
    const observer = new IntersectionObserver(
      (entries, instance) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          instance.unobserve(entry.target);
          animate(entry.target as HTMLElement);
        }
      },
      { threshold: 0.4 },
    );

    numbers.forEach((element) => observer.observe(element));
  }

  const live = numbers.filter((element) => element.dataset.since);
  if (live.length === 0) return;

  // Recompute the day counter once a minute so it rolls over at midnight.
  window.setInterval(() => {
    for (const element of live) {
      const days = daysSince(element.dataset.since ?? '');
      if (days <= 0) continue;

      const next = String(days);
      if (next === element.dataset.value) continue;

      element.dataset.value = next;
      element.textContent = next;

      const row = element.closest('.stat');
      const label = row?.querySelector('small')?.textContent ?? '';
      const suffix = row?.querySelector('sup')?.textContent ?? '';
      row?.setAttribute('aria-label', `${next}${suffix} ${label}`);
    }
  }, 60_000);
}

/* --------------------------------------------------------------------------
   Section transition preloader
   -------------------------------------------------------------------------- */

function setupSectionTransition() {
  const loader = $<HTMLElement>('#section-loader');
  const bar = $<HTMLElement>('#section-loader-bar');
  const indexEl = $<HTMLElement>('#section-loader-index');
  const nameEl = $<HTMLElement>('#section-loader-name');
  const statusEl = $<HTMLElement>('#section-loader-status');

  if (!loader || !bar || !indexEl || !nameEl || !statusEl) return;

  let busy = false;
  let frame = 0;
  let hideTimer = 0;

  const jumpTo = (section: HTMLElement) => {
    // scrollIntoView would otherwise inherit `scroll-behavior: smooth`.
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    section.scrollIntoView({ block: 'start' });
    root.style.scrollBehavior = previous;
  };

  const run = (id: string, section: HTMLElement) => {
    busy = true;
    window.clearTimeout(hideTimer);
    cancelAnimationFrame(frame);

    const nav = $<HTMLElement>(`[data-nav="${id}"]`);
    const index = nav?.querySelector('i')?.textContent?.trim() || '00';
    const labelCn = nav?.querySelector('span')?.textContent?.trim() || id;
    const labelEn = nav?.querySelector('small')?.textContent?.trim() || '';

    indexEl.textContent = index;
    nameEl.textContent = labelEn || labelCn;
    statusEl.textContent = `SYNCING // ${labelCn}`;
    bar.style.width = '0';

    loader.classList.remove('is-leaving');
    loader.classList.add('is-active');

    const duration = 760;
    const start = performance.now();
    let jumped = false;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      bar.style.width = `${eased * 100}%`;

      if (!jumped && t >= 0.45) {
        jumped = true;
        jumpTo(section);
        history.replaceState(null, '', `#${id}`);
      }

      if (t < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }

      loader.classList.add('is-leaving');
      hideTimer = window.setTimeout(() => {
        loader.classList.remove('is-active', 'is-leaving');
        bar.style.width = '0';
        busy = false;
      }, 280);
    };

    frame = requestAnimationFrame(tick);
  };

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

    const section = document.getElementById(id);
    if (!section || !section.matches('section[data-section]')) return;

    // Let the browser handle it when motion is reduced.
    if (reducedMotion.matches) return;

    event.preventDefault();
    if (busy) return;

    run(id, section);
  });
}

/* --------------------------------------------------------------------------
   Section spy
   -------------------------------------------------------------------------- */

function setupSectionSpy() {
  const sections = $$<HTMLElement>('section[data-section]');
  const navLinks = $$<HTMLElement>('[data-nav]');
  const railDots = $$<HTMLElement>('[data-rail]');

  if (sections.length === 0) return;

  const activate = (id: string) => {
    for (const link of navLinks) {
      link.classList.toggle('is-active', link.dataset.nav === id);
    }
    for (const dot of railDots) {
      dot.classList.toggle('is-active', dot.dataset.rail === id);
    }

    // Keep the address bar in sync with the section being read.
    if (window.location.hash !== `#${id}`) {
      history.replaceState(null, '', `#${id}`);
    }
  };

  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = (entry.target as HTMLElement).dataset.section;
        if (id) activate(id);
      }
    },
    { rootMargin: '-42% 0px -52% 0px', threshold: 0 },
  );

  sections.forEach((section) => observer.observe(section));
}

/* --------------------------------------------------------------------------
   Mobile menu
   -------------------------------------------------------------------------- */

function setupMenu() {
  const button = $('#menu-btn');
  const nav = $('#main-nav');
  if (!button || !nav) return;

  const close = () => {
    nav.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', '打开菜单');
    document.body.classList.remove('menu-open');
  };

  button.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(isOpen));
    button.setAttribute('aria-label', isOpen ? '关闭菜单' : '打开菜单');
    document.body.classList.toggle('menu-open', isOpen);
  });

  $$('a', nav).forEach((link) => link.addEventListener('click', close));

  nav.addEventListener('click', (event) => {
    if (event.target === nav) close();
  });

  $('.brand')?.addEventListener('click', close);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 980) close();
  });
}

/* --------------------------------------------------------------------------
   Work carousel
   -------------------------------------------------------------------------- */

function setupCarousel() {
  const track = $<HTMLElement>('#work-track');
  const prev = $('#work-prev') as HTMLButtonElement | null;
  const next = $('#work-next') as HTMLButtonElement | null;
  const current = $('#work-current');
  const progress = $<HTMLElement>('#work-progress');
  const scrollbar = $<HTMLElement>('#work-scrollbar');

  if (!track || !prev || !next || !current || !progress) return;

  const cards = $$<HTMLElement>('.work-card', track);

  const step = () => {
    const card = track.querySelector<HTMLElement>('.work-card');
    if (!card) return 320;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 16;
    return card.getBoundingClientRect().width + gap;
  };

  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    const ratio =
      max > 0 ? Math.min(1, Math.max(0, track.scrollLeft / max)) : 1;
    const thumb =
      max > 0
        ? Math.min(1, Math.max(0.12, track.clientWidth / track.scrollWidth))
        : 1;
    const index = Math.min(
      cards.length,
      Math.max(1, Math.round(track.scrollLeft / step()) + 1),
    );

    progress.style.width = `${thumb * 100}%`;
    progress.style.left = `${ratio * (1 - thumb) * 100}%`;

    if (scrollbar) {
      scrollbar.classList.toggle('is-idle', max <= 2);
      scrollbar.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    }

    current.textContent = pad(index);
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max - 2;
  };

  const scrollToCard = (direction: number) => {
    track.scrollBy({
      left: direction * step(),
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
    });
  };

  prev.addEventListener('click', () => scrollToCard(-1));
  next.addEventListener('click', () => scrollToCard(1));

  let queued = false;
  track.addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        update();
      });
    },
    { passive: true },
  );

  window.addEventListener('resize', update);
  update();

  // Mouse drag (touch devices use native momentum scrolling).
  let dragging = false;
  let startX = 0;
  let startLeft = 0;
  let moved = false;

  track.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    dragging = true;
    moved = false;
    startX = event.clientX;
    startLeft = track.scrollLeft;
  });

  window.addEventListener(
    'pointermove',
    (event) => {
      if (!dragging) return;
      const delta = event.clientX - startX;
      if (Math.abs(delta) > 5) {
        moved = true;
        track.classList.add('is-dragging');
      }
      if (moved) track.scrollLeft = startLeft - delta;
    },
    { passive: true },
  );

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-dragging');
  };

  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  window.addEventListener('blur', endDrag);

  track.addEventListener(
    'click',
    (event) => {
      if (!moved) return;
      event.preventDefault();
      event.stopPropagation();
      moved = false;
    },
    true,
  );

  // Vertical wheel becomes horizontal scrolling while the pointer is over the
  // project list; at either end the page scrolls normally again.
  let wheelTimer = 0;
  track.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) return;

      const raw =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (!raw) return;

      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? track.clientWidth
            : 1;
      const delta = raw * unit;
      const max = track.scrollWidth - track.clientWidth;
      if (max <= 0) return;

      if (
        (delta < 0 && track.scrollLeft <= 0) ||
        (delta > 0 && track.scrollLeft >= max - 1)
      ) {
        return;
      }

      event.preventDefault();
      track.classList.add('is-wheeling');
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(
        () => track.classList.remove('is-wheeling'),
        140,
      );
      track.scrollLeft += delta;
    },
    { passive: false },
  );

  // Draggable scrollbar for the carousel.
  if (scrollbar) {
    let scrubbing = false;

    const scrubTo = (clientX: number) => {
      const rect = scrollbar.getBoundingClientRect();
      if (rect.width <= 0) return;

      const ratio = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / rect.width),
      );
      const max = track.scrollWidth - track.clientWidth;
      track.scrollLeft = ratio * Math.max(0, max);
    };

    scrollbar.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;

      scrubbing = true;
      scrollbar.classList.add('is-dragging');
      track.classList.add('is-dragging');
      scrollbar.setPointerCapture(event.pointerId);
      scrubTo(event.clientX);
      event.preventDefault();
    });

    scrollbar.addEventListener('pointermove', (event) => {
      if (scrubbing) scrubTo(event.clientX);
    });

    const endScrub = () => {
      if (!scrubbing) return;
      scrubbing = false;
      scrollbar.classList.remove('is-dragging');
      track.classList.remove('is-dragging');
    };

    scrollbar.addEventListener('pointerup', endScrub);
    scrollbar.addEventListener('pointercancel', endScrub);

    scrollbar.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      scrollToCard(event.key === 'ArrowRight' ? 1 : -1);
    });
  }
}

/* --------------------------------------------------------------------------
   Custom cursor
   -------------------------------------------------------------------------- */

function setupCursor() {
  const cursor = $<HTMLElement>('#cursor');
  if (!cursor) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (reducedMotion.matches) return;

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  let targetX = x;
  let targetY = y;
  let visible = false;

  const render = () => {
    x += (targetX - x) * 0.18;
    y += (targetY - y) * 0.18;
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    requestAnimationFrame(render);
  };

  window.addEventListener(
    'pointermove',
    (event) => {
      targetX = event.clientX;
      targetY = event.clientY;

      if (!visible) {
        visible = true;
        cursor.style.opacity = '1';
      }

      const target = event.target as Element | null;
      const interactive = target?.closest('a, button, .work-card, .contact-card');
      cursor.classList.toggle('is-hover', Boolean(interactive));
    },
    { passive: true },
  );

  document.addEventListener('pointerleave', () => {
    cursor.style.opacity = '0';
    visible = false;
  });

  document.addEventListener('pointerenter', () => {
    cursor.style.opacity = '1';
    visible = true;
  });

  requestAnimationFrame(render);
}

/* --------------------------------------------------------------------------
   3D tilt: cards, avatar, hero hologram
   -------------------------------------------------------------------------- */

function setup3DTilt() {
  if (reducedMotion.matches) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const bindTilt = (element: HTMLElement, maxX: number, maxY: number) => {
    let frame = 0;

    const reset = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      element.style.setProperty('--tilt-x', '0deg');
      element.style.setProperty('--tilt-y', '0deg');
      element.classList.remove('is-tilting');
    };

    element.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'mouse' || frame) return;

        frame = requestAnimationFrame(() => {
          frame = 0;
          const rect = element.getBoundingClientRect();
          const nx = Math.min(
            1,
            Math.max(0, (event.clientX - rect.left) / rect.width),
          );
          const ny = Math.min(
            1,
            Math.max(0, (event.clientY - rect.top) / rect.height),
          );

          element.style.setProperty(
            '--tilt-x',
            `${((0.5 - ny) * maxX).toFixed(2)}deg`,
          );
          element.style.setProperty(
            '--tilt-y',
            `${((nx - 0.5) * maxY).toFixed(2)}deg`,
          );
          element.style.setProperty('--pointer-x', `${(nx * 100).toFixed(1)}%`);
          element.style.setProperty('--pointer-y', `${(ny * 100).toFixed(1)}%`);
          element.classList.add('is-tilting');
        });
      },
      { passive: true },
    );

    element.addEventListener('pointerleave', reset, { passive: true });
    element.addEventListener('pointercancel', reset, { passive: true });
  };

  $$<HTMLElement>('.work-card').forEach((card) => bindTilt(card, 9, 13));
  $$<HTMLElement>('.contact-card').forEach((card) => bindTilt(card, 8, 11));
  $$<HTMLElement>('.id-avatar').forEach((avatar) => bindTilt(avatar, 6, 9));

  const hero = $<HTMLElement>('.hero');
  const stage = $<HTMLElement>('.holo-stage');
  if (!hero || !stage) return;

  let holoFrame = 0;

  hero.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse' || holoFrame) return;

      holoFrame = requestAnimationFrame(() => {
        holoFrame = 0;
        const rect = hero.getBoundingClientRect();
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = (event.clientY - rect.top) / rect.height;
        stage.style.setProperty('--holo-x', ((nx - 0.5) * 2).toFixed(3));
        stage.style.setProperty('--holo-y', ((ny - 0.5) * 2).toFixed(3));
      });
    },
    { passive: true },
  );

  hero.addEventListener(
    'pointerleave',
    () => {
      stage.style.setProperty('--holo-x', '0');
      stage.style.setProperty('--holo-y', '0');
    },
    { passive: true },
  );
}

/* --------------------------------------------------------------------------
   Hitokoto quote card
   -------------------------------------------------------------------------- */

interface HitokotoResponse {
  hitokoto?: string;
  from?: string;
  from_who?: string | null;
}

function setupHitokoto() {
  const quote = config.profile.quote;
  const text = $<HTMLElement>('#quote-text');
  const source = $('#quote-source');
  const author = $('#quote-author');
  const refresh = $<HTMLButtonElement>('#quote-refresh');

  if (!text || !source || !author) return;
  if (quote.mode !== 'hitokoto' || !quote.endpoint) return;

  if (refresh) refresh.hidden = false;

  let controller: AbortController | null = null;

  const load = async () => {
    controller?.abort();
    controller = new AbortController();
    const timeout = window.setTimeout(() => controller?.abort(), 4500);

    if (refresh) {
      refresh.disabled = true;
      refresh.classList.add('is-loading');
    }

    try {
      const response = await fetch(quote.endpoint as string, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as HitokotoResponse;
      const sentence = data.hitokoto?.trim();
      if (!sentence) throw new Error('Empty hitokoto');

      text.textContent = sentence;

      const from = data.from?.trim() ?? '';
      const fromWho = data.from_who?.trim() ?? '';
      source.textContent = from ? `一言 · ${from}` : '一言';
      author.textContent = fromWho ? `— ${fromWho}` : '— Hitokoto';

      text.classList.remove('is-fresh');
      void text.offsetWidth;
      text.classList.add('is-fresh');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.warn('[hitokoto] keeping fallback:', error);
      }
    } finally {
      window.clearTimeout(timeout);
      if (refresh) {
        refresh.disabled = false;
        refresh.classList.remove('is-loading');
      }
    }
  };

  refresh?.addEventListener('click', () => void load());
  void load();
}

/* --------------------------------------------------------------------------
   Misc
   -------------------------------------------------------------------------- */

function setupMisc() {
  const canvas = $('#scene') as HTMLCanvasElement | null;
  if (canvas) {
    initBackground(canvas, {
      enabled: config.scene.enabled,
      accent: config.scene.accent,
      glow: config.scene.glow,
      techStack: config.techStack,
    });
  }

  const swarm = $('#swarm') as HTMLCanvasElement | null;
  if (swarm) {
    initSwarm(swarm, {
      ...config.swarm,
      accent: config.scene.accent,
      glow: config.scene.glow,
    });
  }
}

renderSite(config);

const morph = config.particles?.morph;
setupParticleImages({
  ...config.particles,
  morph: {
    ...morph,
    words: morph?.words?.length ? morph.words : config.techStack,
    interval: morph?.interval ?? 4,
    hold: morph?.hold ?? 1.5,
  },
});

setupBoot();
initPageIntro();
setupClock();
setupHitokoto();
initQuoteParticles({
  enabled:
    (config.particles?.enabled ?? true) &&
    (config.particles?.quote?.enabled ?? true),
  max: config.particles?.quote?.max,
});
setupTelemetry();
setupScroll();
setupReveals();
setupStats();
setupSectionTransition();
setupSectionSpy();
setupMenu();
setupCarousel();
setupCursor();
setup3DTilt();
setupMisc();
