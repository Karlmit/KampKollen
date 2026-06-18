import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'
import { config } from '../config.js'

// An image-prompt option with an English value and an optional Swedish label.
// The English value is always used to build the (English) generation prompt;
// the Swedish label is only shown in the UI, falling back to English when absent.
export interface LocalizedOption {
  en: string
  sv?: string
}

const DEFAULT_SUBJECTS: LocalizedOption[] = ['Farmyard Animal', 'Forest Animal', 'Fish', 'Fruit', 'Vegetable', 'Finance Symbol', 'Yellow Bear'].map(en => ({ en }))
const DEFAULT_CLOTHES: LocalizedOption[] = ['None', 'a T-shirt', 'a suit and tie', 'a hoodie', 'a lab coat', 'a cowboy outfit', 'a superhero cape', "a chef's apron", 'viking armor', 'a tuxedo', 'a sports jersey', 'a pirate costume', 'a wizard robe', 'a ninja outfit', 'a space suit', 'a Hawaiian shirt'].map(en => ({ en }))
const DEFAULT_ACCESSORIES: LocalizedOption[] = ['None', 'a top hat', 'a bow tie', 'a crown', 'a scarf', 'a monocle', 'a party hat', 'a pair of headphones', 'a wizard hat', 'a pirate hat', 'a santa hat', 'a cowboy hat', 'a flower crown', 'a cape', 'a pair of sunglasses', 'a magnifying glass', 'a skateboard', 'a briefcase', 'a tiny umbrella'].map(en => ({ en }))

// Accept both legacy (array of strings) and new (array of { en, sv }) formats.
function normalizeOptions(parsed: unknown, fallback: LocalizedOption[]): LocalizedOption[] {
  if (!Array.isArray(parsed)) return fallback
  const out = parsed
    .map((o): LocalizedOption => {
      if (typeof o === 'string') return { en: o.trim() }
      const en = String((o as any)?.en ?? '').trim()
      const sv = String((o as any)?.sv ?? '').trim()
      return sv ? { en, sv } : { en }
    })
    .filter(o => o.en.length > 0)
  return out.length > 0 ? out : fallback
}

// Ensure a "None" option exists (sentinel for "no clothing/accessory").
function ensureNone(options: LocalizedOption[]): LocalizedOption[] {
  return options.some(o => o.en === 'None') ? options : [{ en: 'None' }, ...options]
}

function parseOption(value: string | undefined, fallback: LocalizedOption[]): LocalizedOption[] {
  if (!value) return fallback
  try {
    return normalizeOptions(JSON.parse(value), fallback)
  } catch {
    return fallback
  }
}

export const SETTING_KEYS = [
  'azure_image_endpoint',
  'azure_image_api_key',
  'azure_image_model',
  'single_group_mode',
  'single_group_id',
] as const

export type SettingKey = typeof SETTING_KEYS[number]

// Registration config: when single-group mode is on, new users skip the group
// chooser and are automatically placed in the configured group.
export async function getRegistrationConfig(): Promise<{ singleGroupMode: boolean; singleGroupId: string | null }> {
  const rows = await prisma.setting.findMany({ where: { key: { in: ['single_group_mode', 'single_group_id'] } } })
  const db: Record<string, string> = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return {
    singleGroupMode: db['single_group_mode'] === 'true',
    singleGroupId: db['single_group_id'] || null,
  }
}

// Read Azure image config: DB values take priority over env vars
export async function getAzureConfig(): Promise<{ endpoint: string; apiKey: string; model: string }> {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...SETTING_KEYS] } } })
  const db: Record<string, string> = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return {
    endpoint: db['azure_image_endpoint'] || config.azure.imageEndpoint,
    apiKey: db['azure_image_api_key'] || config.azure.imageApiKey,
    model: db['azure_image_model'] || config.azure.imageModel,
  }
}

const updateSchema = z.object({
  azure_image_endpoint: z.string().optional(),
  azure_image_api_key: z.string().optional(),
  azure_image_model: z.string().optional(),
  single_group_mode: z.string().optional(),
  single_group_id: z.string().optional(),
})

export async function getImageOptions(): Promise<{ subjects: LocalizedOption[]; clothes: LocalizedOption[]; accessories: LocalizedOption[] }> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['image_subjects', 'image_clothes', 'image_accessories'] } },
  })
  const db: Record<string, string> = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return {
    subjects: parseOption(db['image_subjects'], DEFAULT_SUBJECTS),
    clothes: parseOption(db['image_clothes'], DEFAULT_CLOTHES),
    accessories: parseOption(db['image_accessories'], DEFAULT_ACCESSORIES),
  }
}

export async function imageOptionRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return getImageOptions()
  })

  app.put('/', { preHandler: requireAdmin }, async (request) => {
    const body = request.body as { subjects?: unknown; clothes?: unknown; accessories?: unknown }
    const updates: Array<{ key: string; value: string }> = []

    if (Array.isArray(body.subjects) && body.subjects.length > 0) {
      const subjects = normalizeOptions(body.subjects, DEFAULT_SUBJECTS)
      updates.push({ key: 'image_subjects', value: JSON.stringify(subjects) })
    }
    if (Array.isArray(body.clothes)) {
      const clothes = ensureNone(normalizeOptions(body.clothes, DEFAULT_CLOTHES))
      updates.push({ key: 'image_clothes', value: JSON.stringify(clothes) })
    }
    if (Array.isArray(body.accessories)) {
      const accessories = ensureNone(normalizeOptions(body.accessories, DEFAULT_ACCESSORIES))
      updates.push({ key: 'image_accessories', value: JSON.stringify(accessories) })
    }

    await Promise.all(updates.map(({ key, value }) =>
      prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
    ))
    return { success: true }
  })
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAdmin }, async () => {
    const rows = await prisma.setting.findMany({ where: { key: { in: [...SETTING_KEYS] } } })
    const db: Record<string, string> = Object.fromEntries(rows.map(r => [r.key, r.value]))
    return {
      settings: {
        azure_image_endpoint: db['azure_image_endpoint'] ?? '',
        azure_image_api_key: db['azure_image_api_key'] ?? '',
        azure_image_model: db['azure_image_model'] ?? '',
        single_group_mode: db['single_group_mode'] ?? 'false',
        single_group_id: db['single_group_id'] ?? '',
      },
      // Indicate which values are coming from env (so UI can show placeholders)
      envDefaults: {
        azure_image_endpoint: config.azure.imageEndpoint,
        azure_image_model: config.azure.imageModel,
        azure_image_api_key: config.azure.imageApiKey ? '••••••••' : '',
      },
    }
  })

  app.put('/', { preHandler: requireAdmin }, async (request, reply) => {
    const body = updateSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    await Promise.all(
      Object.entries(body.data)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) =>
          prisma.setting.upsert({
            where: { key },
            update: { value: value! },
            create: { key, value: value! },
          })
        )
    )

    return { success: true }
  })
}
