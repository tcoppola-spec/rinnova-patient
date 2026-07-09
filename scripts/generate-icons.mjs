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
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, 'icon-source.svg'))
const outDir = join(here, '..', 'public')

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
]

for (const { file, size } of targets) {
  // High render density then downscale = crisp edges on the gradient + mark.
  await sharp(source, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(outDir, file))
  console.log(`wrote public/${file} (${size}x${size})`)
}
