import type { ImageMetadata } from 'astro';

// Eagerly import every project asset once at build time so project pages can
// resolve a plain filename (as written in the yaml) to optimized image metadata.
// Adding a project later never touches this file — drop images in
// src/assets/projects/<id>/ and reference the filename from the yaml.
const modules = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/projects/**/*.{jpg,jpeg,png,gif,webp}',
  { eager: true }
);

export function getProjectImage(projectId: string, filename: string): ImageMetadata {
  const key = `/src/assets/projects/${projectId}/${filename}`;
  const mod = modules[key];
  if (!mod) {
    throw new Error(
      `Missing image "${filename}" for project "${projectId}" (expected at ${key}). ` +
      `Check src/content/projects/${projectId}.yaml against src/assets/projects/${projectId}/.`
    );
  }
  return mod.default;
}

// Squarespace-era source art varies wildly in resolution — some covers are
// barely 640px wide. Asking Sharp for a width larger than the source just
// upscales it, which reads as pixelation, not sharpness. Cap the requested
// widths to what the file actually has.
export function responsiveWidths(img: ImageMetadata, candidates: number[]): number[] {
  const capped = candidates.filter((w) => w <= img.width);
  return capped.length ? capped : [img.width];
}
