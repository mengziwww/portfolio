function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

// Every project stamps a pair of mood colors (accentFrom/accentTo) that are
// chosen for how a scroll-linked narrative morphs between them — one end of
// that pair is often deliberately dark. A hover glow against a near-black
// background needs the opposite quality: saturated and mid-bright. Rather
// than asking every new project's colors to satisfy both jobs at once, this
// picks whichever of the two already does the glow job well.
export function vividOf(hexA: string, hexB: string): string {
  const score = ([, s, l]: [number, number, number]) => s * (1 - Math.abs(l - 0.6));
  return score(hexToHsl(hexA)) >= score(hexToHsl(hexB)) ? hexA : hexB;
}
