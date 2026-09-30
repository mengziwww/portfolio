# Menghan LI

Portfolio of Menghan LI, 2D animator, character designer and storyboard artist.

Live site: <https://mengziwww.github.io/portfolio/>

All the work here belongs to her. See [Rights](#rights).

## Stack

[Astro](https://astro.build) static site, no backend. English, French and Chinese, switched in the page. Three.js is used for the manga book in *Rebirth of the World*.

## Run it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # type check, then static build into dist/
```

Every push to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`). The build runs `astro check` first, so a type error stops the deploy.

## Where things live

```
src/content/projects/*.yaml   one file per project: titles, text in en/fr/zh, credits, gallery order
src/assets/projects/<id>/     the images of each project, referenced by filename from its yaml
public/videos/<id>/           the videos, served as they are
src/components/stages/        the page layouts; each project picks one with `template:`
src/components/               shared pieces (video player, manga book, header, notes...)
src/i18n/ui.ts                interface text in the three languages
```

## Editing a project

- Text: change the `en`, `fr` and `zh` fields in the project's yaml.
- Images: drop the file in `src/assets/projects/<id>/` and add a `- file:` entry to the gallery. Images are resized and converted at build time. GIFs are served untouched so they keep their animation.
- Videos: H.264 MP4 in `public/videos/<id>/`, encoded with `-movflags +faststart` so they start before they finish downloading.

## Notes mode

`/notes/` shows the same site with a comment box on every text and image, for reviewing changes. Notes stay in the browser and can be exported as JSON.

## Rights

Copyright © 2026 Menghan LI. All rights reserved.

The artwork, films, images, text and code in this repository are hers. Nothing here may be copied, reused, redistributed or used to train AI models without her written permission. See [LICENSE](LICENSE).
