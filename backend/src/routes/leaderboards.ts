import { FastifyInstance } from 'fastify'
import { ScoreType, TeamScoreMode, TieBreakingMode } from '@prisma/client'
import { prisma } from '../db.js'
import { optionalAuth } from '../middleware/auth.js'
import { computeCalculatedPoints, computeTeamScore, isLowerBetter, bestNSum, computeShootingCounted } from '../lib/scoring.js'

async function getUserGroupIds(userId: string): Promise<string[]> {
  const memberships = await prisma.userGroup.findMany({ where: { userId }, select: { groupId: true } })
  return memberships.map(m => m.groupId)
}

function getScoreValue(score: any, st: ScoreType): number | null {
  if (st === 'time_fastest_wins') return score.timeMs ?? null
  if (st === 'placement_lowest_wins') return score.placement ?? null
  if (st === 'manual_points') return score.calculatedPoints ?? null
  return score.rawScore ?? null
}

// All-time aggregation for shooting challenges: fold each player's shooting
// score (the sum of their best `minShotsPerPlayer` shots) per competition into
// bestPerPlayer.
function foldShootingShots(
  shots: any[],
  challenge: { shootingLowerIsBetter: boolean; minShotsPerPlayer: number },
  bestPerPlayer: Record<string, any>
) {
  const lowerBetter = challenge.shootingLowerIsBetter
  const byUser: Record<string, any[]> = {}
  for (const sh of shots) (byUser[sh.userId] ??= []).push(sh)
  for (const userShots of Object.values(byUser)) {
    if (userShots.length === 0) continue
    const val = bestNSum(userShots.map((s: any) => s.value), challenge.minShotsPerPlayer, lowerBetter)
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

// Standard competition ranking (1,1,3): items must already be sorted best-first.
function tiedRanks<T>(sorted: T[], getScore: (item: T) => number): (T & { rank: number })[] {
  let rank = 1
  return sorted.map((item, i) => {
    if (i > 0 && getScore(item) !== getScore(sorted[i - 1])) rank = i + 1
    return { ...item, rank }
  })
}

// Points for one entry given its tied rank and tie group size.
function calcPlacementPts(rank: number, maxPts: number, tieSize: number, mode: TieBreakingMode): number {
  const step = 10
  if (mode === TieBreakingMode.best_rank) return Math.max(0, maxPts - (rank - 1) * step)
  if (mode === TieBreakingMode.worst_rank) return Math.max(0, maxPts - (rank + tieSize - 2) * step)
  // average: mean of all tied positions' points
  let total = 0
  for (let k = 0; k < tieSize; k++) total += Math.max(0, maxPts - (rank - 1 + k) * step)
  return total / tieSize
}

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get('/competition/:id', { preHandler: optionalAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const competition = await prisma.competition.findUnique({
      where: { id },
      include: {
        teams: true,
        players: {
          include: { user: { select: { id: true, username: true, displayName: true, profileImageUrl: true } } },
        },
        challenges: {
          include: { challenge: true, scores: true, shots: true },
          orderBy: { order: 'asc' },
        },
      },
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

    const numTeams = competition.teams.length

    // In team competitions, only players assigned to a team are real participants.
    // Unassigned (player-pool) players are excluded from the individual leaderboard
    // and from every per-challenge score calculation.
    const isTeamComp = competition.isTeamCompetition !== false
    const individualPlayerIds = new Set(
      competition.players.filter(p => !isTeamComp || p.teamId).map(p => p.userId)
    )
    const numIndividualPlayers = individualPlayerIds.size

    const playerMaxPts = (!competition.isTeamCompetition && competition.placementMaxPoints)
      ? competition.placementMaxPoints
      : numIndividualPlayers * 10

    // Mutable totals
    const teamPoints: Record<string, { totalPoints: number; challengeBreakdown: Record<string, number> }> = {}
    for (const team of competition.teams) {
      teamPoints[team.id] = { totalPoints: 0, challengeBreakdown: {} }
    }
    const playerPoints: Record<string, number> = {}
    for (const p of competition.players) {
      if (individualPlayerIds.has(p.userId)) playerPoints[p.userId] = 0
    }

    const challengeLeaderboards: any[] = []

    for (const cc of competition.challenges) {
      const scoreType: ScoreType = (cc.scoreTypeOverride ?? cc.challenge.scoreType) as ScoreType
      const teamScoreMode: TeamScoreMode = (cc.teamScoreModeOverride ?? cc.challenge.defaultTeamScoreMode) as TeamScoreMode
      const bestN = cc.bestNPlayersOverride ?? cc.challenge.bestNPlayers
      const isShooting = scoreType === 'shooting'
      const lowerBetter = isShooting ? cc.challenge.shootingLowerIsBetter : isLowerBetter(scoreType)

      // Shooting challenges keep multiple shots per player (cc.shots) rather than a
      // single Score row; only count shots from assigned players.
      const shootingShots = isShooting
        ? cc.shots.filter(s => individualPlayerIds.has(s.userId))
        : []

      // Drop unassigned players' scores entirely, so they neither rank nor shift
      // anyone else's points (relevant for relative score types like ranked_points).
      const scores = cc.scores.filter(s => individualPlayerIds.has(s.userId))

      const allScoreInputs = scores.map(s => ({
        userId: s.userId, rawScore: s.rawScore, timeMs: s.timeMs,
        placement: s.placement, calculatedPoints: s.calculatedPoints, teamId: null,
      }))

      // Compute raw calculated points per player for this challenge
      const playerChallengePoints: Record<string, number> = {}
      if (isShooting) {
        // Individual score = sum of a player's best `minShotsPerPlayer` shots,
        // so a player who took extra shots doesn't out-rank everyone else.
        const shotsByUser: Record<string, number[]> = {}
        for (const s of shootingShots) (shotsByUser[s.userId] ??= []).push(s.value)
        for (const [userId, values] of Object.entries(shotsByUser)) {
          playerChallengePoints[userId] = bestNSum(values, cc.challenge.minShotsPerPlayer, lowerBetter)
        }
      } else {
        for (const s of scores) {
          playerChallengePoints[s.userId] = computeCalculatedPoints(
            { userId: s.userId, rawScore: s.rawScore, timeMs: s.timeMs, placement: s.placement, calculatedPoints: s.calculatedPoints, teamId: null },
            allScoreInputs,
            scoreType
          )
        }
      }

      // In team competitions, quiz results count only toward team scores —
      // never toward individual totals (quizzes still appear under the team view).
      const countForIndividual = !(cc.challenge.isQuiz && competition.isTeamCompetition !== false)

      // Accumulate individual totals
      if (countForIndividual) {
        if (competition.scoringMode === 'placement_points') {
          const tbm = competition.tieBreakingMode
          const sortedPlayers = Object.entries(playerChallengePoints)
            .sort(([, a], [, b]) => lowerBetter ? a - b : b - a)
            .map(([userId, score]) => ({ userId, score }))
          if (tbm) {
            const withRanks = tiedRanks(sortedPlayers, e => e.score)
            const rankSizes: Record<number, number> = {}
            for (const item of withRanks) rankSizes[item.rank] = (rankSizes[item.rank] ?? 0) + 1
            for (const item of withRanks) {
              if (item.score === 0) continue
              if (playerPoints[item.userId] !== undefined)
                playerPoints[item.userId] += calcPlacementPts(item.rank, playerMaxPts, rankSizes[item.rank], tbm)
            }
          } else {
            sortedPlayers.forEach(({ userId, score }, i) => {
              if (score === 0) return
              if (playerPoints[userId] !== undefined)
                playerPoints[userId] += (numIndividualPlayers - i) * 10
            })
          }
        } else {
          for (const [userId, pts] of Object.entries(playerChallengePoints)) {
            if (playerPoints[userId] !== undefined) {
              playerPoints[userId] += pts
            }
          }
        }
      }

      // Group players by team for team scoring
      const teamPlayerPoints: Record<string, number[]> = {}
      for (const cp of competition.players) {
        if (!cp.teamId) continue
        if (!teamPlayerPoints[cp.teamId]) teamPlayerPoints[cp.teamId] = []
        if (playerChallengePoints[cp.userId] !== undefined) {
          teamPlayerPoints[cp.teamId].push(playerChallengePoints[cp.userId])
        }
      }

      // Shooting: team score is the sum of the team's best `shotsPerTeam` shots
      // (each player's minimum guaranteed), bypassing the TeamScoreMode selector.
      const teamShots: Record<string, typeof shootingShots> = {}
      if (isShooting) {
        const teamByUser = new Map(competition.players.map(p => [p.userId, p.teamId ?? null]))
        for (const s of shootingShots) {
          const teamId = teamByUser.get(s.userId)
          if (!teamId) continue
          ;(teamShots[teamId] ??= []).push(s)
        }
      }

      // Calculate and rank team scores for this challenge
      const teamChallengeScores: Array<{ teamId: string; teamName: string; score: number }> = []
      for (const team of competition.teams) {
        if (isShooting) {
          const res = computeShootingCounted(
            (teamShots[team.id] ?? []).map(s => ({ id: s.id, userId: s.userId, value: s.value })),
            cc.challenge.shotsPerTeam, cc.challenge.minShotsPerPlayer, lowerBetter
          )
          teamChallengeScores.push({ teamId: team.id, teamName: team.name, score: res.teamTotal })
          continue
        }
        if (teamScoreMode === 'manual_team_score') continue
        const playerPts = teamPlayerPoints[team.id] ?? []
        teamChallengeScores.push({ teamId: team.id, teamName: team.name, score: computeTeamScore(playerPts, teamScoreMode, bestN) })
      }
      const rankedTeams = [...teamChallengeScores].sort((a, b) => lowerBetter ? a.score - b.score : b.score - a.score)

      // Accumulate team totals
      if (competition.scoringMode === 'placement_points') {
        const tbm = competition.tieBreakingMode
        const maxPts = competition.placementMaxPoints ?? numTeams * 10
        if (tbm) {
          const withRanks = tiedRanks(rankedTeams, t => t.score)
          const rankSizes: Record<number, number> = {}
          for (const item of withRanks) rankSizes[item.rank] = (rankSizes[item.rank] ?? 0) + 1
          for (const item of withRanks) {
            if (item.score === 0) continue
            if (teamPoints[item.teamId]) {
              const pts = calcPlacementPts(item.rank, maxPts, rankSizes[item.rank], tbm)
              teamPoints[item.teamId].challengeBreakdown[cc.id] = pts
              teamPoints[item.teamId].totalPoints += pts
            }
          }
        } else {
          rankedTeams.forEach((t, i) => {
            if (t.score === 0) return
            const pts = Math.max(0, maxPts - i * 10)
            if (teamPoints[t.teamId]) {
              teamPoints[t.teamId].challengeBreakdown[cc.id] = pts
              teamPoints[t.teamId].totalPoints += pts
            }
          })
        }
      } else {
        for (const ts of teamChallengeScores) {
          if (teamPoints[ts.teamId]) {
            teamPoints[ts.teamId].challengeBreakdown[cc.id] = ts.score
            teamPoints[ts.teamId].totalPoints += ts.score
          }
        }
      }

      // Build per-player challenge breakdown (ranked by score)
      const tbm = competition.tieBreakingMode
      const maxPtsTeam = competition.placementMaxPoints ?? numTeams * 10
      const sortedChallengePlayerEntries = Object.entries(playerChallengePoints)
        .sort(([, a], [, b]) => lowerBetter ? a - b : b - a)
        .map(([userId, score]) => ({ userId, score }))
      const challengePlayerRanked = tbm
        ? tiedRanks(sortedChallengePlayerEntries, e => e.score)
        : sortedChallengePlayerEntries.map((e, i) => ({ ...e, rank: i + 1 }))
      const cpRankSizes: Record<number, number> = {}
      for (const item of challengePlayerRanked) cpRankSizes[item.rank] = (cpRankSizes[item.rank] ?? 0) + 1

      const rankedChallengePlayers = challengePlayerRanked.map(({ userId, score, rank }) => {
        const cp = competition.players.find(p => p.userId === userId)
        const team = competition.teams.find(t => t.id === cp?.teamId)
        return {
          userId,
          displayName: cp?.user?.displayName ?? null,
          username: cp?.user?.username ?? null,
          profileImageUrl: cp?.user?.profileImageUrl ?? null,
          teamId: cp?.teamId ?? null,
          teamName: team?.name ?? null,
          score,
          rank,
          ...(competition.scoringMode === 'placement_points' && score > 0
            ? { placementPoints: tbm
                ? calcPlacementPts(rank, playerMaxPts, cpRankSizes[rank], tbm)
                : (numIndividualPlayers - (rank - 1)) * 10 }
            : {}),
        }
      })

      const rankedTeamsWithRanks = tbm
        ? tiedRanks(rankedTeams, t => t.score)
        : rankedTeams.map((t, i) => ({ ...t, rank: i + 1 }))
      const teamRankSizes: Record<number, number> = {}
      for (const item of rankedTeamsWithRanks) teamRankSizes[item.rank] = (teamRankSizes[item.rank] ?? 0) + 1

      challengeLeaderboards.push({
        challengeId: cc.challengeId,
        competitionChallengeId: cc.id,
        challengeName: cc.challenge.name,
        challengeLogoUrl: cc.challenge.logoUrl,
        isQuiz: cc.challenge.isQuiz,
        order: cc.order,
        scoreType,
        teamScoreMode,
        lowerIsBetter: lowerBetter,
        teams: rankedTeamsWithRanks.map(t => ({
          ...t,
          ...(competition.scoringMode === 'placement_points' && t.score > 0
            ? { placementPoints: tbm
                ? calcPlacementPts(t.rank, maxPtsTeam, teamRankSizes[t.rank], tbm)
                : Math.max(0, maxPtsTeam - (t.rank - 1) * 10) }
            : {}),
        })),
        players: rankedChallengePlayers,
      })
    }

    const overallTbm = competition.tieBreakingMode

    // Team leaderboard
    const sortedTeams = competition.teams
      .map(team => ({
        teamId: team.id,
        teamName: team.name,
        teamImageUrl: team.imageUrl,
        totalPoints: teamPoints[team.id]?.totalPoints ?? 0,
        challengeBreakdown: teamPoints[team.id]?.challengeBreakdown ?? {},
        playerCount: competition.players.filter(p => p.teamId === team.id).length,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
    const teamLeaderboard = overallTbm
      ? tiedRanks(sortedTeams, t => t.totalPoints)
      : sortedTeams.map((t, i) => ({ ...t, rank: i + 1 }))

    // Individual leaderboard — unassigned players are excluded in team competitions
    const sortedPlayers = competition.players
      .filter(cp => individualPlayerIds.has(cp.userId))
      .map(cp => {
        const team = competition.teams.find(t => t.id === cp.teamId)
        return {
          userId: cp.userId,
          displayName: cp.user?.displayName ?? null,
          username: cp.user?.username ?? null,
          profileImageUrl: cp.user?.profileImageUrl ?? null,
          teamId: cp.teamId,
          teamName: team?.name ?? null,
          totalPoints: playerPoints[cp.userId] ?? 0,
        }
      })
      .sort((a, b) => b.totalPoints - a.totalPoints)
    const individualLeaderboard = overallTbm
      ? tiedRanks(sortedPlayers, p => p.totalPoints)
      : sortedPlayers.map((p, i) => ({ ...p, rank: i + 1 }))

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
