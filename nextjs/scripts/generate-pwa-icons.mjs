import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';

const BRAND = '#0B7C64';

// The app mark, drawn at 512 so the strokes stay crisp at every downscale.
const mark = (size, padding) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
  <rect width="32" height="32" rx="${padding ? 0 : 9}" fill="${BRAND}"/>
  <g transform="translate(16 16) scale(${padding ? 0.72 : 1}) translate(-16 -16)">
    <path d="M8 12.5A4.5 4.5 0 0 1 12.5 8h7A4.5 4.5 0 0 1 24 12.5v5a4.5 4.5 0 0 1-4.5 4.5H14l-4.4 3.3A1 1 0 0 1 8 24.5Z" fill="#ECFDF7" opacity="0.95"/>
    <g stroke="${BRAND}" stroke-width="2" stroke-linecap="round">
      <line x1="13" y1="18" x2="13" y2="15.5"/>
      <line x1="16" y1="18" x2="16" y2="13"/>
      <line x1="19" y1="18" x2="19" y2="11"/>
    </g>
  </g>
</svg>`;

mkdirSync('public/icons', { recursive: true });

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, maskable: false },
  { file: 'public/icons/icon-512.png', size: 512, maskable: false },
  // Maskable icons are cropped to whatever shape the launcher uses, so the mark is inset into the
  // safe zone and the background runs corner to corner — a rounded square here would get rounded twice.
  { file: 'public/icons/icon-maskable-192.png', size: 192, maskable: true },
  { file: 'public/icons/icon-maskable-512.png', size: 512, maskable: true },
  { file: 'public/icons/apple-touch-icon.png', size: 180, maskable: true },
];

for (const { file, size, maskable } of targets) {
  const png = await sharp(Buffer.from(mark(size, maskable))).resize(size, size).png().toBuffer();
  writeFileSync(file, png);
  console.log(file, png.length, 'bytes');
}

// Favicon at 32 for browsers that still ask for one by path.
writeFileSync('public/icons/favicon-32.png', await sharp(Buffer.from(mark(32, false))).resize(32, 32).png().toBuffer());
console.log('public/icons/favicon-32.png');
