import { getCollection, type CollectionEntry } from 'astro:content';

export type ProjectEntry = CollectionEntry<'projects'>;

export async function getOrderedProjects(): Promise<ProjectEntry[]> {
  const all = await getCollection('projects');
  return all.sort((a, b) => a.data.order - b.data.order);
}

/** Root-relative URL. Includes the GitHub Pages base when one is set. */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  if (!path || path === '/') return base;
  const trimmed = path.replace(/^\/+/, '');
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const isFile = /[^/]+\.[a-z0-9]+$/i.test(trimmed);
  const url = `${prefix}${trimmed}`;
  const wantsSlash = base !== '/' && base.endsWith('/');
  if (isFile || !wantsSlash) return url;
  return url.endsWith('/') ? url : `${url}/`;
}

export function projectPath(id: string): string {
  return withBase(`/works/${id}`);
}

export async function getProjectStaticPaths() {
  const ordered = await getOrderedProjects();
  return ordered.map((project, i) => {
    const next = ordered[(i + 1) % ordered.length];
    return { params: { slug: project.id }, props: { project, next } };
  });
}
