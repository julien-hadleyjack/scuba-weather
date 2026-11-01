// Renders the app icon (public/favicon.svg) to the PNG sizes the PWA needs (NFR-8).
// Run with `npm run icons`; the output in public/ is committed.
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url));

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  const out = new URL(`../public/${name}`, import.meta.url);
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(out.pathname);
  console.log(`wrote public/${name}`);
}
