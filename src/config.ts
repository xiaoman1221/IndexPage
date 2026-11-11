import raw from '../config.json';

export interface MetaConfig {
  lang: string;
  title: string;
  description: string;
  favicon: string;
  themeColor: string;
}

export interface ThemeConfig {
  accent: string;
  accentSoft: string;
}

export interface BrandConfig {
  name: string;
  nameEn: string;
  alias: string;
  logo?: string;
  home: string;
}

export interface LinkConfig {
  label: string;
  href: string;
  external?: boolean;
}

export interface HeaderConfig {
  cta: LinkConfig;
}

export interface ClockConfig {
  timezone: string;
  label: string;
}

export interface NavItem {
  id: string;
  index: string;
  label: string;
  labelEn: string;
  href: string;
}

export interface RailConfig {
  line1: string;
  line2: string;
}

export interface BootConfig {
  kicker: string;
  title: string;
  hint: string;
  messages: string[];
}

export interface SceneConfig {
  enabled: boolean;
  accent: string;
  glow: string;
}

export interface ParticleImageConfig {
  max?: number;
  size?: number;
  interactive?: boolean;
  scatter?: number;
  blend?: 'source-over' | 'lighter';
  lumaCutoff?: number;
  dotMatrix?: boolean;
  dotSpacing?: number;
  dotColor?: string;
}

export interface ParticleMorphConfig {
  enabled?: boolean;
  words?: string[];
  interval?: number;
  scatter?: number;
  gather?: number;
  hold?: number;
}

export interface QuoteParticleConfig {
  enabled?: boolean;
  max?: number;
}

export interface ParticlesConfig extends ParticleImageConfig {
  enabled?: boolean;
  density?: number;
  dotMatrix?: boolean;
  dotSpacing?: number;
  dotColor?: string;
  morph?: ParticleMorphConfig;
  quote?: QuoteParticleConfig;
  hero?: ParticleImageConfig;
  avatar?: ParticleImageConfig;
  works?: ParticleImageConfig;
}

export interface SwarmConfig {
  enabled?: boolean;
  density?: number;
  interactive?: boolean;
}

export interface HeroActionConfig {
  label: string;
  labelEn: string;
  href: string;
  style?: string;
  external?: boolean;
}

export interface HeroMetaConfig {
  label: string;
  value: string;
  tone?: string;
}

export interface HeroTitleLine {
  text: string;
  accent?: string;
}

export interface HeroSigilConfig {
  lat: string;
  lng: string;
  alt: string;
  ref: string;
}

export interface HeroConfig {
  image?: string;
  imageAlt?: string;
  eyebrow: string[];
  title: HeroTitleLine[];
  subtitleEn: string;
  subtitle: string;
  actions: HeroActionConfig[];
  meta: HeroMetaConfig[];
  scrollCue: { text: string; href: string };
  sigil: HeroSigilConfig;
}

export interface ProfileStatConfig {
  value: string;
  suffix?: string;
  label: string;
  /** ISO date. When set, the value becomes a live day count from this date. */
  since?: string;
}

export interface AvatarConfig {
  image?: string;
  alt?: string;
  fallback?: string;
  caption?: string;
}

export interface IdFieldConfig {
  label: string;
  value: string;
  tone?: string;
}

export interface ProfileConfig {
  index: string;
  title: string;
  titleEn: string;
  note: string;
  introHtml: string;
  bio: string;
  quote: {
    html: string;
    source: string;
    author: string;
    mode?: 'static' | 'hitokoto';
    endpoint?: string;
  };
  stats: ProfileStatConfig[];
  avatar: AvatarConfig;
  idCard: {
    headLeft: string;
    headRight: string;
    fields: IdFieldConfig[];
    code: string;
  };
}

export interface CapabilityItemConfig {
  no: string;
  title: string;
  titleEn: string;
  description: string;
  tags: string[];
  level: number;
}

export interface CapabilitiesConfig {
  index: string;
  title: string;
  titleEn: string;
  note: string;
  lead: string;
  leadNote: string;
  marquee: string[];
  items: CapabilityItemConfig[];
}

export interface WorkItemConfig {
  no: string;
  title: string;
  description: string;
  client: string;
  href: string;
  urlLabel: string;
  image?: string;
  imageAlt?: string;
  tags: string[];
  accent?: string;
}

export interface WorksConfig {
  index: string;
  title: string;
  titleEn: string;
  note: string;
  quoteHtml: string;
  hint: string;
  items: WorkItemConfig[];
}

export interface ContactLinkConfig {
  no: string;
  label: string;
  value: string;
  href: string;
  external?: boolean;
}

export interface ContactConfig {
  index: string;
  title: string;
  titleEn: string;
  note: string;
  kicker: string;
  kickerEmoji: string;
  email: string;
  line: string;
  lineEmoji: string;
  links: ContactLinkConfig[];
}

export interface FooterSegmentConfig {
  text: string;
  href?: string;
  external?: boolean;
}

export interface FooterFilingConfig {
  label: string;
  href: string;
  external?: boolean;
}

export interface FooterConfig {
  copyright: string;
  icp?: FooterFilingConfig;
  police?: FooterFilingConfig;
  customLink?: FooterFilingConfig;
  credits: FooterSegmentConfig[];
  backToTop: string;
}

export interface SiteConfig {
  meta: MetaConfig;
  theme: ThemeConfig;
  brand: BrandConfig;
  header: HeaderConfig;
  clock: ClockConfig;
  nav: NavItem[];
  rail: RailConfig;
  boot: BootConfig;
  scene: SceneConfig;
  swarm?: SwarmConfig;
  particles?: ParticlesConfig;
  hero: HeroConfig;
  profile: ProfileConfig;
  capabilities: CapabilitiesConfig;
  works: WorksConfig;
  contact: ContactConfig;
  techStack?: string[];
  ticker: string[];
  footer: FooterConfig;
}

export const config = raw as SiteConfig;
