export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type StyleId = 'xuanzhi' | 'inknight' | 'blueprint' | 'porcelain' | 'ticket';
export type MotionLevel = 'subtle' | 'standard' | 'lively';

const THEME_KEY = 'yigui-theme';
const STYLE_KEY = 'yigui-style';
const MOTION_KEY = 'yigui-motion';

export const STYLE_IDS: StyleId[] = ['xuanzhi', 'inknight', 'blueprint', 'porcelain', 'ticket'];
export const MOTION_LEVELS: MotionLevel[] = ['subtle', 'standard', 'lively'];

export interface StyleMeta {
  id: StyleId;
  name: string;
  en: string;
  tagline: string;
  defaultTheme: ResolvedTheme;
}

export const STYLES: StyleMeta[] = [
  { id: 'xuanzhi',   name: '宣纸驿馆', en: 'PARCHMENT',    tagline: '米白宣纸 · 朱印赭石', defaultTheme: 'light' },
  { id: 'inknight',  name: '玄夜墨驿', en: 'INK NIGHT',    tagline: '墨色鎏金 · 朱砂点灯', defaultTheme: 'dark' },
  { id: 'blueprint', name: '铁路蓝图', en: 'BLUEPRINT',    tagline: '晒图蓝纸 · 白线黄标', defaultTheme: 'dark' },
  { id: 'porcelain', name: '青花瓷韵', en: 'PORCELAIN',    tagline: '瓷白钴蓝 · 青釉温润', defaultTheme: 'light' },
  { id: 'ticket',    name: '硬板车票', en: 'HARD TICKET',  tagline: '卡纸油墨 · 国铁朱红', defaultTheme: 'light' },
];

export const APPEARANCE_EVENT = 'yigui-appearance';

function isStyleId(v: string | null): v is StyleId {
  return v != null && (STYLE_IDS as string[]).includes(v);
}
function isMotion(v: string | null): v is MotionLevel {
  return v != null && (MOTION_LEVELS as string[]).includes(v);
}

export function getMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

export function getResolvedTheme(): ResolvedTheme {
  const mode = getMode();
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function getStyle(): StyleId {
  const stored = localStorage.getItem(STYLE_KEY);
  return isStyleId(stored) ? stored : 'xuanzhi';
}

export function getMotionLevel(): MotionLevel {
  const stored = localStorage.getItem(MOTION_KEY);
  return isMotion(stored) ? stored : 'standard';
}

/** Write mode/style/motion to <html> attributes and notify listeners. */
function apply(): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', getResolvedTheme());
  root.setAttribute('data-style', getStyle());
  root.setAttribute('data-motion', getMotionLevel());
  window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT));
}

export function setMode(mode: ThemeMode): void {
  localStorage.setItem(THEME_KEY, mode);
  apply();
}

export function setStyle(style: StyleId): void {
  localStorage.setItem(STYLE_KEY, style);
  apply();
}

export function setMotionLevel(level: MotionLevel): void {
  localStorage.setItem(MOTION_KEY, level);
  apply();
}

/** Legacy helper kept for compatibility: flip between light and dark explicitly. */
export function toggleTheme(): ResolvedTheme {
  const next: ResolvedTheme = getResolvedTheme() === 'light' ? 'dark' : 'light';
  setMode(next);
  return next;
}

export function getTheme(): ResolvedTheme {
  return getResolvedTheme();
}

export function setTheme(theme: ResolvedTheme): void {
  setMode(theme);
}

export function onAppearanceChange(cb: () => void): () => void {
  window.addEventListener(APPEARANCE_EVENT, cb);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const sysHandler = () => { if (getMode() === 'system') apply(); };
  mq.addEventListener('change', sysHandler);
  return () => {
    window.removeEventListener(APPEARANCE_EVENT, cb);
    mq.removeEventListener('change', sysHandler);
  };
}

/** Read a CSS custom property from the document root (e.g. "--c-brand" -> "180 113 87"). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function initTheme(): void {
  apply();
}