import rawJson from '../config.json';
import { daysSince, pad } from './util';

/**
 * `config.json` is the only content source of the page. It intentionally
 * contains no derived data: section numbers, item numbers, day counters,
 * default copy and link targets are filled in here, so the JSON stays short
 * and editing it cannot leave duplicated values out of sync.
 */

/* --------------------------------------------------------------------------
   Raw shapes (what config.json may contain)
   -------------------------------------------------------------------------- */

export interface RawLinkConfig {
  label: string;
  href: string;
  external?: boolean;
}

export interface RawNavItem {
  id: string;
  label: string;
  labelEn?: string;
  index?: string;
  href?: string;
}

export interface RawHeroActionConfig {
  label: string;
  labelEn?: string;
  href: string;
  style?: string;
  external?: boolean;
}

export interface RawHeroMetaConfig {
  label: string;
  value: string;
  tone?: string;
}

export interface RawHeroTitleLine {
  text: string;
  accent?: string;
}

export interface RawHeroSigilConfig {
  lat?: string;
  lng?: string;
  alt?: string;
  ref?: string;
}

export interface RawHeroConfig {
  image?: string;
  imageAlt?: string;
  eyebrow?: string[];
  title?: RawHeroTitleLine[];
  subtitleEn?: string;
  subtitle?: string;
  actions?: RawHeroActionConfig[];
  meta?: RawHeroMetaConfig[];
  scrollCue?: { text?: string; href?: string };
  sigil?: RawHeroSigilConfig;
}

export interface RawProfileStatConfig {
  value?: string;
  suffix?: string;
  label: string;
  /** ISO date. When set, the value becomes a live day count from this date. */
  since?: string;
}

export interface RawIdFieldConfig {
  label: string;
  value: string;
  tone?: string;
}

export interface RawQuoteConfig {
  mode?: 'static' | 'hitokoto';
  endpoint?: string;
  html?: string;
  source?: string;
  author?: string;
}

export interface RawProfileConfig {
  title?: string;
  titleEn?: string;
  note?: string;
  introHtml?: string;
  bio?: string;
  quote?: RawQuoteConfig;
  stats?: RawProfileStatConfig[];
  avatar?: {
    image?: string;
    alt?: string;
    fallback?: string;
    caption?: string;
  };
  idCard?: {
    headLeft?: string;
    headRight?: string;
    fields?: RawIdFieldConfig[];
    code?: string;
  };
}

export interface RawCapabilityItemConfig {
  no?: string;
  title: string;
  titleEn?: string;
  description?: string;
  tags?: string[];
  level?: number;
}

export interface RawCapabilitiesConfig {
  title?: string;
  titleEn?: string;
  note?: string;
  lead?: string;
  leadNote?: string;
  marquee?: string[];
  items?: RawCapabilityItemConfig[];
}

export interface RawWorkItemConfig {
  no?: string;
  title: string;
  description?: string;
  client?: string;
  href: string;
  /** Footer URL label. Defaults to the URL without its protocol. */
  urlLabel?: string;
  image?: string;
  imageAlt?: string;
  tags?: string[];
  accent?: string;
}

export interface RawWorksConfig {
  title?: string;
  titleEn?: string;
  note?: string;
  quoteHtml?: string;
  hint?: string;
  items?: RawWorkItemConfig[];
}

export interface RawContactLinkConfig {
  no?: string;
  label: string;
  /** Shown on the card. Defaults to the URL without its protocol. */
  value?: string;
  href: string;
  external?: boolean;
}

export interface RawContactConfig {
  title?: string;
  titleEn?: string;
  note?: string;
  kicker?: string;
  kickerEmoji?: string;
  email?: string;
  line?: string;
  lineEmoji?: string;
  lead?: string;
  availability?: string;
  response?: string;
  base?: string;
  language?: string;
  panelNote?: string;
  protocol?: Array<{ label: string; text: string }>;
  links?: RawContactLinkConfig[];
}

export interface RawParticleImageConfig {
  max?: number;
  size?: number;
  interactive?: boolean;
  scatter?: number;
  blend?: 'source-over' | 'lighter';
  lumaCutoff?: number;
  dotMatrix?: boolean;
  dotSpacing?: number;
  dotColor?: string;
  includeBackground?: boolean;
}

export interface RawParticleMorphConfig {
  enabled?: boolean;
  words?: string[];
  interval?: number;
  scatter?: number;
  gather?: number;
  hold?: number;
}

export interface RawParticlesConfig extends RawParticleImageConfig {
  enabled?: boolean;
  density?: number;
  morph?: RawParticleMorphConfig;
  quote?: { enabled?: boolean; max?: number };
  hero?: RawParticleImageConfig;
  avatar?: RawParticleImageConfig;
  works?: RawParticleImageConfig;
}

export interface RawFooterSegmentConfig {
  text: string;
  href?: string;
  external?: boolean;
}

export interface RawFooterFilingConfig {
  label?: string;
  href?: string;
  external?: boolean;
}

export interface RawFooterConfig {
  copyright?: string;
  icp?: RawFooterFilingConfig;
  police?: RawFooterFilingConfig;
  customLink?: RawFooterFilingConfig;
  credits?: RawFooterSegmentConfig[];
  backToTop?: string;
}

export interface RawSiteConfig {
  meta: {
    lang?: string;
    title: string;
    description: string;
    favicon?: string;
    themeColor?: string;
  };
  theme: { accent: string; accentSoft?: string };
  brand: {
    name: string;
    nameEn: string;
    alias?: string;
    logo?: string;
    home?: string;
  };
  header: { cta: RawLinkConfig };
  clock?: { timezone?: string; label?: string };
  nav: RawNavItem[];
  rail?: { line1?: string; line2?: string };
  boot?: { kicker?: string; title?: string; hint?: string; messages?: string[] };
  scene?: { enabled?: boolean; accent?: string; glow?: string };
  swarm?: { enabled?: boolean; density?: number; interactive?: boolean };
  particles?: RawParticlesConfig;
  /** Particle → text assembly used when a section enters the viewport. */
  assembly?: { enabled?: boolean; max?: number };
  hero: RawHeroConfig;
  profile: RawProfileConfig;
  capabilities: RawCapabilitiesConfig;
  works: RawWorksConfig;
  contact: RawContactConfig;
  techStack?: string[];
  ticker?: string[];
  footer?: RawFooterConfig;
}

/* --------------------------------------------------------------------------
   Defaults
   -------------------------------------------------------------------------- */

const DEFAULT_BOOT_MESSAGES = [
  'LINK HANDSHAKE',
  'IDENTITY VERIFY',
  'ARCHIVE SYNC',
  'SIGNAL ACQUIRED',
];

const DEFAULT_BOOT_HINT = 'CLICK ANYWHERE TO SKIP / 点击跳过';

const initialsOf = (name: string): string =>
  name
    .split(/[\s·]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

/** `https://www.example.com/` → `www.example.com` */
const shortenHref = (href: string): string =>
  href.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '');

/**
 * Replaces the `{year}` token in every string of the resolved config, so
 * footers, ID cards and copy can stay correct without manual edits.
 */
const fillYearTokens = (value: unknown, year: string): unknown => {
  if (typeof value === 'string') return value.replace(/\{year\}/g, year);
  if (Array.isArray(value)) {
    return value.map((item) => fillYearTokens(item, year));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        fillYearTokens(item, year),
      ]),
    );
  }
  return value;
};

/* --------------------------------------------------------------------------
   Resolver
   -------------------------------------------------------------------------- */

const resolveConfig = (raw: RawSiteConfig) => {
  const nav = raw.nav.map((item, position) => ({
    id: item.id,
    index: item.index ?? pad(position),
    label: item.label,
    labelEn: item.labelEn ?? item.label,
    href: item.href ?? `#${item.id}`,
  }));

  /** Section number taken from the matching nav entry (`home` → `00`). */
  const sectionIndex = (id: string): string => {
    const position = raw.nav.findIndex((item) => item.id === id);
    return position < 0 ? '' : pad(position);
  };

  const brand = {
    name: raw.brand.name,
    nameEn: raw.brand.nameEn,
    alias: raw.brand.alias ?? raw.brand.name,
    logo: raw.brand.logo,
    home: raw.brand.home ?? '#home',
  };

  const accent = raw.theme.accent;
  const particles = raw.particles ?? {};
  const profile = raw.profile;
  const idCard = profile.idCard ?? {};

  const resolved = {
    meta: {
      lang: raw.meta.lang ?? 'zh-CN',
      title: raw.meta.title,
      description: raw.meta.description,
      favicon: raw.meta.favicon ?? '/favicon.svg',
      themeColor: raw.meta.themeColor ?? accent,
    },
    theme: {
      accent,
      accentSoft: raw.theme.accentSoft,
    },
    brand,
    header: {
      cta: {
        label: raw.header.cta.label,
        href: raw.header.cta.href,
        external: raw.header.cta.external,
      },
    },
    clock: {
      timezone: raw.clock?.timezone ?? 'Asia/Shanghai',
      label: raw.clock?.label ?? 'CST',
    },
    nav,
    rail: {
      line1: raw.rail?.line1 ?? '',
      line2: raw.rail?.line2 ?? '',
    },
    boot: {
      kicker: raw.boot?.kicker ?? '',
      title: raw.boot?.title ?? '',
      hint: raw.boot?.hint ?? DEFAULT_BOOT_HINT,
      messages: raw.boot?.messages?.length
        ? [...raw.boot.messages]
        : [...DEFAULT_BOOT_MESSAGES],
    },
    scene: {
      enabled: raw.scene?.enabled ?? true,
      accent: raw.scene?.accent ?? '#e6ff2e',
      glow: raw.scene?.glow ?? '#ffff96',
    },
    swarm: {
      enabled: raw.swarm?.enabled ?? true,
      density: raw.swarm?.density ?? 1,
      interactive: raw.swarm?.interactive ?? true,
    },
    particles: {
      enabled: particles.enabled ?? true,
      density: particles.density ?? 1,
      dotMatrix: particles.dotMatrix ?? true,
      dotSpacing: particles.dotSpacing ?? 10,
      dotColor: particles.dotColor ?? '#ffffff',
      morph: {
        enabled: particles.morph?.enabled ?? true,
        words: particles.morph?.words ?? raw.techStack ?? [],
        interval: particles.morph?.interval ?? 4,
        scatter: particles.morph?.scatter,
        gather: particles.morph?.gather,
        hold: particles.morph?.hold ?? 1.5,
      },
      quote: {
        enabled: particles.quote?.enabled ?? true,
        max: particles.quote?.max ?? 2600,
      },
      hero: particles.hero ?? {},
      avatar: particles.avatar ?? {},
      works: particles.works ?? {},
    },
    assembly: {
      enabled: raw.assembly?.enabled ?? true,
      max: raw.assembly?.max ?? 3200,
    },
    hero: {
      image: raw.hero.image,
      imageAlt: raw.hero.imageAlt ?? '',
      eyebrow: raw.hero.eyebrow ?? [],
      title: raw.hero.title ?? [],
      subtitleEn: raw.hero.subtitleEn ?? '',
      subtitle: raw.hero.subtitle ?? '',
      actions: (raw.hero.actions ?? []).map((action) => ({
        label: action.label,
        labelEn: action.labelEn ?? '',
        href: action.href,
        style: action.style ?? 'ghost',
        external: action.external,
      })),
      meta: raw.hero.meta ?? [],
      scrollCue: {
        text: raw.hero.scrollCue?.text ?? 'SCROLL TO EXPLORE',
        href: raw.hero.scrollCue?.href ?? '#profile',
      },
      sigil: {
        lat: raw.hero.sigil?.lat ?? '',
        lng: raw.hero.sigil?.lng ?? '',
        alt: raw.hero.sigil?.alt ?? '',
        ref: raw.hero.sigil?.ref ?? '',
      },
    },
    profile: {
      index: sectionIndex('profile'),
      title: profile.title ?? '',
      titleEn: profile.titleEn ?? '',
      note: profile.note ?? '',
      introHtml: profile.introHtml ?? '',
      bio: profile.bio ?? '',
      quote: {
        mode: profile.quote?.mode ?? 'static',
        endpoint: profile.quote?.endpoint,
        html: profile.quote?.html ?? '',
        source: profile.quote?.source ?? '',
        author: profile.quote?.author ?? '',
      },
      stats: (profile.stats ?? []).map((stat) => ({
        value:
          stat.value ??
          (stat.since ? String(daysSince(stat.since)) : '0'),
        suffix: stat.suffix,
        label: stat.label,
        since: stat.since,
      })),
      avatar: {
        image: profile.avatar?.image ?? brand.logo,
        alt: profile.avatar?.alt ?? '',
        fallback: profile.avatar?.fallback ?? initialsOf(brand.nameEn),
        caption: profile.avatar?.caption ?? '',
      },
      idCard: {
        headLeft: idCard.headLeft ?? 'OPERATOR / IDENTITY CARD',
        headRight: idCard.headRight ?? '',
        fields: idCard.fields ?? [],
        code: idCard.code ?? '',
      },
    },
    capabilities: {
      index: sectionIndex('field'),
      title: raw.capabilities.title ?? '',
      titleEn: raw.capabilities.titleEn ?? '',
      note: raw.capabilities.note ?? '',
      lead: raw.capabilities.lead ?? '',
      leadNote: raw.capabilities.leadNote ?? '',
      marquee: raw.capabilities.marquee ?? [],
      items: (raw.capabilities.items ?? []).map((item, position) => ({
        no: item.no ?? pad(position + 1),
        title: item.title,
        titleEn: item.titleEn ?? '',
        description: item.description ?? '',
        tags: item.tags ?? [],
        level: item.level ?? 0,
      })),
    },
    works: {
      index: sectionIndex('works'),
      title: raw.works.title ?? '',
      titleEn: raw.works.titleEn ?? '',
      note: raw.works.note ?? '',
      quoteHtml: raw.works.quoteHtml ?? '',
      hint: raw.works.hint ?? '',
      items: (raw.works.items ?? []).map((item, position) => ({
        no: item.no ?? pad(position + 1),
        title: item.title,
        description: item.description ?? '',
        client: item.client ?? '',
        href: item.href,
        urlLabel: item.urlLabel ?? shortenHref(item.href),
        image: item.image,
        imageAlt: item.imageAlt ?? item.title,
        tags: item.tags ?? [],
        accent: item.accent,
      })),
    },
    contact: {
      index: sectionIndex('contact'),
      title: raw.contact.title ?? '',
      titleEn: raw.contact.titleEn ?? '',
      note: raw.contact.note ?? '',
      kicker: raw.contact.kicker ?? '',
      kickerEmoji: raw.contact.kickerEmoji ?? '',
      email: raw.contact.email ?? '',
      line: raw.contact.line ?? '',
      lineEmoji: raw.contact.lineEmoji ?? '',
      lead: raw.contact.lead ?? '',
      availability: raw.contact.availability ?? '',
      response: raw.contact.response ?? '',
      base: raw.contact.base ?? '',
      language: raw.contact.language ?? '',
      panelNote: raw.contact.panelNote ?? '',
      protocol: (raw.contact.protocol ?? []).map((step) => ({
        label: step.label,
        text: step.text,
      })),
      links: (raw.contact.links ?? []).map((link, position) => ({
        no: link.no ?? pad(position + 1),
        label: link.label,
        value: link.value ?? shortenHref(link.href),
        href: link.href,
        external: link.external,
      })),
    },
    techStack: raw.techStack ?? [],
    ticker: raw.ticker ?? [],
    footer: {
      copyright: raw.footer?.copyright ?? `© {year} ${brand.name}`,
      icp: raw.footer?.icp,
      police: raw.footer?.police,
      customLink: raw.footer?.customLink,
      credits: raw.footer?.credits ?? [],
      backToTop: raw.footer?.backToTop ?? 'BACK TO TOP',
    },
  };

  return fillYearTokens(
    resolved,
    String(new Date().getFullYear()),
  ) as typeof resolved;
};

export const config = resolveConfig(rawJson as RawSiteConfig);

/** Fully resolved configuration: every field the UI reads is present. */
export type SiteConfig = typeof config;

/* Aliases used by the renderer, so it never has to repeat the nested paths. */
export type AvatarConfig = SiteConfig['profile']['avatar'];
export type ProfileStatConfig = SiteConfig['profile']['stats'][number];
export type IdFieldConfig = SiteConfig['profile']['idCard']['fields'][number];
export type CapabilityItemConfig =
  SiteConfig['capabilities']['items'][number];
export type ContactLinkConfig = SiteConfig['contact']['links'][number];
