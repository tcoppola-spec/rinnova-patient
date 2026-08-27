/**
 * generate-icons.mjs
 *
 * Renders the PWA / home-screen PNG icons from scripts/icon-source.svg into
 * public/. Re-run after editing the source SVG:  node scripts/generate-icons.mjs
 *
 * Sizes:
 *   icon-192.png / icon-512.png  — web manifest (purpose "any maskable")
 *   apple-touch-icon.png (180)   — iOS Add to Home Screen
 *
 * Uses sharp (a dev dependency only — it never ships in the app bundle).
 */
import sharp from 'sharp'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public')

// The app icon: full-bleed gradient, because Android and iOS apply their own
// mask. Never give this one rounded corners — the platform crop would clip it.
const appIcon = readFileSync(join(here, 'icon-source.svg'))

// The browser-tab mark: already rounded, because a favicon is never masked and
// has to carry its own shape. Source of truth for both is the same glyph.
const favicon = readFileSync(join(outDir, 'favicon.svg'))

const targets = [
  { file: 'icon-192.png', size: 192, source: appIcon },
  { file: 'icon-512.png', size: 512, source: appIcon },
  { file: 'apple-touch-icon.png', size: 180, source: appIcon },
  // PNG fallbacks for the tab. An SVG favicon alone is not enough: older
  // Safari ignores it and falls back to /favicon.ico, which on an SPA is
  // caught by the catch-all redirect and returns HTML — so the tab ends up
  // with no icon at all rather than the wrong one.
  { file: 'favicon-32.png', size: 32, source: favicon },
  { file: 'favicon-180.png', size: 180, source: favicon },
]

for (const { file, size, source } of targets) {
  // High render density then downscale = crisp edges on the gradient + mark.
  await sharp(source, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(outDir, file))
  console.log(`wrote public/${file} (${size}x${size})`)
}

// The iOS native app icon (Capacitor). Xcode's AppIcon asset is a single
// 1024x1024 square, and it MUST be fully opaque — the App Store rejects an
// icon that carries an alpha channel — so we .flatten() to drop alpha. The
// gradient already fills the whole square, so flattening changes nothing
// visible; it only removes the transparency sharp would otherwise write. This
// replaces Capacitor's placeholder icon (white with blue shapes). Guarded so
// the script still runs in a checkout that hasn't had `npx cap add ios` yet.
const iosIconPath = join(
  here, '..', 'ios', 'App', 'App',
  'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png'
)
if (existsSync(dirname(iosIconPath))) {
  await sharp(appIcon, { density: 384 })
    .resize(1024, 1024)
    .flatten({ background: '#7B2CBF' })
    .png()
    .toFile(iosIconPath)
  console.log('wrote ios AppIcon-512@2x.png (1024x1024, opaque)')
} else {
  console.log('skipped ios AppIcon — no ios/ project (run `npx cap add ios` first)')
}
