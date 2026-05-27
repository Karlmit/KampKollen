import { FastifyInstance } from 'fastify'
import { ScoreType, TeamScoreMode } from '@prisma/client'
import { prisma } from '../db.js'
import { optionalAuth } from '../middleware/auth.js'
import { computeCalculatedPoints, computeTeamScore, isLowerBetter } from '../lib/scoring.js'

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
        // Rank all players who scored, award (numPlayers - rank) * 10
        const ranked = Object.entries(playerChallengePoints)
          .sort(([, a], [, b]) => lowerBetter ? a - b : b - a)
        ranked.forEach(([userId, score], i) => {
          if (score === 0) return
          if (playerPoints[userId] !== undefined) {
            playerPoints[userId] += (numPlayers - i) * 10
          }
        })
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
        rankedTeams.forEach((t, i) => {
          if (t.score === 0) return
          const maxPts = competition.placementMaxPoints ?? numTeams * 10
          const pts = Math.max(0, maxPts - i * 10)
          if (teamPoints[t.teamId]) {
            teamPoints[t.teamId].challengeBreakdown[cc.id] = pts
            teamPoints[t.teamId].totalPoints += pts
          }
        })
      } else {
        for (const ts of teamChallengeScores) {
          if (teamPoints[ts.teamId]) {
            teamPoints[ts.teamId].challengeBreakdown[cc.id] = ts.score
            teamPoints[ts.teamId].totalPoints += ts.score
          }
        }
      }

      // Build per-player challenge breakdown (ranked by score)
      const rankedChallengePlayers = Object.entries(playerChallengePoints)
        .sort(([, a], [, b]) => lowerBetter ? a - b : b - a)
        .map(([userId, score], i) => {
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
            rank: i + 1,
            ...(competition.scoringMode === 'placement_points' && score > 0
              ? { placementPoints: (numPlayers - i) * 10 }
              : {}),
          }
        })

      challengeLeaderboards.push({
        challengeId: cc.challengeId,
        competitionChallengeId: cc.id,
        challengeName: cc.challenge.name,
        challengeLogoUrl: cc.challenge.logoUrl,
        order: cc.order,
        scoreType,
        teamScoreMode,
        lowerIsBetter: lowerBetter,
        teams: rankedTeams.map((t, i) => ({
          ...t,
          rank: i + 1,
          ...(competition.scoringMode === 'placement_points' && t.score > 0
            ? { placementPoints: Math.max(0, (competition.placementMaxPoints ?? numTeams * 10) - i * 10) }
            : {}),
        })),
        players: rankedChallengePlayers,
      })
    }

    // Team leaderboard
    const teamLeaderboard = competition.teams
      .map(team => ({
        teamId: team.id,
        teamName: team.name,
        teamImageUrl: team.imageUrl,
        totalPoints: teamPoints[team.id]?.totalPoints ?? 0,
        challengeBreakdown: teamPoints[team.id]?.challengeBreakdown ?? {},
        playerCount: competition.players.filter(p => p.teamId === team.id).length,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((t, i) => ({ ...t, rank: i + 1 }))

    // Individual leaderboard
    const individualLeaderboard = competition.players
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
      .map((p, i) => ({ ...p, rank: i + 1 }))

    return {
      competition: { id: competition.id, name: competition.name, scoringMode: competition.scoringMode, status: competition.status },
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

    const getScoreValue = (score: any, st: ScoreType): number | null => {
      if (st === 'time_fastest_wins') return score.timeMs ?? null
      if (st === 'placement_lowest_wins') return score.placement ?? null
      if (st === 'manual_points') return score.calculatedPoints ?? null
      return score.rawScore ?? null
    }

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

      const topScores = Object.values(bestPerPlayer)
        .sort((a: any, b: any) => lowerBetter ? a.score - b.score : b.score - a.score)
        .slice(0, 5)
        .map((s: any, i: number) => ({ ...s, rank: i + 1 }))

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

    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Challenge not found' })

    const scores = await prisma.score.findMany({
      where: { competitionChallenge: { challengeId } },
      include: {
        player: { select: { id: true, username: true, displayName: true, profileImageUrl: true } },
        competition: true,
      },
      orderBy: { rawScore: 'desc' },
    })

    return { challenge, scores }
  })
}
