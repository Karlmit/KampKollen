// Simple script to generate PNG icons using Canvas API (node-canvas)
// Run: node generate-icons.mjs
// If node-canvas isn't available, the app will work without icons (PWA will use default)

import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const dir = './frontend/public/icons'
mkdirSync(dir, { recursive: true })

for (const size of [192, 512]) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#0c4433'
  ctx.beginPath()
  const r = size * 0.2
  ctx.moveTo(r, 0)
  ctx.lineTo(size - r, 0)
  ctx.arcTo(size, 0, size, r, r)
  ctx.lineTo(size, size - r)
  ctx.arcTo(size, size, size - r, size, r)
  ctx.lineTo(r, size)
  ctx.arcTo(0, size, 0, size - r, r)
  ctx.lineTo(0, r)
  ctx.arcTo(0, 0, r, 0, r)
  ctx.closePath()
  ctx.fill()

  // Trophy emoji
  ctx.font = `${size * 0.55}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🏆', size / 2, size / 2)

  writeFileSync(join(dir, `icon-${size}.png`), canvas.toBuffer('image/png'))
  console.log(`Generated icon-${size}.png`)
}
