import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// English at the root, French and Chinese under /fr/ and /zh/ (see src/lib/lang.ts).
// `base` is the GitHub Pages project path.
export default defineConfig({
  site: 'https://mengziwww.github.io',
  base: '/portfolio',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', fr: 'fr', zh: 'zh' } },
    }),
  ],
  redirects: {
    '/works/the-end-of-the-world': '/works/rebirth-of-the-world',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
