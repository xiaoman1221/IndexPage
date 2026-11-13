import type {
  AvatarConfig,
  CapabilityItemConfig,
  ContactLinkConfig,
  IdFieldConfig,
  ProfileStatConfig,
  SiteConfig,
} from './config';

const $ = <T extends Element>(
  selector: string,
  root: ParentNode = document,
): T | null => root.querySelector<T>(selector);

const create = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const pad = (value: number) => String(value).padStart(2, '0');

const setText = (selector: string, value: string | undefined) => {
  const element = $(selector);
  if (element && value !== undefined) element.textContent = value;
};

const safeHref = (value: string | undefined, fallback = '#'): string => {
  if (!value) return fallback;
  const href = value.trim();
  if (/^(https?:\/\/|mailto:|tel:|\/|#|\.{1,2}\/)/i.test(href)) return href;
  return fallback;
};

const isExternal = (href: string, flag?: boolean): boolean =>
  Boolean(flag) || /^https?:\/\//i.test(href);

const safeColor = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  const color = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color;
  if (/^(rgb|hsl)a?\(/i.test(color)) return color;
  return fallback;
};

const colorLuminance = (color: string): number | null => {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!match) return null;

  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const numeric = Number.parseInt(hex, 16);
  const channels = [
    (numeric >> 16) & 255,
    (numeric >> 8) & 255,
    numeric & 255,
  ].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const readableOn = (color: string): string => {
  const luminance = colorLuminance(color);
  return luminance !== null && luminance > 0.45 ? '#070806' : '#ffffff';
};

const applyLink = (
  anchor: HTMLAnchorElement,
  href: string,
  external?: boolean,
) => {
  const safe = safeHref(href);
  anchor.href = safe;
  if (isExternal(safe, external)) {
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
  }
};

/* --------------------------------------------------------------------------
   Rich text: allow a tiny, safe subset of inline HTML from config.json
   -------------------------------------------------------------------------- */

const RICH_TAGS = new Set(['B', 'BR', 'EM', 'I', 'STRONG', 'SPAN', 'SMALL']);
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED']);

const richFragment = (html: string): DocumentFragment => {
  const template = document.createElement('template');
  template.innerHTML = html;

  const clean = (parent: ParentNode) => {
    for (const child of Array.from(parent.childNodes)) {
      if (!(child instanceof Element)) continue;

      const element = child;
      if (DROP_TAGS.has(element.tagName)) {
        element.remove();
        continue;
      }

      for (const attribute of Array.from(element.attributes)) {
        element.removeAttribute(attribute.name);
      }

      clean(element);

      if (!RICH_TAGS.has(element.tagName)) {
        const fragment = document.createDocumentFragment();
        while (element.firstChild) fragment.append(element.firstChild);
        element.replaceWith(fragment);
      }
    }
  };

  clean(template.content);
  return template.content;
};

const setRich = (selector: string, html: string | undefined) => {
  const element = $(selector);
  if (!element) return;
  element.replaceChildren(richFragment(html ?? ''));
};

/* --------------------------------------------------------------------------
   Section head
   -------------------------------------------------------------------------- */

interface SectionHead {
  index: string;
  title: string;
  titleEn: string;
  note: string;
}

const renderSectionHead = (prefix: string, section: SectionHead) => {
  setText(`#${prefix}-index`, section.index);
  setText(`#${prefix}-title`, section.title);
  setText(`#${prefix}-title-en`, section.titleEn);
  setText(`#${prefix}-note`, section.note);
};

/* --------------------------------------------------------------------------
   Meta / boot / brand / header / nav
   -------------------------------------------------------------------------- */

const renderMeta = (config: SiteConfig) => {
  document.documentElement.lang = config.meta.lang;
  document.title = config.meta.title;

  const description = $<HTMLMetaElement>('meta[name="description"]');
  if (description) description.content = config.meta.description;

  const ogTitle = $<HTMLMetaElement>('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = config.meta.title;

  const ogDescription = $<HTMLMetaElement>(
    'meta[property="og:description"]',
  );
  if (ogDescription) ogDescription.content = config.meta.description;

  const ogLocale = $<HTMLMetaElement>('meta[property="og:locale"]');
  if (ogLocale) ogLocale.content = config.meta.lang.replace('-', '_');

  let themeColor = $<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = create('meta');
    themeColor.name = 'theme-color';
    document.head.append(themeColor);
  }
  themeColor.content = config.meta.themeColor;

  const favicon = $<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = safeHref(config.meta.favicon, '/favicon.svg');

  const root = document.documentElement.style;
  const accent = safeColor(config.theme.accent, '#e6ff2e');
  root.setProperty('--acid', accent);
  root.setProperty('--on-acid', readableOn(accent));

  // The soft accent is optional: styles.css derives it from --acid when the
  // config does not provide an explicit value.
  const accentSoft = safeColor(config.theme.accentSoft, '');
  if (accentSoft) root.setProperty('--acid-soft', accentSoft);
};

const renderBoot = (config: SiteConfig) => {
  setText('#boot-kicker', config.boot.kicker);
  setText('#boot-title', config.boot.title);
  setText('#boot-hint', config.boot.hint);
  setText('#boot-brand-cn', config.brand.name);
  setText(
    '#boot-brand-en',
    `${config.brand.nameEn} / ${config.brand.alias}`,
  );
  setText(
    '#boot-legal',
    `${config.brand.nameEn} // PERSONAL ARCHIVE`,
  );
};

const renderBrand = (config: SiteConfig) => {
  const brand = $<HTMLAnchorElement>('.brand');
  if (brand) {
    brand.href = safeHref(config.brand.home, '#home');
    brand.setAttribute('aria-label', `${config.brand.name} 首页`);
  }

  setText('#brand-name', config.brand.name);
  setText('#brand-sub', `${config.brand.nameEn} / ${config.brand.alias}`);

  const logo = safeHref(config.brand.logo, '');
  const mark = $('#brand-mark');
  if (!logo || !mark) return;

  // Keep the built-in vector diamond as a fallback for a broken logo URL.
  const fallback = Array.from(mark.childNodes, (node) => node.cloneNode(true));

  const image = create('img');
  image.src = logo;
  image.alt = '';
  image.decoding = 'async';
  image.addEventListener('error', () => {
    image.remove();
    mark.replaceChildren(...fallback);
  });
  mark.replaceChildren(image);
};

const renderHeader = (config: SiteConfig) => {
  const cta = $<HTMLAnchorElement>('#header-cta');
  if (!cta) return;
  setText('#header-cta-label', config.header.cta.label);
  applyLink(cta, config.header.cta.href, config.header.cta.external);
};

const renderNav = (config: SiteConfig) => {
  const nav = $('#main-nav');
  const rail = $('.rail');
  const railCode = $('#rail-code');

  if (nav) {
    const fragment = document.createDocumentFragment();
    config.nav.forEach((item, index) => {
      const link = create('a', `nav-link${index === 0 ? ' is-active' : ''}`);
      applyLink(link, item.href);
      link.dataset.nav = item.id;
      link.setAttribute('aria-current', index === 0 ? 'location' : 'false');
      link.append(
        create('i', undefined, item.index),
        create('span', undefined, item.label),
        create('small', undefined, item.labelEn),
      );
      fragment.append(link);
    });
    nav.replaceChildren(fragment);
  }

  if (rail) {
    const fragment = document.createDocumentFragment();
    config.nav.forEach((item, index) => {
      const dot = create('a', `rail-dot${index === 0 ? ' is-active' : ''}`);
      applyLink(dot, item.href);
      dot.dataset.rail = item.id;
      dot.append(
        create('span', undefined, item.index),
        create('em', undefined, item.labelEn),
      );
      fragment.append(dot);
    });
    if (railCode) rail.insertBefore(fragment, railCode);
    else rail.append(fragment);
  }

  setText('#rail-line1', config.rail.line1);
  setText('#rail-line2', config.rail.line2);
};

/* --------------------------------------------------------------------------
   Hero
   -------------------------------------------------------------------------- */

const renderHero = (config: SiteConfig) => {
  const hero = config.hero;

  const bgType = $('#hero-bg-type');
  if (bgType) {
    const words = config.brand.nameEn.split(/\s+/).filter(Boolean);
    bgType.replaceChildren(...words.map((word) => create('span', undefined, word)));
  }

  const media = $('#hero-media');
  const imageSrc = safeHref(hero.image, '');
  if (media && imageSrc) {
    const image = create('img');
    image.src = imageSrc;
    image.alt = hero.imageAlt ?? '';
    image.decoding = 'async';
    image.addEventListener('error', () => image.remove());
    media.replaceChildren(image);
  }

  const eyebrow = $('#hero-eyebrow');
  if (eyebrow) {
    const fragment = document.createDocumentFragment();
    fragment.append(create('span', 'tick'));
    hero.eyebrow.forEach((part, index) => {
      if (index > 0) fragment.append(create('span', 'slash', '//'));
      fragment.append(create('span', undefined, part));
    });
    eyebrow.replaceChildren(fragment);
  }

  const title = $('#hero-title');
  if (title) {
    const fragment = document.createDocumentFragment();
    hero.title.forEach((line) => {
      const outer = create('span', 'line');
      const inner = create('span');
      inner.append(document.createTextNode(line.text));
      if (line.accent) inner.append(create('em', 'accent', line.accent));
      outer.append(inner);
      fragment.append(outer);
    });
    title.replaceChildren(fragment);
  }

  const subtitle = $('#hero-sub');
  if (subtitle) {
    const fragment = document.createDocumentFragment();
    if (hero.subtitleEn) {
      fragment.append(document.createTextNode(hero.subtitleEn), create('br'));
    }
    fragment.append(document.createTextNode(hero.subtitle));
    subtitle.replaceChildren(fragment);
  }

  const actions = $('#hero-actions');
  if (actions) {
    const fragment = document.createDocumentFragment();
    for (const action of hero.actions) {
      const style = action.style === 'primary' ? 'primary' : 'ghost';
      const link = create('a', `btn btn-${style}`);
      applyLink(link, action.href, action.external);

      const text = create('span', 'btn-text');
      text.append(
        create('b', undefined, action.label),
        create('small', undefined, action.labelEn),
      );

      const arrow = create(
        'i',
        'btn-arrow',
        isExternal(action.href, action.external) ? '↗' : '→',
      );
      link.append(text, arrow);
      fragment.append(link);
    }
    actions.replaceChildren(fragment);
  }

  const meta = $('#hero-meta');
  if (meta) {
    const fragment = document.createDocumentFragment();
    for (const item of hero.meta) {
      const row = create('div', 'meta-item');
      row.append(create('small', undefined, item.label));
      row.append(
        create('b', item.tone === 'online' ? 'is-online' : undefined, item.value),
      );
      fragment.append(row);
    }

    const cue = create('a', 'scroll-cue');
    applyLink(cue, hero.scrollCue.href);
    cue.append(create('span', undefined, hero.scrollCue.text), create('i'));
    fragment.append(cue);

    meta.replaceChildren(fragment);
  }

  setText('#sigil-lat', hero.sigil.lat);
  setText('#sigil-lng', hero.sigil.lng);
  setText('#sigil-alt', hero.sigil.alt);
  setText('#sigil-ref', hero.sigil.ref);
};

/* --------------------------------------------------------------------------
   Profile
   -------------------------------------------------------------------------- */

const renderStats = (container: Element | null, stats: ProfileStatConfig[]) => {
  if (!container) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fragment = document.createDocumentFragment();

  for (const stat of stats) {
    const row = create('div', 'stat');
    const value = create('b');
    const number = create('span', 'stat-number');

    number.dataset.value = stat.value;
    if (stat.since) number.dataset.since = stat.since;
    number.textContent = reduced ? stat.value : '0';

    value.append(number);
    if (stat.suffix) value.append(create('sup', undefined, stat.suffix));
    row.append(value, create('small', undefined, stat.label));
    row.setAttribute(
      'aria-label',
      `${stat.value}${stat.suffix ?? ''} ${stat.label}`,
    );
    fragment.append(row);
  }
  container.replaceChildren(fragment);
};

const renderAvatar = (avatar: AvatarConfig) => {
  const container = $('#id-avatar');
  if (!container) return;

  const monogram = $<HTMLElement>('#id-monogram');
  const caption = $('#id-caption');

  if (monogram) {
    monogram.textContent = avatar.fallback;
    monogram.hidden = false;
  }
  if (caption) caption.textContent = avatar.caption ?? '';

  container.querySelector('.id-photo')?.remove();

  const src = safeHref(avatar.image, '');
  if (!src) return;

  const image = create('img', 'id-photo');
  image.src = src;
  image.alt = avatar.alt;
  image.decoding = 'async';
  image.addEventListener('error', () => {
    image.remove();
    if (monogram) monogram.hidden = false;
  });

  if (monogram) monogram.hidden = true;
  const grid = container.querySelector('.id-avatar-grid');
  if (grid) grid.after(image);
  else container.prepend(image);
};

const renderIdFields = (container: Element | null, fields: IdFieldConfig[]) => {
  if (!container) return;

  const fragment = document.createDocumentFragment();
  for (const field of fields) {
    const row = create('div');
    row.append(create('dt', undefined, field.label));
    row.append(
      create('dd', field.tone === 'online' ? 'is-online' : undefined, field.value),
    );
    fragment.append(row);
  }
  container.replaceChildren(fragment);
};

const renderQuoteTerminal = (config: SiteConfig) => {
  const handle = `${config.brand.nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')}@ink`;
  document.querySelectorAll<HTMLElement>('.qt-user').forEach((element) => {
    element.textContent = handle;
  });
  setText(
    '#quote-state',
    config.profile.quote.mode === 'hitokoto' ? 'ONLINE' : 'STATIC',
  );
};

const renderProfile = (config: SiteConfig) => {
  const profile = config.profile;
  renderSectionHead('profile', profile);
  renderQuoteTerminal(config);

  setRich('#profile-intro', profile.introHtml);
  setText('#profile-bio', profile.bio);
  setRich('#quote-text', profile.quote.html);
  setText('#quote-source', profile.quote.source);
  setText('#quote-author', profile.quote.author);
  renderStats($('#profile-stats'), profile.stats);
  renderAvatar(profile.avatar);

  setText('#id-head-left', profile.idCard.headLeft);
  setText('#id-head-right', profile.idCard.headRight);
  renderIdFields($('#spec-list'), profile.idCard.fields);
  setText('#id-code', profile.idCard.code);
};

/* --------------------------------------------------------------------------
   Capabilities
   -------------------------------------------------------------------------- */

const renderCapItems = (items: CapabilityItemConfig[]) => {
  const list = $('#cap-list');
  if (!list) return;

  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => {
    const article = create('article', 'cap-item');
    article.setAttribute('data-reveal', '');
    article.style.setProperty('--d', `${(index * 0.05).toFixed(2)}s`);

    const main = create('div', 'cap-main');
    const heading = create('h3');
    heading.append(
      create('span', 'cap-title', item.title),
      create('small', undefined, item.titleEn),
    );
    main.append(heading, create('p', undefined, item.description));

    const tags = create('div', 'cap-tags');
    for (const tag of item.tags) tags.append(create('span', undefined, tag));

    const level = Math.max(0, Math.min(100, Number(item.level) || 0));
    const meter = create('div', 'cap-meter');
    const fill = create('i');
    fill.style.setProperty('--v', `${level}%`);
    meter.append(fill, create('em', undefined, String(level)));

    article.append(
      create('span', 'cap-index', item.no),
      main,
      tags,
      meter,
    );
    fragment.append(article);
  });

  list.replaceChildren(fragment);
};

const renderMarquee = (phrases: string[]) => {
  const marquee = $('#field-marquee');
  if (!marquee) return;

  const phrase = phrases.join(' · ');
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 6; index += 1) {
    fragment.append(create('span', undefined, `${phrase} · `));
  }
  marquee.replaceChildren(fragment);
};

const renderTechStack = (items: string[]) => {
  const container = $('#tech-stack-items');
  if (!container) return;

  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => {
    fragment.append(
      create('span', `tech-chip${index < 2 ? ' is-primary' : ''}`, item),
    );
  });
  container.replaceChildren(fragment);
};

const renderField = (config: SiteConfig) => {
  const field = config.capabilities;
  renderSectionHead('field', field);
  setText('#field-lead', field.lead);
  setText('#field-lead-note', field.leadNote);
  renderCapItems(field.items);
  renderTechStack(config.techStack ?? []);
  renderMarquee(field.marquee);
};

/* --------------------------------------------------------------------------
   Works
   -------------------------------------------------------------------------- */

const renderWorks = (config: SiteConfig) => {
  const works = config.works;
  renderSectionHead('works', works);
  setRich('#works-quote', works.quoteHtml);
  setText('#track-hint', works.hint);
  setText('#work-total', pad(works.items.length));

  const track = $('#work-track');
  if (!track) return;

  const fragment = document.createDocumentFragment();
  for (const item of works.items) {
    const external = isExternal(item.href);
    const card = create('article', 'work-card');
    card.style.setProperty('--accent', safeColor(item.accent, '#e6ff2e'));

    const link = create('a', 'work-link-wrap');
    applyLink(link, item.href, external);
    link.setAttribute(
      'aria-label',
      `${item.title}${external ? '，在新标签页打开' : ''}`,
    );

    const visual = create('div', 'work-visual');
    const imageSrc = safeHref(item.image, '');
    if (imageSrc) {
      const image = create('img', 'work-image');
      image.src = imageSrc;
      image.alt = item.imageAlt;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => image.remove());
      visual.append(image);
    }
    visual.append(
      create('span', 'work-serial', `SYS.${item.no} // LINK`),
      create('span', 'work-no', item.no),
      create('span', 'work-scan'),
    );

    const body = create('div', 'work-body');
    const tags = create('div', 'work-tags');
    for (const tag of item.tags) tags.append(create('span', undefined, tag));

    const foot = create('div', 'work-foot');
    foot.append(
      create('span', undefined, item.urlLabel),
      create('i', undefined, external ? '↗' : '→'),
    );

    body.append(
      tags,
      create('h3', undefined, item.title),
      create('p', undefined, item.description),
      foot,
      create('span', 'work-client', item.client),
    );

    link.append(visual, body);
    card.append(link);
    fragment.append(card);
  }

  track.replaceChildren(fragment);
};

/* --------------------------------------------------------------------------
   Contact
   -------------------------------------------------------------------------- */

const renderContactLinks = (links: ContactLinkConfig[]) => {
  const grid = $('#contact-grid');
  if (!grid) return;

  const fragment = document.createDocumentFragment();
  for (const link of links) {
    const anchor = create('a', 'contact-card');
    applyLink(anchor, link.href, link.external);
    anchor.setAttribute('aria-label', `${link.label}：${link.value}`);
    anchor.append(
      create('span', 'contact-no', link.no),
      create('span', 'contact-label', link.label),
      create('b', undefined, link.value),
      create('i', undefined, isExternal(link.href, link.external) ? '↗' : '→'),
    );
    fragment.append(anchor);
  }
  grid.replaceChildren(fragment);
};

const renderContact = (config: SiteConfig) => {
  const contact = config.contact;
  renderSectionHead('contact', contact);

  const kicker = $('#contact-kicker');
  if (kicker) {
    kicker.replaceChildren(
      document.createTextNode(`${contact.kicker} `),
      create('span', undefined, contact.kickerEmoji),
    );
  }

  const address = contact.email.trim();
  const mailHref = safeHref(
    address.includes('@') ? `mailto:${address}` : address,
    '#',
  );
  const mail = $<HTMLAnchorElement>('#contact-email');
  if (mail) {
    mail.href = mailHref;
    setText('#contact-email-text', address);
    if (address) mail.setAttribute('aria-label', address);
  }

  const open = $<HTMLAnchorElement>('#contact-open');
  if (open && address) open.href = mailHref;

  setText('#contact-lead', contact.lead);
  setText('#contact-availability', contact.availability);
  setText('#contact-response', contact.response);
  setText('#contact-base', contact.base);
  setText('#contact-language', contact.language);
  setText('#contact-panel-note', contact.panelNote);

  const protocol = $('#contact-protocol-grid');
  if (protocol) {
    const fragment = document.createDocumentFragment();
    contact.protocol.forEach((step, index) => {
      const item = create('div', 'contact-protocol-step');
      item.append(
        create(
          'span',
          'contact-protocol-no',
          String(index + 1).padStart(2, '0'),
        ),
        create('b', undefined, step.label),
        create('p', undefined, step.text),
      );
      fragment.append(item);
    });
    protocol.replaceChildren(fragment);
    if (contact.protocol.length === 0) {
      protocol.closest('.contact-protocol')?.setAttribute('hidden', '');
    }
  }

  const line = $('#contact-line');
  if (line) {
    line.replaceChildren(
      document.createTextNode(contact.line),
      create('span', 'accent', contact.lineEmoji),
    );
  }

  renderContactLinks(contact.links);
};

/* --------------------------------------------------------------------------
   Ticker / footer
   -------------------------------------------------------------------------- */

const renderTicker = (phrases: string[]) => {
  const ticker = $('#ticker-track');
  if (!ticker) return;

  const fragment = document.createDocumentFragment();
  const addGroup = () => {
    for (const phrase of phrases) {
      fragment.append(
        create('span', undefined, phrase),
        create('i', undefined, '◆'),
      );
    }
  };
  addGroup();
  addGroup();
  ticker.replaceChildren(fragment);
};

const renderFooter = (config: SiteConfig) => {
  const copy = $('#footer-copy');
  if (copy) copy.textContent = config.footer.copyright;

  const credits = $('#footer-credits');
  if (credits) {
    const fragment = document.createDocumentFragment();
    for (const segment of config.footer.credits) {
      if (segment.href) {
        const anchor = create('a', undefined, segment.text);
        applyLink(anchor, segment.href, segment.external);
        fragment.append(anchor);
      } else {
        fragment.append(document.createTextNode(segment.text));
      }
    }
    credits.replaceChildren(fragment);
  }

  const top = $<HTMLAnchorElement>('#footer-top');
  if (top) {
    applyLink(top, '#home');
    top.replaceChildren(
      document.createTextNode(`${config.footer.backToTop} `),
      create('i', undefined, '↑'),
    );
  }

  const filings = $('#footer-filings');
  if (filings) {
    // ICP / police / custom links are optional; empty entries are hidden.
    const items = [
      config.footer.icp,
      config.footer.police,
      config.footer.customLink,
    ]
      .map((item) => ({
        label: item?.label?.trim() ?? '',
        href: item?.href?.trim() ?? '',
        external: item?.external,
      }))
      .filter((item) => item.label !== '' && item.href !== '');

    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      if (index > 0) fragment.append(create('i', undefined, '·'));
      const anchor = create('a', undefined, item.label);
      applyLink(anchor, item.href, item.external);
      fragment.append(anchor);
    });
    filings.replaceChildren(fragment);
  }
};

/* --------------------------------------------------------------------------
   Entry
   -------------------------------------------------------------------------- */

export const renderSite = (config: SiteConfig) => {
  renderMeta(config);
  renderBoot(config);
  renderBrand(config);
  renderHeader(config);
  renderNav(config);
  renderHero(config);
  renderProfile(config);
  renderField(config);
  renderWorks(config);
  renderContact(config);
  renderTicker(config.ticker);
  renderFooter(config);
};
