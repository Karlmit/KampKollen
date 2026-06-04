import { FastifyInstance } from 'fastify'
import { ScoreType, TeamScoreMode, TieBreakingMode } from '@prisma/client'
import { prisma } from '../db.js'
import { optionalAuth } from '../middleware/auth.js'
import { computeCalculatedPoints, computeTeamScore, isLowerBetter } from '../lib/scoring.js'

function getScoreValue(score: any, st: ScoreType): number | null {
  if (st === 'time_fastest_wins') return score.timeMs ?? null
  if (st === 'placement_lowest_wins') return score.placement ?? null
  if (st === 'manual_points') return score.calculatedPoints ?? null
  return score.rawScore ?? null
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
          include: { challenge: true, scores: true },
          orderBy: { order: 'asc' },
        },
      },
    })
    if (!competition) return reply.status(404).send({ error: 'Competition not found' })

    const numPlayers = competition.players.length
    const numTeams = competition.teams.length

    // Mutable totals
    const teamPoints: Record<string, { totalPoints: number; challengeBreakdown: Record<string, number> }> = {}
    for (const team of competition.teams) {
      teamPoints[team.id] = { totalPoints: 0, challengeBreakdown: {} }
    }
    const playerPoints: Record<string, number> = {}
    for (const p of competition.players) {
      playerPoints[p.userId] = 0
    }

    const challengeLeaderboards: any[] = []

    for (const cc of competition.challenges) {
      const scoreType: ScoreType = (cc.scoreTypeOverride ?? cc.challenge.scoreType) as ScoreType
      const teamScoreMode: TeamScoreMode = (cc.teamScoreModeOverride ?? cc.challenge.defaultTeamScoreMode) as TeamScoreMode
      const bestN = cc.bestNPlayersOverride ?? cc.challenge.bestNPlayers
      const lowerBetter = isLowerBetter(scoreType)

      const allScoreInputs = cc.scores.map(s => ({
        userId: s.userId, rawScore: s.rawScore, timeMs: s.timeMs,
        placement: s.placement, calculatedPoints: s.calculatedPoints, teamId: null,
      }))

      // Compute raw calculated points per player for this challenge
      const playerChallengePoints: Record<string, number> = {}
      for (const s of cc.scores) {
        playerChallengePoints[s.userId] = computeCalculatedPoints(
          { userId: s.userId, rawScore: s.rawScore, timeMs: s.timeMs, placement: s.placement, calculatedPoints: s.calculatedPoints, teamId: null },
          allScoreInputs,
          scoreType
        )
      }

      // Accumulate individual totals
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
              playerPoints[item.userId] += calcPlacementPts(item.rank, numPlayers * 10, rankSizes[item.rank], tbm)
          }
        } else {
          sortedPlayers.forEach(({ userId, score }, i) => {
            if (score === 0) return
            if (playerPoints[userId] !== undefined)
              playerPoints[userId] += (numPlayers - i) * 10
          })
        }
      } else {
        for (const [userId, pts] of Object.entries(playerChallengePoints)) {
          if (playerPoints[userId] !== undefined) {
            playerPoints[userId] += pts
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

      // Calculate and rank team scores for this challenge
      const teamChallengeScores: Array<{ teamId: string; teamName: string; score: number }> = []
      for (const team of competition.teams) {
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
                ? calcPlacementPts(rank, numPlayers * 10, cpRankSizes[rank], tbm)
                : (numPlayers - (rank - 1)) * 10 }
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

    // Individual leaderboard
    const sortedPlayers = competition.players
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
      competition: { id: competition.id, name: competition.name, scoringMode: competition.scoringMode, tieBreakingMode: competition.tieBreakingMode, status: competition.status },
      teamLeaderboard,
      individualLeaderboard,
      challengeLeaderboards,
    }
  })

  app.get('/challenges/all-time', { preHandler: optionalAuth }, async () => {
    const challenges = await prisma.challenge.findMany({
      where: { competitionChallenges: { some: { scores: { some: {} } } } },
      include: {
        competitionChallenges: {
          include: {
            scores: {
              include: {
                player: { select: { id: true, username: true, displayName: true, profileImageUrl: true } },
                competition: { select: { id: true, name: true, date: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const result = challenges.map(challenge => {
      const baseScoreType = challenge.scoreType as ScoreType
      const lowerBetter = isLowerBetter(baseScoreType)
      const bestPerPlayer: Record<string, any> = {}

      for (const cc of challenge.competitionChallenges) {
        const effectiveSt = (cc.scoreTypeOverride ?? challenge.scoreType) as ScoreType
        for (const s of cc.scores) {
          const val = getScoreValue(s, effectiveSt)
          if (val === null) continue
          const existing = bestPerPlayer[s.userId]
          if (!existing || (lowerBetter ? val < existing.score : val > existing.score)) {
            bestPerPlayer[s.userId] = {
              userId: s.player.id,
              displayName: s.player.displayName,
              username: s.player.username,
              profileImageUrl: s.player.profileImageUrl,
              score: val,
              competitionName: s.competition.name,
              competitionDate: s.competition.date?.toISOString() ?? null,
            }
          }
        }
      }

      const topScores = tiedRanks(
        Object.values(bestPerPlayer).sort((a: any, b: any) => lowerBetter ? a.score - b.score : b.score - a.score).slice(0, 3),
        (s: any) => s.score
      )

      return {
        challengeId: challenge.id,
        challengeName: challenge.name,
        challengeLogoUrl: challenge.logoUrl ?? null,
        scoreType: baseScoreType,
        lowerIsBetter: lowerBetter,
        topScores,
      }
    }).filter(c => c.topScores.length > 0)

    return { challenges: result }
  })

  app.get('/historical', { preHandler: optionalAuth }, async () => {
    const competitions = await prisma.competition.findMany({
      where: { status: 'COMPLETED' },
      include: { teams: true },
      orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }],
    })
    return { competitions }
  })

  app.get('/challenge/:challengeId/all-time', { preHandler: optionalAuth }, async (request, reply) => {
    const { challengeId } = request.params as { challengeId: string }

    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        competitionChallenges: {
          include: {
            scores: {
              include: {
                player: { select: { id: true, username: true, displayName: true, profileImageUrl: true } },
                competition: { select: { id: true, name: true, date: true } },
              },
            },
          },
        },
      },
    })
    if (!challenge) return reply.status(404).send({ error: 'Challenge not found' })

    const baseScoreType = challenge.scoreType as ScoreType
    const lowerBetter = isLowerBetter(baseScoreType)
    const bestPerPlayer: Record<string, any> = {}

    for (const cc of challenge.competitionChallenges) {
      const effectiveSt = (cc.scoreTypeOverride ?? challenge.scoreType) as ScoreType
      for (const s of cc.scores) {
        const val = getScoreValue(s, effectiveSt)
        if (val === null) continue
        const existing = bestPerPlayer[s.userId]
        if (!existing || (lowerBetter ? val < existing.score : val > existing.score)) {
          bestPerPlayer[s.userId] = {
            userId: s.player.id,
            displayName: s.player.displayName,
            username: s.player.username,
            profileImageUrl: s.player.profileImageUrl,
            score: val,
            competitionName: s.competition.name,
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
      challenge: {
        id: challenge.id,
        name: challenge.name,
        logoUrl: challenge.logoUrl ?? null,
        scoreType: baseScoreType,
        lowerIsBetter: lowerBetter,
      },
      allScores,
    }
  })
}
