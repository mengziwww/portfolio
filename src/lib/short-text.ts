// Short texts: on project pages, long paragraphs and captions are folded
// away unless the visitor picks "Full" in the settings. The project intro
// stays by default. Each block is keyed by project and a hash of its
// English text, so a choice survives layout changes but resets when the
// text itself is rewritten. The choices live in src/data/short-text.json.
import bakedJson from '@/data/short-text.json';

const baked: { keep: string[]; hide: string[] } = bakedJson;

const LIMIT = 160;
const BLOCKS = 'p, figcaption, dd, blockquote';
const SKIP = 'nav, footer, button, dialog, [aria-live], [data-short-skip], .visually-hidden, .sr-only';

type Choice = 'keep' | 'hide';

function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function englishOf(el: HTMLElement): string {
  const spans = el.querySelectorAll<HTMLElement>('[data-lang="en"], [data-lang-block="en"]');
  const raw = spans.length ? Array.from(spans, (s) => s.textContent ?? '').join(' ') : el.textContent ?? '';
  return raw.replace(/\s+/g, ' ').trim();
}

export function markShortTexts() {
  const slug = location.pathname.match(/\/works\/([^/]+)/)?.[1];
  const main = document.querySelector('main');
  if (!slug || !main) return;

  main.querySelectorAll<HTMLElement>(BLOCKS).forEach((el) => {
    if (el.dataset.shortKey || el.closest(SKIP)) return;
    if (el.parentElement?.closest(BLOCKS)) return;
    const text = englishOf(el);
    if (!text) return;
    const intro = el.classList.contains('project-desc');
    const key = `${slug}:${hash(text)}`;
    const fallback: Choice = !intro && text.length > LIMIT ? 'hide' : 'keep';
    el.dataset.shortKey = key;
    el.dataset.short = baked.keep.includes(key) ? 'keep' : baked.hide.includes(key) ? 'hide' : fallback;
  });
}
