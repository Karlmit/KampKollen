import axios from 'axios'
import fs from 'fs/promises'
import path from 'path'
import { config } from '../config.js'
import { getAzureConfig, getImageOptions } from '../routes/settings.js'
import { prisma } from '../db.js'

export interface GenerateImageOptions {
  prompt: string
  width?: number
  height?: number
}

export interface GenerateImageResult {
  filePath: string
  publicUrl: string
}

let requestCount = 0
let windowStart = Date.now()
const RATE_LIMIT = 18
const RATE_WINDOW_MS = 60_000

async function enforceRateLimit() {
  const now = Date.now()
  if (now - windowStart > RATE_WINDOW_MS) {
    requestCount = 0
    windowStart = now
  }
  if (requestCount >= RATE_LIMIT) {
    const wait = RATE_WINDOW_MS - (now - windowStart)
    await new Promise(r => setTimeout(r, wait + 100))
    requestCount = 0
    windowStart = Date.now()
  }
  requestCount++
}

export async function generateImage(
  opts: GenerateImageOptions,
  subDir: string = 'generated'
): Promise<GenerateImageResult> {
  const { endpoint: imageEndpoint, apiKey: imageApiKey, model: imageModel } = await getAzureConfig()

  if (!imageEndpoint || !imageApiKey) {
    return generatePlaceholder(opts.prompt, subDir)
  }

  await enforceRateLimit()

  const response = await axios.post(
    imageEndpoint,
    {
      prompt: applyStyle(opts.prompt),
      width: opts.width ?? 1024,
      height: opts.height ?? 1024,
      n: 1,
      model: imageModel,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'api-key': imageApiKey,
      },
      timeout: 60_000,
    }
  )

  const b64 = response.data?.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data returned from Azure AI')

  return saveBase64Image(b64, subDir)
}

async function saveBase64Image(b64: string, subDir: string): Promise<GenerateImageResult> {
  const dir = path.join(config.uploadsDir, subDir)
  await fs.mkdir(dir, { recursive: true })

  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.png`
  const filePath = path.join(dir, filename)
  await fs.writeFile(filePath, Buffer.from(b64, 'base64'))

  const publicUrl = `uploads/${subDir}/${filename}`
  return { filePath, publicUrl }
}

async function generatePlaceholder(prompt: string, subDir: string): Promise<GenerateImageResult> {
  const seed = prompt.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const colors = ['0c4433', 'd7283d', '00752f', '000b5e', '4f002f', '280c61', 'fd9c54']
  const color = colors[seed % colors.length]
  const text = encodeURIComponent(prompt.slice(0, 2).toUpperCase())
  const publicUrl = `https://placehold.co/256x256/${color}/ffffff?text=${text}`
  return { filePath: '', publicUrl }
}

const STYLE_SUFFIX = 'Flat 2D cartoon illustration style. Friendly, simple, bold outlines, vibrant colors. No photorealism, no 3D rendering, no realistic faces or photographs.'

export function applyStyle(prompt: string): string {
  return `${prompt.trim()}. ${STYLE_SUFFIX}`
}

export const DEFAULT_PROMPTS = {
  profile: 'A fun friendly cartoon avatar for an office sports competition player. Cheerful character, simple design, colorful.',
  team: (teamName: string) => `A fun mascot or logo for a sports team called "${teamName}". Bold, colorful, playful.`,
  challenge: (challengeName: string) => `An app icon for a sports challenge called "${challengeName}". Simple, bold, colorful icon style.`,
  competition: (competitionName: string) => `A banner illustration for an office sports competition called "${competitionName}". Cheerful, energetic, team-themed.`,
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export async function generateRandomProfileImage(userId: string): Promise<void> {
  const opts = await getImageOptions()

  const subject = randomFrom(opts.subjects)
  const clothes = randomFrom(opts.clothes)
  const accessory = randomFrom(opts.accessories)

  const wearingPart = clothes === 'None' ? '' : `, wearing ${clothes}`
  const accPart = accessory === 'None' ? '' : (clothes === 'None' ? ` with ${accessory}` : ` and ${accessory}`)
  const prompt = `Close-up portrait of a ${subject} avatar${wearingPart}${accPart}. Face and shoulders only, centered, large in frame. Colorful, playful, simple.`

  const result = await generateImage({ prompt }, 'profiles')
  await prisma.user.update({
    where: { id: userId },
    data: { profileImageUrl: result.publicUrl },
  })
}
