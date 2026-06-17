import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GlobalRole } from '@prisma/client'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { TeamScoreMode } from '@prisma/client'
import { computeShootingCounted, computeTeamScore, playerAttemptTotal } from '../lib/scoring.js'

const addShotSchema = z.object({
  userId: z.string(),
  value: z.number().min(0),
})

const updateShotSchema = z.object({
  value: z.number().min(0),
})

// Who may enter/edit a shot:
//   - global ADMIN / REFEREE: any team.
//   - per-competition team leader / scorekeeper: their OWN team only — the shot's
//     target player must be on the same team as the actor.
async function canEnterScore(
  competitionId: string,
  userId: string,
  userRole: GlobalRole,
  target: { teamId?: string | null; playerUserId?: string }
): Promise<boolean> {
  if (userRole === GlobalRole.ADMIN || userRole === GlobalRole.REFEREE) return true
  const cp = await prisma.competitionPlayer.findUnique({
    where: { competitionId_userId: { competitionId, userId } },
  })
  if (!cp || !(cp.isScorekeeper || cp.isTeamLeader) || !cp.teamId) return false
  let targetTeamId = target.teamId ?? null
  if (targetTeamId == null && target.playerUserId) {
    const tp = await prisma.competitionPlayer.findUnique({
      where: { competitionId_userId: { competitionId, userId: target.playerUserId } },
    })
    targetTeamId = tp?.teamId ?? null
  }
  return targetTeamId != null && targetTeamId === cp.teamId
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
    const ch = cc.challenge
    const lowerBetter = ch.shootingLowerIsBetter

    // Group shots by team.
    const shotsByTeam = new Map<string, typeof shots>()
    for (const s of shots) {
      const teamId = teamByUser.get(s.userId) ?? '__none__'
      const arr = shotsByTeam.get(teamId)
      if (arr) arr.push(s)
      else shotsByTeam.set(teamId, [s])
    }

    const teamScoreMode: TeamScoreMode = (cc.teamScoreModeOverride ?? ch.defaultTeamScoreMode) as TeamScoreMode
    const bestN = cc.bestNPlayersOverride ?? ch.bestNPlayers

    const countedIds = new Set<string>()
    const teamTotals: Record<string, number> = {}
    const teamShotCounts: Record<string, number> = {}
    for (const [teamId, teamShots] of shotsByTeam.entries()) {
      teamShotCounts[teamId] = teamShots.length
      if (ch.useTeamScoreMode) {
        // Spike-style: each player's total (sum-all or best-N) is aggregated into the
        // team score via the selected team-score mode. Every attempt "counts".
        const byPlayer: Record<string, number[]> = {}
        for (const s of teamShots) (byPlayer[s.userId] ??= []).push(s.value)
        const playerTotals = Object.values(byPlayer).map(vals =>
          playerAttemptTotal(vals, ch.sumAllAttempts, ch.minShotsPerPlayer, lowerBetter)
        )
        teamTotals[teamId] = computeTeamScore(playerTotals, teamScoreMode, bestN)
        teamShots.forEach(s => countedIds.add(s.id))
      } else {
        // Classic shooting: the team's best `shotsPerTeam` shots count (with each
        // player's minimum guaranteed).
        const res = computeShootingCounted(
          teamShots.map(s => ({ id: s.id, userId: s.userId, value: s.value })),
          ch.shotsPerTeam,
          ch.minShotsPerPlayer,
          lowerBetter
        )
        res.countedIds.forEach(id => countedIds.add(id))
        teamTotals[teamId] = res.teamTotal
      }
    }

    return {
      config: {
        shotsPerTeam: ch.shotsPerTeam,
        minShotsPerPlayer: ch.minShotsPerPlayer,
        maxScorePerShot: ch.maxScorePerShot,
        lowerIsBetter: lowerBetter,
        valueUnit: ch.valueUnit,
        allowDecimals: ch.allowDecimals,
        attemptsPerPlayer: ch.attemptsPerPlayer,
        sumAllAttempts: ch.sumAllAttempts,
        useTeamScoreMode: ch.useTeamScoreMode,
        teamScoreMode,
        bestNPlayers: bestN,
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

    if (!(await canEnterScore(competitionId, me.id, me.role, { playerUserId: body.data.userId }))) {
      return reply.status(403).send({ error: 'Not authorized to enter scores' })
    }

    const cc = await prisma.competitionChallenge.findUnique({
      where: { id: ccId },
      include: { challenge: true },
    })
    if (!cc) return reply.status(404).send({ error: 'Competition challenge not found' })

    // maxScorePerShot of 0 means "no per-attempt cap" (e.g. cm measurements).
    if (cc.challenge.maxScorePerShot > 0 && body.data.value > cc.challenge.maxScorePerShot) {
      return reply.status(400).send({ error: `Shot value exceeds max of ${cc.challenge.maxScorePerShot}` })
    }

    // Count existing attempts for this player. Classic shooting leaves this uncapped
    // (everyone shoots, the team score only counts the best `shotsPerTeam`), but the
    // Spike-style config sets `attemptsPerPlayer` as a hard limit per player.
    const count = await prisma.shot.count({
      where: { competitionChallengeId: ccId, userId: body.data.userId },
    })

    if (cc.challenge.attemptsPerPlayer != null && count >= cc.challenge.attemptsPerPlayer) {
      return reply.status(400).send({ error: `Player already has the maximum of ${cc.challenge.attemptsPerPlayer} attempts` })
    }

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

    if (!(await canEnterScore(existing.competitionId, me.id, me.role, { playerUserId: existing.userId }))) {
      return reply.status(403).send({ error: 'Not authorized' })
    }

    const maxPerShot = existing.competitionChallenge.challenge.maxScorePerShot
    if (maxPerShot > 0 && body.data.value > maxPerShot) {
      return reply.status(400).send({ error: `Shot value exceeds max of ${maxPerShot}` })
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

    if (!(await canEnterScore(existing.competitionId, me.id, me.role, { playerUserId: existing.userId }))) {
      return reply.status(403).send({ error: 'Not authorized' })
    }

    await prisma.shot.delete({ where: { id } })
    return { success: true }
  })
}
