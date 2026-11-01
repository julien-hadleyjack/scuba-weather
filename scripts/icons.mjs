// Renders the app icon (assets/icon.svg) to the PNG sizes the PWA needs (NFR-8).
// Run with `npm run icons`; the output in public/ is committed.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile(new URL('../assets/icon.svg', import.meta.url));
const out = (name) => new URL(`../public/${name}`, import.meta.url);

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(out(name).pathname);
  console.log(`wrote public/${name}`);
}
await writeFile(out('favicon.svg'), svg);
console.log('wrote public/favicon.svg');
