import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ScoreType, TeamScoreMode } from '@prisma/client'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { generateImage, DEFAULT_PROMPTS } from '../lib/imageGeneration.js'

const challengeSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(1024).optional(),
  scoreType: z.nativeEnum(ScoreType).optional(),
  defaultTeamScoreMode: z.nativeEnum(TeamScoreMode).optional(),
  bestNPlayers: z.number().int().min(1).optional(),
  isGlobalTemplate: z.boolean().optional(),
  isQuiz: z.boolean().optional(),
})

export async function challengeRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const me = request.user as { role: string }
    const challenges = await prisma.challenge.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { quizQuestions: true } } },
    })
    return { challenges }
  })

  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: {
        competitionChallenges: {
          include: { competition: true },
        },
      },
    })
    if (!challenge) return reply.status(404).send({ error: 'Challenge not found' })
    return { challenge }
  })

  app.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const body = challengeSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    const challenge = await prisma.challenge.create({ data: body.data })
    return reply.status(201).send({ challenge })
  })

  app.put('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = challengeSchema.partial().safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    const challenge = await prisma.challenge.update({ where: { id }, data: body.data })
    return { challenge }
  })

  app.delete('/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = request.params as { id: string }
    await prisma.challenge.delete({ where: { id } })
    return { success: true }
  })

  app.post('/:id/generate-image', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { prompt?: string }

    const challenge = await prisma.challenge.findUnique({ where: { id } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge not found' })

    const prompt = body.prompt ?? DEFAULT_PROMPTS.challenge(challenge.name)
    const result = await generateImage({ prompt }, 'challenges')
    const updated = await prisma.challenge.update({
      where: { id },
      data: { logoUrl: result.publicUrl },
    })
    return { challenge: updated, imageUrl: result.publicUrl }
  })

  app.get('/all-time/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const challenge = await prisma.challenge.findUnique({ where: { id } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge not found' })

    const scores = await prisma.score.findMany({
      where: { competitionChallenge: { challengeId: id } },
      include: {
        player: { select: { id: true, username: true, displayName: true, profileImageUrl: true } },
        competition: true,
      },
      orderBy: [{ rawScore: 'desc' }, { createdAt: 'asc' }],
    })

    return { challenge, scores }
  })
}
