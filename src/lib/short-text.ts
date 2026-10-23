// Short texts: on project pages, long paragraphs and captions are folded
// away unless the visitor picks "Full" in the settings. The project intro
// stays by default. Each block is keyed by project and a hash of its
// English text, so a choice survives layout changes but resets when the
// text itself is rewritten.
//
// Her choices come from the notes mode export (`short`) and are copied into
// src/data/short-text.json.
import bakedJson from '@/data/short-text.json';

const baked: { keep: string[]; hide: string[] } = bakedJson;

export const SHORT_KEY = 'menghan-short';
const LIMIT = 160;
const BLOCKS = 'p, figcaption, dd, blockquote';
const SKIP = 'header, nav, footer, button, dialog, [aria-live], [data-short-skip], [data-notes-ui], .visually-hidden, .sr-only';

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

export function readLocalShort(): Record<string, Choice> {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHORT_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalShort(choices: Record<string, Choice>) {
  try {
    localStorage.setItem(SHORT_KEY, JSON.stringify(choices));
  } catch {
    /* private mode */
  }
}

const badgeText: Record<Choice, Record<'en' | 'fr' | 'zh', string>> = {
  hide: { en: 'short mode: hidden · keep it', fr: 'mode court : masqué · le garder', zh: '简短模式：隐藏 · 保留' },
  keep: { en: 'short mode: kept · hide it', fr: 'mode court : gardé · le masquer', zh: '简短模式：保留 · 隐藏' },
};

function paintBadge(badge: HTMLElement, choice: Choice) {
  badge.replaceChildren(
    ...(['en', 'fr', 'zh'] as const).map((lang) => {
      const span = document.createElement('span');
      span.dataset.lang = lang;
      span.textContent = badgeText[choice][lang];
      return span;
    }),
  );
}

export function markShortTexts() {
  const slug = location.pathname.match(/\/works\/([^/]+)/)?.[1];
  const main = document.querySelector('main');
  if (!slug || !main) return;
  const notes = location.pathname.includes('/notes');
  const local = notes ? readLocalShort() : {};
  main.classList.toggle('is-notes-page', notes);

  main.querySelectorAll<HTMLElement>(BLOCKS).forEach((el) => {
    if (el.dataset.shortKey || el.closest(SKIP)) return;
    if (el.parentElement?.closest(BLOCKS)) return;
    const text = englishOf(el);
    if (!text) return;
    const intro = el.classList.contains('project-desc');
    if (!intro && text.length <= LIMIT) return;
    const key = `${slug}:${hash(text)}`;
    const fallback: Choice = intro ? 'keep' : 'hide';
    const choice: Choice =
      local[key] ?? (baked.keep.includes(key) ? 'keep' : baked.hide.includes(key) ? 'hide' : fallback);
    el.dataset.shortKey = key;
    el.dataset.short = choice;

    if (!notes) return;
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'short-badge';
    badge.dataset.shortBadge = '';
    paintBadge(badge, choice);
    badge.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const next: Choice = el.dataset.short === 'hide' ? 'keep' : 'hide';
      el.dataset.short = next;
      paintBadge(badge, next);
      const all = readLocalShort();
      all[key] = next;
      writeLocalShort(all);
    });
    el.append(badge);
  });
}
