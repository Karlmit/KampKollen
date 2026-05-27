import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { generateImage, DEFAULT_PROMPTS } from '../lib/imageGeneration.js'

const scoringModeEnum = z.enum(['raw_sum', 'placement_points'])

const createCompetitionSchema = z.object({
  name: z.string().min(1).max(128),
  date: z.string().datetime().optional(),
  scoringMode: scoringModeEnum.optional(),
  challengeIds: z.array(z.string()).optional(),
  teamCount: z.number().int().min(1).max(20).optional(),
  teamNames: z.array(z.string()).optional(),
})

const updateCompetitionSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  date: z.string().datetime().nullable().optional(),
  status: z.enum(['DRAFT', 'REGISTRATION', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  scoringMode: scoringModeEnum.optional(),
})

const addChallengeSchema = z.object({
  challengeId: z.string(),
  order: z.number().int().optional(),
  scoreTypeOverride: z.string().optional(),
  teamScoreModeOverride: z.string().optional(),
  bestNPlayersOverride: z.number().int().optional(),
})

export async function competitionRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async () => {
    const competitions = await prisma.competition.findMany({
      include: {
        teams: { select: { id: true, name: true } },
        _count: { select: { players: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })
    return { competitions }
  })

  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const competition = await prisma.competition.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            leader: { select: { id: true, username: true, displayName: true } },
            players: {
              include: { user: { select: { id: true, username: true, displayName: true, profileImageUrl: true } } },
            },
          },
        },
        challenges: {
          include: { challenge: true },
          orderBy: { order: 'asc' },
        },
        players: {
          include: {
            user: { select: { id: true, username: true, displayName: true, profileImageUrl: true } },
            team: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!competition) return reply.status(404).send({ error: 'Competition not found' })
    return { competition }
  })

  app.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const body = createCompetitionSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    const me = request.user as { id: string }
    const { name, date, scoringMode, challengeIds, teamCount, teamNames } = body.data

    const competition = await prisma.competition.create({
      data: {
        name,
        createdByUserId: me.id,
        ...(date && { date: new Date(date) }),
        ...(scoringMode && { scoringMode }),
      },
    })

    if (challengeIds?.length) {
      await prisma.competitionChallenge.createMany({
        data: challengeIds.map((challengeId, i) => ({
          competitionId: competition.id,
          challengeId,
          order: i,
        })),
      })
    }

    const count = teamCount ?? 3
    const names = teamNames ?? Array.from({ length: count }, (_, i) => `Team ${i + 1}`)
    await prisma.team.createMany({
      data: names.slice(0, count).map(teamName => ({
        competitionId: competition.id,
        name: teamName,
      })),
    })

    const full = await prisma.competition.findUnique({
      where: { id: competition.id },
      include: { teams: true, challenges: { include: { challenge: true } } },
    })
    return reply.status(201).send({ competition: full })
  })

  app.put('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updateCompetitionSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    const { date, ...rest } = body.data
    const competition = await prisma.competition.update({
      where: { id },
      data: { ...rest, ...(date !== undefined ? { date: date ? new Date(date) : null } : {}) },
    })
    return { competition }
  })

  app.post('/:id/generate-image', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { prompt?: string }
    const competition = await prisma.competition.findUnique({ where: { id } })
    if (!competition) return reply.status(404).send({ error: 'Competition not found' })

    const prompt = body.prompt ?? DEFAULT_PROMPTS.competition(competition.name)
    const result = await generateImage({ prompt }, 'competitions')
    const updated = await prisma.competition.update({ where: { id }, data: { imageUrl: result.publicUrl } })
    return { competition: updated, imageUrl: result.publicUrl }
  })

  app.post('/:id/challenges', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = addChallengeSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    const cc = await prisma.competitionChallenge.create({
      data: { competitionId: id, ...body.data } as any,
      include: { challenge: true },
    })
    return reply.status(201).send({ competitionChallenge: cc })
  })

  app.delete('/:id/challenges/:challengeId', { preHandler: requireAdmin }, async (request) => {
    const { id, challengeId } = request.params as { id: string; challengeId: string }
    await prisma.competitionChallenge.deleteMany({
      where: { competitionId: id, challengeId },
    })
    return { success: true }
  })

  app.post('/:id/join', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string }

    const competition = await prisma.competition.findUnique({ where: { id } })
    if (!competition) return reply.status(404).send({ error: 'Competition not found' })
    if (!['REGISTRATION', 'ACTIVE'].includes(competition.status)) {
      return reply.status(400).send({ error: 'Competition is not open for registration' })
    }

    const existing = await prisma.competitionPlayer.findUnique({
      where: { competitionId_userId: { competitionId: id, userId: me.id } },
    })
    if (existing) return reply.status(409).send({ error: 'Already joined this competition' })

    const player = await prisma.competitionPlayer.create({
      data: { competitionId: id, userId: me.id },
      include: { user: { select: { id: true, username: true, displayName: true } } },
    })
    return reply.status(201).send({ player })
  })

  app.post('/:id/players', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { userId: string; teamId?: string; isTeamLeader?: boolean; isScorekeeper?: boolean }

    const existing = await prisma.competitionPlayer.findUnique({
      where: { competitionId_userId: { competitionId: id, userId: body.userId } },
    })
    if (existing) return reply.status(409).send({ error: 'Player already in competition' })

    const player = await prisma.competitionPlayer.create({
      data: {
        competitionId: id,
        userId: body.userId,
        teamId: body.teamId ?? null,
        isTeamLeader: body.isTeamLeader ?? false,
        isScorekeeper: body.isScorekeeper ?? false,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        team: { select: { id: true, name: true } },
      },
    })
    return reply.status(201).send({ player })
  })

  app.put('/:id/players/:userId', { preHandler: requireAdmin }, async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string }
    const body = request.body as { teamId?: string | null; isTeamLeader?: boolean; isScorekeeper?: boolean }

    const player = await prisma.competitionPlayer.update({
      where: { competitionId_userId: { competitionId: id, userId } },
      data: body,
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        team: { select: { id: true, name: true } },
      },
    })
    return { player }
  })

  app.delete('/:id/players/:userId', { preHandler: requireAdmin }, async (request) => {
    const { id, userId } = request.params as { id: string; userId: string }
    await prisma.competitionPlayer.delete({
      where: { competitionId_userId: { competitionId: id, userId } },
    })
    return { success: true }
  })
}
