import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GlobalRole } from '@prisma/client'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { computeShootingCounted } from '../lib/scoring.js'

const addShotSchema = z.object({
  userId: z.string(),
  value: z.number().int().min(0),
})

const updateShotSchema = z.object({
  value: z.number().int().min(0),
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

export async function shotRoutes(app: FastifyInstance) {
  // List all shots for a challenge, with per-team totals (the plain sum of every
  // shot) and the number of shots each team has registered.
  app.get('/competition/:competitionId/challenge/:ccId', { preHandler: requireAuth }, async (request, reply) => {
    const { competitionId, ccId } = request.params as { competitionId: string; ccId: string }

    const cc = await prisma.competitionChallenge.findUnique({
      where: { id: ccId },
      include: { challenge: true },
    })
    if (!cc) return reply.status(404).send({ error: 'Competition challenge not found' })

    const [shots, players] = await Promise.all([
      prisma.shot.findMany({
        where: { competitionId, competitionChallengeId: ccId },
        include: {
          player: { select: { id: true, username: true, displayName: true, profileImageUrl: true } },
        },
        orderBy: [{ userId: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.competitionPlayer.findMany({
        where: { competitionId },
        select: { userId: true, teamId: true },
      }),
    ])

    const teamByUser = new Map(players.map(p => [p.userId, p.teamId ?? null]))

    // Group shots by team, then compute which shots count toward each team
    // (best shotsPerTeam with each player's minimum guaranteed).
    const shotsByTeam = new Map<string, typeof shots>()
    for (const s of shots) {
      const teamId = teamByUser.get(s.userId) ?? '__none__'
      const arr = shotsByTeam.get(teamId)
      if (arr) arr.push(s)
      else shotsByTeam.set(teamId, [s])
    }

    const countedIds = new Set<string>()
    const teamTotals: Record<string, number> = {}
    const teamShotCounts: Record<string, number> = {}
    for (const [teamId, teamShots] of shotsByTeam.entries()) {
      const res = computeShootingCounted(
        teamShots.map(s => ({ id: s.id, userId: s.userId, value: s.value })),
        cc.challenge.shotsPerTeam,
        cc.challenge.minShotsPerPlayer,
        cc.challenge.shootingLowerIsBetter
      )
      res.countedIds.forEach(id => countedIds.add(id))
      teamTotals[teamId] = res.teamTotal
      teamShotCounts[teamId] = teamShots.length
    }

    return {
      config: {
        shotsPerTeam: cc.challenge.shotsPerTeam,
        minShotsPerPlayer: cc.challenge.minShotsPerPlayer,
        maxScorePerShot: cc.challenge.maxScorePerShot,
        lowerIsBetter: cc.challenge.shootingLowerIsBetter,
      },
      shots: shots.map(s => ({ ...s, counted: countedIds.has(s.id) })),
      teamTotals,
      teamShotCounts,
    }
  })

  // Register a new shot for a player.
  app.post('/competition/:competitionId/challenge/:ccId', { preHandler: requireAuth }, async (request, reply) => {
    const { competitionId, ccId } = request.params as { competitionId: string; ccId: string }
    const me = request.user as { id: string; role: GlobalRole }
    const body = addShotSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    if (!(await canEnterScore(competitionId, me.id, me.role))) {
      return reply.status(403).send({ error: 'Not authorized to enter scores' })
    }

    const cc = await prisma.competitionChallenge.findUnique({
      where: { id: ccId },
      include: { challenge: true },
    })
    if (!cc) return reply.status(404).send({ error: 'Competition challenge not found' })

    if (body.data.value > cc.challenge.maxScorePerShot) {
      return reply.status(400).send({ error: `Shot value exceeds max of ${cc.challenge.maxScorePerShot}` })
    }

    // No cap on how many shots a player/team may take — everyone shoots so they
    // all appear on the individual leaderboard. The team score only counts the
    // best `shotsPerTeam` shots (see GET / leaderboard).
    const count = await prisma.shot.count({
      where: { competitionChallengeId: ccId, userId: body.data.userId },
    })

    const shot = await prisma.shot.create({
      data: {
        competitionId,
        competitionChallengeId: ccId,
        userId: body.data.userId,
        value: body.data.value,
        order: count,
        enteredByUserId: me.id,
      },
    })
    return reply.status(201).send({ shot })
  })

  // Edit an existing shot's value.
  app.put('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: GlobalRole }
    const body = updateShotSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    const existing = await prisma.shot.findUnique({
      where: { id },
      include: { competitionChallenge: { include: { challenge: true } } },
    })
    if (!existing) return reply.status(404).send({ error: 'Shot not found' })

    if (!(await canEnterScore(existing.competitionId, me.id, me.role))) {
      return reply.status(403).send({ error: 'Not authorized' })
    }

    if (body.data.value > existing.competitionChallenge.challenge.maxScorePerShot) {
      return reply.status(400).send({ error: `Shot value exceeds max of ${existing.competitionChallenge.challenge.maxScorePerShot}` })
    }

    const shot = await prisma.shot.update({
      where: { id },
      data: { value: body.data.value, enteredByUserId: me.id },
    })
    return { shot }
  })

  // Clear (delete) a shot. Allowed for any authorized scorekeeper, not admin-only.
  app.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: GlobalRole }

    const existing = await prisma.shot.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Shot not found' })

    if (!(await canEnterScore(existing.competitionId, me.id, me.role))) {
      return reply.status(403).send({ error: 'Not authorized' })
    }

    await prisma.shot.delete({ where: { id } })
    return { success: true }
  })
}
