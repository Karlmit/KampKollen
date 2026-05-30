import { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { generateImage } from '../lib/imageGeneration.js'
import { GlobalRole } from '@prisma/client'

const DEFAULT_TROPHY_WORDS = [
  'Speed', 'Accuracy', 'Strength', 'Teamwork', 'Leadership',
  'Champion', 'Legend', 'MVP', 'Comeback', 'Underdog',
  'Spirit', 'Precision', 'Endurance', 'Victory', 'Domination',
  'Agility', 'Focus', 'Courage', 'Persistence', 'Hustle',
]

async function getTrophyWords(): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key: 'trophy_words' } })
  return row ? JSON.parse(row.value) : DEFAULT_TROPHY_WORDS
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export async function trophyWordRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAdmin }, async () => {
    return { words: await getTrophyWords() }
  })

  app.put('/', { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { words?: string[] }
    if (!Array.isArray(body.words) || body.words.length === 0) {
      return reply.status(400).send({ error: 'words must be a non-empty array' })
    }
    await prisma.setting.upsert({
      where: { key: 'trophy_words' },
      update: { value: JSON.stringify(body.words) },
      create: { key: 'trophy_words', value: JSON.stringify(body.words) },
    })
    return { success: true }
  })
}

export async function trophyRoutes(app: FastifyInstance) {
  // List trophies in storage (unassigned)
  app.get('/storage', { preHandler: requireAdmin }, async () => {
    const trophies = await prisma.trophy.findMany({
      where: { userId: null },
      orderBy: { createdAt: 'desc' },
    })
    return { trophies }
  })

  // List trophies for a user
  app.get('/user/:userId', { preHandler: requireAuth }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const me = request.user as { id: string; role: GlobalRole }

    if (me.id !== userId && me.role !== GlobalRole.ADMIN) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const trophies = await prisma.trophy.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
    })
    return { trophies }
  })

  // Generate a trophy into storage
  app.post('/generate', { preHandler: requireAdmin }, async () => {
    const words = await getTrophyWords()
    const title = randomFrom(words)
    const prompt = `A trophy or award icon themed around "${title}". Celebratory, colorful, playful, bold design.`
    const result = await generateImage({ prompt }, 'trophies')
    const trophy = await prisma.trophy.create({
      data: { title, imageUrl: result.publicUrl },
    })
    return { trophy }
  })

  // Generate a trophy and immediately send to user
  app.post('/generate-send', { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { userId?: string }
    if (!body.userId) return reply.status(400).send({ error: 'userId required' })

    const user = await prisma.user.findUnique({ where: { id: body.userId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const words = await getTrophyWords()
    const title = randomFrom(words)
    const prompt = `A trophy or award icon themed around "${title}". Celebratory, colorful, playful, bold design.`
    const result = await generateImage({ prompt }, 'trophies')
    const trophy = await prisma.trophy.create({
      data: { title, imageUrl: result.publicUrl, userId: body.userId, sentAt: new Date() },
    })
    return { trophy }
  })

  // Send a stored trophy to a user
  app.post('/:id/send', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { userId?: string }
    if (!body.userId) return reply.status(400).send({ error: 'userId required' })

    const trophy = await prisma.trophy.findUnique({ where: { id } })
    if (!trophy) return reply.status(404).send({ error: 'Trophy not found' })
    if (trophy.userId) return reply.status(400).send({ error: 'Trophy already assigned' })

    const updated = await prisma.trophy.update({
      where: { id },
      data: { userId: body.userId, sentAt: new Date(), isOpened: false },
    })
    return { trophy: updated }
  })

  // Take back a trophy to storage
  app.post('/:id/take-back', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const trophy = await prisma.trophy.findUnique({ where: { id } })
    if (!trophy) return reply.status(404).send({ error: 'Trophy not found' })

    const updated = await prisma.trophy.update({
      where: { id },
      data: { userId: null, sentAt: null, isOpened: false },
    })
    return { trophy: updated }
  })

  // Open a trophy (user's own only)
  app.post('/:id/open', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string }

    const trophy = await prisma.trophy.findUnique({ where: { id } })
    if (!trophy) return reply.status(404).send({ error: 'Trophy not found' })
    if (trophy.userId !== me.id) return reply.status(403).send({ error: 'Forbidden' })

    const updated = await prisma.trophy.update({
      where: { id },
      data: { isOpened: true },
    })
    return { trophy: updated }
  })

  // Delete trophy from storage (admin, unassigned only)
  app.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const trophy = await prisma.trophy.findUnique({ where: { id } })
    if (!trophy) return reply.status(404).send({ error: 'Trophy not found' })
    if (trophy.userId) return reply.status(400).send({ error: 'Cannot delete assigned trophy; take it back first' })

    await prisma.trophy.delete({ where: { id } })
    return { success: true }
  })
}
