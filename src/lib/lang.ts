// English lives at the root, French and Chinese under /fr/ and /zh/, so
// search engines get one page per language. Traditional Chinese reuses the
// /zh/ pages and is converted in the browser (see traditional.ts).
export const LANGS = ['en', 'fr', 'zh'] as const;
export type Lang = (typeof LANGS)[number];
export const PREFIXED: Lang[] = ['fr', 'zh'];

const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const pages = new RegExp(`^/(?!_astro/|videos/|fr(?:/|$)|zh(?:/|$))[^.]*$`);

/** The same page in another language. Takes and returns a site URL, base included. */
export function localizeHref(href: string, lang: Lang): string {
  if (lang === 'en' || !href.startsWith(`${base}/`)) return href;
  const cut = href.search(/[?#]/);
  const path = cut < 0 ? href : href.slice(0, cut);
  const rest = cut < 0 ? '' : href.slice(cut);
  const inner = path.slice(base.length);
  if (!pages.test(inner)) return href;
  const slash = inner === '/' ? (base ? '/' : '') : inner;
  return `${base}/${lang}${slash}${rest}`;
}

/** The language a page is built in, from its URL. */
export function langOf(url: URL): Lang {
  const path = url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length) : url.pathname;
  return PREFIXED.find((code) => path === `/${code}` || path.startsWith(`/${code}/`)) ?? 'en';
}

/** Lang-free path ("/works/x") for a language: "/fr/works/x". */
export function langPath(path: string, lang: Lang): string {
  if (lang === 'en') return path;
  return path === '/' ? `/${lang}` : `/${lang}${path}`;
}
