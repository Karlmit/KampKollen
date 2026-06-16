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
  shotsPerTeam: z.number().int().min(1).optional(),
  minShotsPerPlayer: z.number().int().min(1).optional(),
  maxScorePerShot: z.number().int().min(0).optional(),
  shootingLowerIsBetter: z.boolean().optional(),
  valueUnit: z.string().max(16).optional(),
  allowDecimals: z.boolean().optional(),
  attemptsPerPlayer: z.number().int().min(1).nullable().optional(),
  sumAllAttempts: z.boolean().optional(),
  useTeamScoreMode: z.boolean().optional(),
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

  app.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }

    // Check for competition links that have a started or completed quiz session.
    // Those must not be silently deleted — they hold live or historical data.
    const linked = await prisma.competitionChallenge.findMany({
      where: { challengeId: id },
      include: { quizSession: { select: { id: true, status: true } } },
    })

    const blockedBySession = linked.filter(
      cc => cc.quizSession && cc.quizSession.status !== 'LOBBY'
    )
    if (blockedBySession.length > 0) {
      return reply.status(409).send({
        error: 'This quiz has been started or completed in a competition and cannot be deleted.',
      })
    }

    // Remove any unstarted (LOBBY or no session) competition links first so the
    // FK constraint does not block the challenge delete.
    if (linked.length > 0) {
      await prisma.competitionChallenge.deleteMany({ where: { challengeId: id } })
    }

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
