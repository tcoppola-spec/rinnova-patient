/**
 * generate-splash.mjs
 *
 * Renders the iOS launch screen (Capacitor's Splash image set) into a fully
 * BRANDED splash — no Capacitor default artwork. Re-run after editing the
 * glyph:  node scripts/generate-splash.mjs
 *
 * Design: the brand cream page colour (#faf7f2, the app's --page and the PWA
 * background_color) with the gradient "R" centred. The letter is the SAME
 * vector glyph as the app icon (extracted from scripts/icon-source.svg), so the
 * icon you tap and the screen you land on carry one mark. On the icon the R is
 * white on the gradient; here it's the gradient on cream — the inverse, which
 * reads as a calm hand-off from home screen into the app.
 *
 * The launch storyboard shows this image scaleAspectFill (fills the screen,
 * centre-anchored, edges cropped), so a centred mark on a uniform ground stays
 * put on every device. Flattened to opaque cream — no alpha edges.
 *
 * Uses sharp (a dev dependency only — it never ships in the app bundle).
 */
import sharp from 'sharp'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const iconSrc = readFileSync(join(here, 'icon-source.svg'), 'utf8')

// Pull the R's path data straight out of the icon source so there is one glyph,
// never a hand-copied duplicate that could drift.
const dMatch = iconSrc.match(/<path fill="#FFFFFF" d="([^"]*)"/)
if (!dMatch) {
  throw new Error('Could not find the R glyph path in icon-source.svg')
}
const glyphPath = dMatch[1]

const CREAM = '#faf7f2'
const CANVAS = 2732 // Capacitor's splash is a 2732 square

// The glyph group from icon-source.svg places the R inside a 512 box at roughly
// x[138,373] y[127,385] — centre ~(255.5, 256). We re-centre that on the 2732
// canvas and scale it to ~27% of the width (a calm logo size, not full-bleed).
const GLYPH_CENTER = { x: 255.5, y: 256 }
const SCALE = 3.2

const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7B2CBF"/>
      <stop offset="0.5" stop-color="#D63384"/>
      <stop offset="1" stop-color="#FF8C42"/>
    </linearGradient>
  </defs>
  <rect width="${CANVAS}" height="${CANVAS}" fill="${CREAM}"/>
  <g transform="translate(${CANVAS / 2},${CANVAS / 2}) scale(${SCALE}) translate(${-GLYPH_CENTER.x},${-GLYPH_CENTER.y})">
    <g transform="translate(126.079,385.000) scale(0.18429,-0.18429)">
      <path fill="url(#brand)" d="${glyphPath}"/>
    </g>
  </g>
</svg>`

// Capacitor's Splash.imageset references three files (1x/2x/3x slots); its own
// default ships the same 2732 square in all three, and the storyboard scales to
// fit, so one rendered image fills every slot.
const splashDir = join(
  here, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset'
)
const files = [
  'splash-2732x2732.png',
  'splash-2732x2732-1.png',
  'splash-2732x2732-2.png',
]

if (!existsSync(splashDir)) {
  console.log('skipped splash — no ios/ project (run `npx cap add ios` first)')
} else {
  for (const file of files) {
    await sharp(Buffer.from(splashSvg), { density: 192 })
      .resize(CANVAS, CANVAS)
      .flatten({ background: CREAM })
      .png()
      .toFile(join(splashDir, file))
    console.log(`wrote ${file} (${CANVAS}x${CANVAS}, branded)`)
  }
}
