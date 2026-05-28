import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'
import { config } from '../config.js'

const DEFAULT_SUBJECTS = ['Farmyard Animal', 'Forest Animal', 'Fish', 'Fruit', 'Vegetable', 'Finance Symbol', 'Yellow Bear']
const DEFAULT_CLOTHES = ['None', 'a T-shirt', 'a suit and tie', 'a hoodie', 'a lab coat', 'a cowboy outfit', 'a superhero cape', "a chef's apron", 'viking armor', 'a tuxedo', 'a sports jersey', 'a pirate costume', 'a wizard robe', 'a ninja outfit', 'a space suit', 'a Hawaiian shirt']
const DEFAULT_ACCESSORIES = ['None', 'a top hat', 'a bow tie', 'a crown', 'a scarf', 'a monocle', 'a party hat', 'a pair of headphones', 'a wizard hat', 'a pirate hat', 'a santa hat', 'a cowboy hat', 'a flower crown', 'a cape', 'a pair of sunglasses', 'a magnifying glass', 'a skateboard', 'a briefcase', 'a tiny umbrella']

export const SETTING_KEYS = [
  'azure_image_endpoint',
  'azure_image_api_key',
  'azure_image_model',
] as const

export type SettingKey = typeof SETTING_KEYS[number]

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
})

export async function imageOptionRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['image_subjects', 'image_clothes', 'image_accessories'] } },
    })
    const db: Record<string, string> = Object.fromEntries(rows.map(r => [r.key, r.value]))
    return {
      subjects: db['image_subjects'] ? JSON.parse(db['image_subjects']) : DEFAULT_SUBJECTS,
      clothes: db['image_clothes'] ? JSON.parse(db['image_clothes']) : DEFAULT_CLOTHES,
      accessories: db['image_accessories'] ? JSON.parse(db['image_accessories']) : DEFAULT_ACCESSORIES,
    }
  })

  app.put('/', { preHandler: requireAdmin }, async (request) => {
    const body = request.body as { subjects?: string[]; clothes?: string[]; accessories?: string[] }
    const updates: Array<{ key: string; value: string }> = []

    if (Array.isArray(body.subjects) && body.subjects.length > 0) {
      updates.push({ key: 'image_subjects', value: JSON.stringify(body.subjects) })
    }
    if (Array.isArray(body.clothes)) {
      const clothes = body.clothes.includes('None') ? body.clothes : ['None', ...body.clothes]
      updates.push({ key: 'image_clothes', value: JSON.stringify(clothes) })
    }
    if (Array.isArray(body.accessories)) {
      const accessories = body.accessories.includes('None') ? body.accessories : ['None', ...body.accessories]
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
