#!/usr/bin/env node
// Scaffolds a new project: `npm run new-project -- my-project-slug`
// Creates src/content/projects/<slug>.yaml and src/assets/projects/<slug>/,
// then you: drop images in the assets folder, fill in the yaml, pick a
// template (journey | impact | reel | atmosphere), done — no other file
// in the codebase needs to change.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];

if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Usage: npm run new-project -- <slug-in-kebab-case>');
  console.error('Example: npm run new-project -- night-market');
  process.exit(1);
}

const yamlPath = path.join(root, 'src', 'content', 'projects', `${slug}.yaml`);
const assetsDir = path.join(root, 'src', 'assets', 'projects', slug);

if (existsSync(yamlPath)) {
  console.error(`Already exists: ${yamlPath}`);
  process.exit(1);
}

const template = `title: New Project
year: ${new Date().getFullYear()}
category: school # commission | school | personal
template: reel # journey | impact | reel | atmosphere — see src/components/stages/
order: 99 # lower numbers show earlier in the home mosaic
size: normal # normal | wide | large — how much room it gets in the mosaic
accentFrom: "#888888" # this project's opening mood, as a hex color
accentTo: "#333333" # this project's closing/contrast mood
# client: Some Studio # optional — omit entirely for personal/school work
roles:
  en: [Role one, Role two]
  fr: [Rôle un, Rôle deux]
  zh: [职责一, 职责二]
subtitle:
  en: one line, in English
  fr: one line, in French
  zh: one line, in Chinese
description:
  en: >-
    A paragraph in English.
  fr: >-
    A paragraph in French.
  zh: >-
    A paragraph in Chinese.
cover: hero.jpg # filename inside src/assets/projects/${slug}/
coverAlt:
  en: Describe what's actually in the cover image, in English
  fr: Describe what's actually in the cover image, in French
  zh: Describe what's actually in the cover image, in Chinese
gallery:
  - file: 01.jpg
    alt:
      en: Describe this image
      fr: Describe this image
      zh: Describe this image
`;

mkdirSync(path.dirname(yamlPath), { recursive: true });
mkdirSync(assetsDir, { recursive: true });
writeFileSync(yamlPath, template, 'utf8');
writeFileSync(path.join(assetsDir, '.gitkeep'), '');

console.log(`Created ${path.relative(root, yamlPath)}`);
console.log(`Created ${path.relative(root, assetsDir)}/ — drop cover + gallery images here`);
console.log('');
console.log('Next: fill in the yaml, pick a template, run `npm run dev` and visit /works/' + slug);
