import { defineMiddleware } from 'astro:middleware';
import { localizeHref, PREFIXED, type Lang } from '@/lib/lang';
import { LABELS } from '@/lib/labels';

// French and Chinese pages are built from the same components as English
// ones. Their internal links and icon labels are moved to the matching
// language here, once, instead of in every component.
const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const path = context.url.pathname.startsWith(`${base}/`) ? context.url.pathname.slice(base.length) : context.url.pathname;
  const lang = PREFIXED.find((code) => path === `/${code}` || path.startsWith(`/${code}/`)) as Exclude<Lang, 'en'> | undefined;
  if (!lang || !response.headers.get('content-type')?.includes('text/html')) return response;
  const html = await response.text();
  const localized = html
    .replace(/(<a\b[^>]*?\shref=")([^"]*)"/g, (_, start: string, href: string) => `${start}${localizeHref(href, lang)}"`)
    .replace(/\saria-label="([^"]*)"/g, (whole, name: string) => (LABELS[name] ? ` aria-label="${LABELS[name][lang]}"` : whole));
  return new Response(localized, { status: response.status, headers: response.headers });
});
