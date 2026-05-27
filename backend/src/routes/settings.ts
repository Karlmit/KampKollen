import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'
import { config } from '../config.js'

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
