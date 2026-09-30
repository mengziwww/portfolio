// Server-side text splitting for scroll/load reveals — runs at build time,
// so there's no flash of unsplit text and no client-side layout work.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Wrap each word in a masked span so it can rise into view from below. */
export function wordReveal(text: string, startDelay = 0, stepMs = 45): string {
  const words = text.split(' ');
  return words
    .map((w, i) => {
      const delay = startDelay + i * stepMs;
      return `<span class="reveal-mask"><span class="reveal-word" style="transition-delay:${delay}ms">${escapeHtml(w)}</span></span>`;
    })
    .join(' ');
}

/**
 * Wrap each character in a span for a tighter, name-scale stagger. Each
 * word's characters are grouped in a `white-space: nowrap` wrapper — the
 * per-character inline-blocks are otherwise atomic boxes with no natural
 * "don't break here" relationship to their neighbors, so without the
 * wrapper the browser is free to wrap a line in the middle of a word.
 */
export function charReveal(text: string, startDelay = 0, stepMs = 28): string {
  let i = 0;
  return text
    .split(' ')
    .map((word) => {
      const chars = Array.from(word)
        .map((c) => {
          const delay = startDelay + i * stepMs;
          i++;
          return `<span class="reveal-mask"><span class="reveal-char" style="transition-delay:${delay}ms">${escapeHtml(c)}</span></span>`;
        })
        .join('');
      i++; // keep the same stagger rhythm the space itself used to occupy
      return `<span class="reveal-word-group">${chars}</span>`;
    })
    .join(' ');
}
