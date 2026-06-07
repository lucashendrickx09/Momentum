// One-off: rasterize the app icon (public/favicon.svg) into the PNGs the
// PWA manifest + iOS need. Run with `npm run icons` (requires sharp).
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'public/icons')
mkdirSync(out, { recursive: true })

const svg = readFileSync(resolve(root, 'public/favicon.svg'))

// Maskable: full-bleed square (no rounded corners) so the platform mask is clean.
const maskable = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#10182a"/><stop offset="1" stop-color="#0b0f17"/></linearGradient>
    <linearGradient id="mark" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#18b97a"/><stop offset="0.5" stop-color="#19c3c3"/><stop offset="1" stop-color="#4f8cff"/></linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g fill="none" stroke="url(#mark)" stroke-width="34" stroke-linecap="round" stroke-linejoin="round" transform="translate(51 51) scale(0.8)">
    <polyline points="120,332 210,242 286,318 392,176"/>
    <polyline points="330,176 392,176 392,238"/>
  </g>
  <circle cx="147" cy="316" r="18" fill="#18b97a"/>
</svg>`)

const jobs = [
  { src: svg, size: 192, name: 'pwa-192.png' },
  { src: svg, size: 512, name: 'pwa-512.png' },
  { src: svg, size: 180, name: 'apple-touch-icon.png' },
  { src: maskable, size: 512, name: 'pwa-512-maskable.png' },
]

for (const j of jobs) {
  await sharp(j.src).resize(j.size, j.size).png().toFile(resolve(out, j.name))
  console.log('wrote', j.name)
}
console.log('icons done')
