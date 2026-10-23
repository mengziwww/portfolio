import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Every string a visitor reads exists in all three languages.
const localized = z.object({
  en: z.string(),
  fr: z.string(),
  zh: z.string(),
});

const localizedList = z.object({
  en: z.array(z.string()),
  fr: z.array(z.string()),
  zh: z.array(z.string()),
});

const galleryItem = z.object({
  // filename only — resolved against src/assets/projects/<project id>/ by src/lib/images.ts
  file: z.string(),
  alt: localized,
  caption: localized.optional(),
  // used by the "reel" stage to group images into chapters (Concept, Cast, Storyboard...)
  // omit it and the reel stage just runs as one continuous chapter
  chapter: localized.optional(),
});

const projects = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(), // proper name — not translated, same in all locales
    year: z.number(),
    category: z.enum(['commission', 'school', 'personal']),
    // which Stage component renders this project — see src/components/stages/
    template: z.enum(['journey', 'impact', 'reel', 'atmosphere', 'sketchbook', 'breakdown', 'dream', 'process', 'collection']),
    order: z.number(), // lower = shown earlier on the home mosaic
    // how much room this gets in the home mosaic — the grid auto-packs, so a
    // new project just picks one of these and finds its own spot
    size: z.enum(['normal', 'wide', 'large']).default('normal'),
    accentFrom: z.string(), // hex, project's own opening mood
    accentTo: z.string(), // hex, project's own closing/contrast mood
    roles: localizedList,
    client: z.string().optional(),
    subtitle: localized,
    description: localized,
    // the plot, kept apart from my part in it. The "atmosphere" stage tells
    // it one sentence per picture (falls back to the description); the
    // "process" stage shows it above the description.
    story: localized.optional(),
    cover: z.string(), // filename in src/assets/projects/<id>/
    coverAlt: localized,
    // optional lines on the home poster. When set, they replace the
    // generic "school film" / "something I made" credits.
    posterCredit: localized.optional(),
    posterGenre: localized.optional(),
    gallery: z.array(galleryItem).default([]),
    video: z.string().optional(),
    // a few words shown under `video`
    videoNote: localized.optional(),
    // used by the "process" stage: several real clips (not one), each its
    // own stage of the work, e.g. storyboard reel -> animation -> making-of
    videos: z
      .array(
        z.object({
          file: z.string(), // filename in public/videos/<project id>/
          label: localized,
        })
      )
      .optional(),
    links: z
      .array(
        z.object({
          href: z.string(),
          label: localized,
        })
      )
      .optional(),
    // a film that is out: stamped on its poster and page, embedded on the page
    release: z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        youtube: z.string(), // video id
      })
      .optional(),
    // a line of context under a gallery chapter's title, matched on chapter.en
    chapterNotes: z
      .array(
        z.object({
          chapter: z.string(),
          note: localized,
        })
      )
      .optional(),
    // used by the "collection" stage: how each gallery chapter is laid out,
    // matched on chapter.en, plus a line of context under its title
    piles: z
      .array(
        z.object({
          chapter: z.string(),
          display: z.enum(['lineup', 'hand', 'polaroids', 'festival', 'calendar', 'strip']),
          note: localized,
        })
      )
      .optional(),
    // used by the "collection" stage: the tabs along the top. Each shelf
    // shows one part at a time; a part is a pile's chapter.en, or
    // '@videos' / '@storyboards' for every clip / every storyboard.
    // The first shelf is the one open on arrival.
    shelves: z
      .array(
        z.object({
          id: z.string(),
          label: localized,
          parts: z.array(z.string()),
        })
      )
      .optional(),
    // used by the "collection" stage: storyboards shown as page sequences
    storyboards: z
      .array(
        z.object({
          title: localized,
          note: localized,
          pages: z.array(z.string()), // filenames in src/assets/projects/<id>/
          look: z.enum(['sand', 'wall', 'night']).default('wall'),
        })
      )
      .optional(),
  }),
});

export const collections = { projects };
