// Traditional Chinese is derived from the simplified text at runtime, so
// every zh string only has to be written once. The converter (~1 MB) is
// only downloaded when someone actually picks 繁體.
type Convert = (text: string) => string;

let converter: Promise<Convert> | undefined;
const originals = new WeakMap<Text, string>();

function loadConverter(): Promise<Convert> {
  converter ??= import('opencc-js/cn2t').then(({ Converter }) => Converter({ from: 'cn', to: 'tw' }));
  return converter;
}

function zhTextNodes(): Text[] {
  const nodes: Text[] = [];
  document.querySelectorAll('[data-lang="zh"], [data-lang-block="zh"], [data-zh]').forEach((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) nodes.push(node as Text);
  });
  return nodes;
}

export async function applyScript(traditional: boolean) {
  const nodes = zhTextNodes();
  if (!traditional) {
    nodes.forEach((text) => {
      const original = originals.get(text);
      if (original !== undefined) text.data = original;
    });
    return;
  }
  const convert = await loadConverter();
  nodes.forEach((text) => {
    if (!originals.has(text)) originals.set(text, text.data);
    text.data = convert(originals.get(text)!);
  });
}
