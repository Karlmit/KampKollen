import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GlobalRole, ScoreType } from '@prisma/client'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { computeCalculatedPoints } from '../lib/scoring.js'

const upsertScoreSchema = z.object({
  userId: z.string(),
  rawScore: z.number().optional().nullable(),
  timeMs: z.number().int().optional().nullable(),
  placement: z.number().int().optional().nullable(),
  calculatedPoints: z.number().optional().nullable(),
  note: z.string().max(256).optional(),
})

async function canEnterScore(
  competitionId: string,
  userId: string,
  userRole: GlobalRole
): Promise<boolean> {
  if (userRole === GlobalRole.ADMIN) return true
  if (userRole === GlobalRole.SCOREKEEPER) return true
  const cp = await prisma.competitionPlayer.findUnique({
    where: { competitionId_userId: { competitionId, userId } },
  })
  return cp?.isScorekeeper === true || cp?.isTeamLeader === true
}

export async function scoreRoutes(app: FastifyInstance) {
  app.get('/competition/:competitionId', { preHandler: requireAuth }, async (request) => {
    const { competitionId } = request.params as { competitionId: string }
    const scores = await prisma.score.findMany({
      where: { competitionId },
      include: {
        player: { select: { id: true, username: true, displayName: true, profileImageUrl: true } },
        competitionChallenge: { include: { challenge: true } },
        enteredByUser: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return { scores }
  })

  app.get('/competition/:competitionId/challenge/:ccId', { preHandler: requireAuth }, async (request) => {
    const { competitionId, ccId } = request.params as { competitionId: string; ccId: string }
    const scores = await prisma.score.findMany({
      where: { competitionId, competitionChallengeId: ccId },
      include: {
        player: { select: { id: true, username: true, displayName: true, profileImageUrl: true } },
        enteredByUser: { select: { id: true, username: true } },
      },
      orderBy: [{ rawScore: 'desc' }, { createdAt: 'asc' }],
    })
    return { scores }
  })

  app.post('/competition/:competitionId/challenge/:ccId', { preHandler: requireAuth }, async (request, reply) => {
    const { competitionId, ccId } = request.params as { competitionId: string; ccId: string }
    const me = request.user as { id: string; role: GlobalRole }
    const body = upsertScoreSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    if (!(await canEnterScore(competitionId, me.id, me.role))) {
      return reply.status(403).send({ error: 'Not authorized to enter scores' })
    }

    const cc = await prisma.competitionChallenge.findUnique({
      where: { id: ccId },
      include: { challenge: true },
    })
    if (!cc) return reply.status(404).send({ error: 'Competition challenge not found' })

    const scoreType: ScoreType = (cc.scoreTypeOverride ?? cc.challenge.scoreType) as ScoreType

    // Get all existing scores for this challenge to recalculate ranked_points
    const existingScores = await prisma.score.findMany({ where: { competitionChallengeId: ccId } })

    const { userId, ...scoreData } = body.data

    // Calculate points for ranked types
    let calculatedPoints = scoreData.calculatedPoints ?? null
    if (scoreType === 'ranked_points') {
      const allScores = [
        ...existingScores.filter(s => s.userId !== userId),
        { userId, rawScore: scoreData.rawScore ?? null, timeMs: scoreData.timeMs ?? null, placement: scoreData.placement ?? null, calculatedPoints: null, teamId: null },
      ]
      calculatedPoints = computeCalculatedPoints(
        { userId, rawScore: scoreData.rawScore ?? null, timeMs: scoreData.timeMs ?? null, placement: scoreData.placement ?? null, calculatedPoints: null, teamId: null },
        allScores,
        scoreType
      )
    } else if (!['manual_points'].includes(scoreType)) {
      calculatedPoints = computeCalculatedPoints(
        { userId, rawScore: scoreData.rawScore ?? null, timeMs: scoreData.timeMs ?? null, placement: scoreData.placement ?? null, calculatedPoints: null, teamId: null },
        [],
        scoreType
      )
    }

    const score = await prisma.score.upsert({
      where: { competitionChallengeId_userId: { competitionChallengeId: ccId, userId } },
      create: {
        competitionId,
        competitionChallengeId: ccId,
        userId,
        ...scoreData,
        calculatedPoints,
        enteredByUserId: me.id,
      },
      update: {
        ...scoreData,
        calculatedPoints,
        enteredByUserId: me.id,
      },
      include: {
        player: { select: { id: true, username: true, displayName: true } },
        competitionChallenge: { include: { challenge: true } },
      },
    })

    // Recalculate ranked_points for all players in this challenge
    if (scoreType === 'ranked_points') {
      const allUpdated = await prisma.score.findMany({ where: { competitionChallengeId: ccId } })
      for (const s of allUpdated) {
        const pts = computeCalculatedPoints(
          { userId: s.userId, rawScore: s.rawScore, timeMs: s.timeMs, placement: s.placement, calculatedPoints: s.calculatedPoints, teamId: null },
          allUpdated.map(x => ({ userId: x.userId, rawScore: x.rawScore, timeMs: x.timeMs, placement: x.placement, calculatedPoints: x.calculatedPoints, teamId: null })),
          scoreType
        )
        await prisma.score.update({ where: { id: s.id }, data: { calculatedPoints: pts } })
      }
    }

    return reply.status(201).send({ score })
  })

  app.put('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: GlobalRole }
    const body = upsertScoreSchema.omit({ userId: true }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    const existing = await prisma.score.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Score not found' })

    if (!(await canEnterScore(existing.competitionId, me.id, me.role))) {
      return reply.status(403).send({ error: 'Not authorized' })
    }

    const score = await prisma.score.update({
      where: { id },
      data: { ...body.data, enteredByUserId: me.id },
      include: {
        player: { select: { id: true, username: true, displayName: true } },
        competitionChallenge: { include: { challenge: true } },
      },
    })
    return { score }
  })

  app.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: GlobalRole }

    const existing = await prisma.score.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Score not found' })

    if (me.role !== GlobalRole.ADMIN) {
      return reply.status(403).send({ error: 'Admin access required' })
    }

    await prisma.score.delete({ where: { id } })
    return { success: true }
  })
}
