import { FastifyInstance } from 'fastify'
import { ScoreType } from '@prisma/client'
import { prisma } from '../db.js'
import { optionalAuth } from '../middleware/auth.js'
import { isLowerBetter, playerAttemptTotal, getScoreValue, tiedRanks } from '../lib/scoring.js'
import { competitionLeaderboardInclude, computeCompetitionLeaderboard } from '../lib/competitionLeaderboard.js'

async function getUserGroupIds(userId: string): Promise<string[]> {
  const memberships = await prisma.userGroup.findMany({ where: { userId }, select: { groupId: true } })
  return memberships.map(m => m.groupId)
}

// All-time aggregation for shooting challenges: fold each player's shooting
// score (the sum of their best `minShotsPerPlayer` shots) per competition into
// bestPerPlayer.
function foldShootingShots(
  shots: any[],
  challenge: { shootingLowerIsBetter: boolean; minShotsPerPlayer: number; sumAllAttempts?: boolean },
  bestPerPlayer: Record<string, any>
) {
  const lowerBetter = challenge.shootingLowerIsBetter
  const byUser: Record<string, any[]> = {}
  for (const sh of shots) (byUser[sh.userId] ??= []).push(sh)
  for (const userShots of Object.values(byUser)) {
    if (userShots.length === 0) continue
    const val = playerAttemptTotal(userShots.map((s: any) => s.value), !!challenge.sumAllAttempts, challenge.minShotsPerPlayer, lowerBetter)
    const ref = userShots[0]
    const existing = bestPerPlayer[ref.userId]
    if (!existing || (lowerBetter ? val < existing.score : val > existing.score)) {
      bestPerPlayer[ref.userId] = {
        userId: ref.player.id, displayName: ref.player.displayName,
        username: ref.player.username, profileImageUrl: ref.player.profileImageUrl,
        score: val, competitionName: ref.competition.name,
        competitionDate: ref.competition.date?.toISOString() ?? null,
      }
    }
  }
}

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get('/competition/:id', { preHandler: optionalAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const competition = await prisma.competition.findUnique({
      where: { id },
      include: competitionLeaderboardInclude,
    })
    if (!competition) return reply.status(404).send({ error: 'Competition not found' })

    // Group access check
    try {
      await request.jwtVerify()
      const me = request.user as { id: string; role: string }
      if (me.role !== 'ADMIN' && competition.groupId) {
        const groupIds = await getUserGroupIds(me.id)
        if (!groupIds.includes(competition.groupId)) return reply.status(403).send({ error: 'Access denied' })
      }
    } catch {
      if (competition.status !== 'ACTIVE') return reply.status(403).send({ error: 'Access denied' })
    }

    const { teamLeaderboard, individualLeaderboard, challengeLeaderboards } = computeCompetitionLeaderboard(competition)

    return {
      competition: { id: competition.id, name: competition.name, scoringMode: competition.scoringMode, tieBreakingMode: competition.tieBreakingMode, isTeamCompetition: competition.isTeamCompetition, status: competition.status },
      teamLeaderboard,
      individualLeaderboard,
      challengeLeaderboards,
    }
  })

  app.get('/challenges/all-time', { preHandler: optionalAuth }, async (request) => {
    const { groupId } = request.query as { groupId?: string }
    let groupFilter: string[] | null = null
    try {
      await request.jwtVerify()
      const me = request.user as { id: string }
      const userGroupIds = await getUserGroupIds(me.id)
      groupFilter = groupId ? [groupId] : userGroupIds
    } catch { /* guest: no filter */ }

    const playerInclude = {
      include: {
        player: { select: { id: true, username: true, displayName: true, profileImageUrl: true } },
        competition: { select: { id: true, name: true, date: true } },
      },
    } as const

    const challenges = await prisma.challenge.findMany({
      where: {
        isQuiz: { not: true },
        competitionChallenges: { some: { OR: [{ scores: { some: {} } }, { shots: { some: {} } }] } },
      },
      include: {
        competitionChallenges: {
          where: groupFilter ? { competition: { groupId: { in: groupFilter } } } : undefined,
          include: { scores: playerInclude, shots: playerInclude },
        },
      },
      orderBy: { name: 'asc' },
    })

    const result = challenges.map(challenge => {
      const baseScoreType = challenge.scoreType as ScoreType
      const isShooting = baseScoreType === 'shooting'
      const lowerBetter = isShooting ? challenge.shootingLowerIsBetter : isLowerBetter(baseScoreType)
      const bestPerPlayer: Record<string, any> = {}

      for (const cc of challenge.competitionChallenges) {
        if (isShooting) {
          foldShootingShots(cc.shots, challenge, bestPerPlayer)
          continue
        }
        const effectiveSt = (cc.scoreTypeOverride ?? challenge.scoreType) as ScoreType
        for (const s of cc.scores) {
          const val = getScoreValue(s, effectiveSt)
          if (val === null) continue
          const existing = bestPerPlayer[s.userId]
          if (!existing || (lowerBetter ? val < existing.score : val > existing.score)) {
            bestPerPlayer[s.userId] = {
              userId: s.player.id, displayName: s.player.displayName,
              username: s.player.username, profileImageUrl: s.player.profileImageUrl,
              score: val, competitionName: s.competition.name,
              competitionDate: s.competition.date?.toISOString() ?? null,
            }
          }
        }
      }

      const topScores = tiedRanks(
        Object.values(bestPerPlayer).sort((a: any, b: any) => lowerBetter ? a.score - b.score : b.score - a.score).slice(0, 3),
        (s: any) => s.score
      )
      return { challengeId: challenge.id, challengeName: challenge.name, challengeLogoUrl: challenge.logoUrl ?? null, scoreType: baseScoreType, lowerIsBetter: lowerBetter, topScores }
    }).filter(c => c.topScores.length > 0)

    return { challenges: result }
  })

  app.get('/historical', { preHandler: optionalAuth }, async (request) => {
    const { groupId } = request.query as { groupId?: string }
    let groupFilter: string[] | null = null
    try {
      await request.jwtVerify()
      const me = request.user as { id: string }
      const userGroupIds = await getUserGroupIds(me.id)
      groupFilter = groupId ? [groupId] : userGroupIds
    } catch { /* guest: no filter */ }

    const competitions = await prisma.competition.findMany({
      where: {
        status: 'COMPLETED',
        ...(groupFilter ? { groupId: { in: groupFilter } } : {}),
      },
      include: { teams: true },
      orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }],
    })
    return { competitions }
  })

  app.get('/challenge/:challengeId/all-time', { preHandler: optionalAuth }, async (request, reply) => {
    const { challengeId } = request.params as { challengeId: string }
    const { groupId } = request.query as { groupId?: string }
    let groupFilter: string[] | null = null
    try {
      await request.jwtVerify()
      const me = request.user as { id: string }
      const userGroupIds = await getUserGroupIds(me.id)
      groupFilter = groupId ? [groupId] : userGroupIds
    } catch { /* guest: no filter */ }

    const playerInclude = {
      include: {
        player: { select: { id: true, username: true, displayName: true, profileImageUrl: true } },
        competition: { select: { id: true, name: true, date: true } },
      },
    } as const

    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        competitionChallenges: {
          where: groupFilter ? { competition: { groupId: { in: groupFilter } } } : undefined,
          include: { scores: playerInclude, shots: playerInclude },
        },
      },
    })
    if (!challenge) return reply.status(404).send({ error: 'Challenge not found' })

    const baseScoreType = challenge.scoreType as ScoreType
    const isShooting = baseScoreType === 'shooting'
    const lowerBetter = isShooting ? challenge.shootingLowerIsBetter : isLowerBetter(baseScoreType)
    const bestPerPlayer: Record<string, any> = {}

    for (const cc of challenge.competitionChallenges) {
      if (isShooting) {
        foldShootingShots(cc.shots, challenge, bestPerPlayer)
        continue
      }
      const effectiveSt = (cc.scoreTypeOverride ?? challenge.scoreType) as ScoreType
      for (const s of cc.scores) {
        const val = getScoreValue(s, effectiveSt)
        if (val === null) continue
        const existing = bestPerPlayer[s.userId]
        if (!existing || (lowerBetter ? val < existing.score : val > existing.score)) {
          bestPerPlayer[s.userId] = {
            userId: s.player.id, displayName: s.player.displayName,
            username: s.player.username, profileImageUrl: s.player.profileImageUrl,
            score: val, competitionName: s.competition.name,
            competitionDate: s.competition.date?.toISOString() ?? null,
          }
        }
      }
    }

    const allScores = tiedRanks(
      Object.values(bestPerPlayer).sort((a: any, b: any) => lowerBetter ? a.score - b.score : b.score - a.score),
      (s: any) => s.score
    )

    return {
      challenge: { id: challenge.id, name: challenge.name, logoUrl: challenge.logoUrl ?? null, scoreType: baseScoreType, lowerIsBetter: lowerBetter },
      allScores,
    }
  })
}
