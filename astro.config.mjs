import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// One URL per page — language is a client-side toggle, not a route
// (see src/i18n and I18nText.astro). `base` is the GitHub Pages project path.
export default defineConfig({
  site: 'https://mengziwww.github.io',
  base: '/portfolio',
  trailingSlash: 'always',
  integrations: [sitemap()],
  image: {
    // large source scans/exports (some 8-10MB) get squeezed hard on build
    domains: [],
  },
  redirects: {
    '/works/the-end-of-the-world': '/works/rebirth-of-the-world',
    '/notes/works/the-end-of-the-world': '/notes/works/rebirth-of-the-world',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
