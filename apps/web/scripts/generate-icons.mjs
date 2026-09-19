#!/usr/bin/env node
/**
 * Rasterises the brand SVGs in `public/` into every icon this app actually
 * references, then packs the small sizes into a multi-resolution favicon.ico.
 *
 * Uses headless Chromium as the renderer so there is no native image
 * dependency (sharp / ImageMagick / librsvg) to install in CI or on a dev box.
 * Override the binary with CHROME_BIN if it is not on PATH.
 *
 * Run: node scripts/generate-icons.mjs [--verbose]
 *
 * Outputs (all into public/):
 *   favicon.ico    16 + 32 + 48, PNG-in-ICO
 *   icon.png       180  apple-touch-icon
 *   icon-192.png   192  PWA + service-worker notification icon
 *   icon-512.png   512  PWA install / maskable (mark sits inside the 80% safe circle)
 *   icon-96.png     96  service-worker notification *badge* (monochrome, transparent)
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, '../public');
const VERBOSE = process.argv.includes('--verbose');

const log = (...args) => VERBOSE && console.log(...args);

/* ── renderer ───────────────────────────────────────────────────────────── */

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const candidates = [
    'chromium',
    'chromium-browser',
    'google-chrome-stable',
    'google-chrome',
    'chrome',
  ];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // try the next one
    }
  }
  throw new Error(
    'No Chromium/Chrome binary found. Install chromium or set CHROME_BIN=/path/to/chrome.',
  );
}

const CHROME = findChrome();

/**
 * Renders `svgName` (a file in public/) at `size`x`size` and returns the PNG
 * bytes. The SVG is wrapped in a page so the <img> box, not the SVG's own
 * intrinsic width, decides the raster size — that is what makes a 512-unit
 * artboard come out crisp at 16px.
 */
function rasterize(svgName, size) {
  const work = mkdtempSync(join(tmpdir(), 'wakeel-icons-'));
  try {
    copyFileSync(join(PUBLIC, svgName), join(work, svgName));
    const page = join(work, 'page.html');
    writeFileSync(
      page,
      `<!doctype html><meta charset="utf-8"><style>
         html,body{margin:0;padding:0;background:transparent}
         img{display:block;width:${size}px;height:${size}px}
       </style><img src="./${svgName}" alt="">`,
    );
    const out = join(work, 'out.png');
    execFileSync(
      CHROME,
      [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--default-background-color=00000000',
        `--window-size=${size},${size}`,
        `--screenshot=${out}`,
        // Not `file://${page}`: a Windows path makes that `file://C:...`,
        // which is not a valid file URL.
        pathToFileURL(page).href,
      ],
      { stdio: 'ignore' },
    );
    const png = readFileSync(out);
    log(`  rendered ${svgName} @ ${size}px → ${png.length} bytes`);
    return png;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/* ── .ico container ─────────────────────────────────────────────────────── */

/**
 * Packs PNGs into an ICO. PNG-in-ICO is understood by every current browser
 * and by Windows Vista onward, and keeps the file two orders of magnitude
 * smaller than the BMP encoding.
 */
function buildIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(count, 4);

  const directory = Buffer.alloc(16 * count);
  let offset = header.length + directory.length;

  images.forEach(({ size, png }, index) => {
    const at = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, at); // 0 encodes 256
    directory.writeUInt8(size >= 256 ? 0 : size, at + 1);
    directory.writeUInt8(0, at + 2); // palette size
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, directory, ...images.map((image) => image.png)]);
}

/* ── build ──────────────────────────────────────────────────────────────── */

const write = (name, buffer) => {
  writeFileSync(join(PUBLIC, name), buffer);
  console.log(`${name.padEnd(14)} ${String(buffer.length).padStart(7)} bytes`);
};

console.log(`renderer: ${CHROME}\n`);

const icoSizes = [16, 32, 48];
write(
  'favicon.ico',
  buildIco(icoSizes.map((size) => ({ size, png: rasterize('icon.svg', size) }))),
);

write('icon.png', rasterize('icon.svg', 180));
write('icon-192.png', rasterize('icon.svg', 192));
write('icon-512.png', rasterize('icon.svg', 512));
write('icon-96.png', rasterize('icon-mono.svg', 96));

console.log('\nDone.');
