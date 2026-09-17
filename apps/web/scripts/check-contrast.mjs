#!/usr/bin/env node
/**
 * Contrast gate for the design tokens in src/app/globals.css.
 *
 * Parses the token blocks, converts OKLCH to sRGB, composites any alpha
 * against the surface the colour actually sits on, and asserts every declared
 * pair against its WCAG 2.2 floor: 4.5:1 for text, 3:1 for UI parts and
 * meaningful graphics. Exits non-zero on any failure.
 *
 * Run: node scripts/check-contrast.mjs [--verbose]
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = resolve(HERE, '../src/app/globals.css');
const VERBOSE = process.argv.includes('--verbose');

const TEXT = 4.5; // WCAG 1.4.3 — normal-size text
const UI = 3.0; //   WCAG 1.4.11 — UI components and meaningful graphics

/* ── colour maths ──────────────────────────────────────────────────────── */

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function luminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map(toLinear);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function oklchToSrgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const bb = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bb;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => clamp01(toGamma(v)));
}

/** Composite a translucent colour over an opaque one. */
const over = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

/* ── token parsing ─────────────────────────────────────────────────────── */

const css = readFileSync(CSS, 'utf8');

/** Pull `--name: value;` declarations out of the block opened by `selector`. */
function block(selector) {
  const at = css.indexOf(selector);
  if (at === -1) throw new Error(`globals.css: no "${selector}" block found`);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  const out = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].replace(/\/\*[\s\S]*?\*\//g, '').trim();
  }
  return out;
}

const light = block(':root {');
const dark = { ...light, ...block('.dark {') };
const waLight = block('.wa-inbox {');
const waDark = { ...waLight, ...block('.dark .wa-inbox {') };

const THEMES = {
  light: { ...light, ...waLight },
  dark: { ...dark, ...waDark },
};

/**
 * Resolve a raw token value to { rgb, alpha }. Understands #rgb, #rrggbb,
 * oklch(L C H), oklch(L C H / A) and oklch(L C H / N%).
 */
function parseColour(raw, name) {
  const value = raw.trim();

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) {
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    }
    return {
      rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255),
      alpha: 1,
    };
  }

  const ok = value.match(
    /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?)\s*)?\)$/i,
  );
  if (ok) {
    const [, L, C, H, A, pct] = ok;
    let alpha = A === undefined ? 1 : Number(A);
    if (pct === '%') alpha /= 100;
    return { rgb: oklchToSrgb(Number(L), Number(C), Number(H)), alpha };
  }

  throw new Error(`cannot parse token ${name}: "${value}"`);
}

/** A background must end up opaque; composite it over the theme's page ground. */
function flatten(theme, name) {
  const tokens = THEMES[theme];
  if (!(name in tokens)) throw new Error(`token ${name} is not defined`);
  const { rgb, alpha } = parseColour(tokens[name], name);
  if (alpha === 1) return rgb;
  const ground = parseColour(tokens['--background'], '--background').rgb;
  return over(rgb, ground, alpha);
}

/** Resolve a foreground token, compositing any alpha over its own backdrop. */
function foreground(theme, name, bgName) {
  const tokens = THEMES[theme];
  if (!(name in tokens)) throw new Error(`token ${name} is not defined`);
  const { rgb, alpha } = parseColour(tokens[name], name);
  if (alpha === 1) return rgb;
  return over(rgb, flatten(theme, bgName), alpha);
}

/* ── the contract ──────────────────────────────────────────────────────── */

// [foreground, background, floor, label]
const CORE = [
  ['--foreground', '--background', TEXT, 'body text on page'],
  ['--card-foreground', '--card', TEXT, 'body text on card'],
  ['--primary-foreground', '--primary', TEXT, 'primary button label'],
  ['--primary', '--background', TEXT, 'text-primary / link on page'],
  ['--primary', '--card', TEXT, 'text-primary / link on card'],
  ['--secondary-foreground', '--secondary', TEXT, 'secondary button label'],
  ['--accent-foreground', '--accent', TEXT, 'accent text (active nav)'],
  ['--muted-foreground', '--background', TEXT, 'muted text on page'],
  ['--muted-foreground', '--card', TEXT, 'muted text on card'],
  ['--muted-foreground', '--muted', TEXT, 'muted text on muted fill'],
  ['--destructive', '--background', TEXT, 'error text on page'],
  ['--destructive', '--card', TEXT, 'error text on card'],
  ['--status-ai', '--card', TEXT, 'AI-handled metric'],
  ['--status-human', '--card', TEXT, 'human-handled metric'],
  ['--status-escalated', '--card', TEXT, 'escalated metric'],
  ['--ring', '--background', UI, 'focus ring on page'],
  ['--ring', '--card', UI, 'focus ring on card'],
  ['--input', '--card', UI, 'field border on card'],
  ['--input', '--background', UI, 'field border on page'],
];

const WA = [
  ['--wa-name', '--wa-list-bg', TEXT, 'contact name in list'],
  ['--wa-meta', '--wa-list-bg', TEXT, 'list metadata'],
  ['--wa-meta', '--wa-in', TEXT, 'timestamp on incoming bubble'],
  ['--wa-meta', '--wa-out', TEXT, 'timestamp on outgoing bubble'],
  ['--wa-in-fg', '--wa-in', TEXT, 'incoming message body'],
  ['--wa-out-fg', '--wa-out', TEXT, 'outgoing message body'],
  ['--wa-system-fg', '--wa-system', TEXT, 'system notice'],
  ['--wa-unread-fg', '--wa-unread', TEXT, 'unread count on badge'],
  ['--wa-unread-strong', '--wa-list-bg', TEXT, 'unread timestamp / proof icon'],
  ['--wa-tick', '--wa-out', UI, 'sent + delivered ticks'],
  ['--wa-tick-read', '--wa-out', UI, 'read ticks'],
  ['--wa-filter', '--wa-header', UI, 'active filter chip'],
];

/* ── run ───────────────────────────────────────────────────────────────── */

let failures = 0;
let checked = 0;
const problems = [];

for (const theme of ['light', 'dark']) {
  const rows = [];

  for (const [fgName, bgName, floor, label] of [...CORE, ...WA]) {
    let ratio;
    try {
      ratio = contrast(foreground(theme, fgName, bgName), flatten(theme, bgName));
    } catch (err) {
      problems.push(`${theme.padEnd(5)} ${err.message}`);
      failures++;
      continue;
    }
    checked++;
    const ok = ratio + 1e-9 >= floor;
    if (!ok) {
      failures++;
      problems.push(
        `${theme.padEnd(5)} ${ratio.toFixed(2).padStart(5)}:1  needs ${floor.toFixed(1)}  ` +
          `${label}  (${fgName} on ${bgName})`,
      );
    }
    rows.push({ ok, ratio, floor, label });
  }

  if (VERBOSE) {
    console.log(`\n${theme.toUpperCase()}`);
    for (const r of rows) {
      console.log(
        `  ${r.ok ? 'pass' : 'FAIL'} ${r.ratio.toFixed(2).padStart(6)}:1 ` +
          `(needs ${r.floor.toFixed(1)})  ${r.label}`,
      );
    }
  }
}

console.log(`\ncontrast: ${checked} pairs checked across light and dark`);

if (failures) {
  console.error(`\n${failures} below floor:\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    '\nFix the token in src/app/globals.css. Only change a floor here if the\n' +
      'pairing genuinely is not text and not a meaningful graphic.\n',
  );
  process.exit(1);
}

console.log('all pairs meet their WCAG 2.2 floor\n');
