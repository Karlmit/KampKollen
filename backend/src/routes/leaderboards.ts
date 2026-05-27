import { FastifyInstance } from 'fastify'
import { ScoreType, TeamScoreMode } from '@prisma/client'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { computeCalculatedPoints, computeTeamScore, isLowerBetter } from '../lib/scoring.js'

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get('/competition/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const competition = await prisma.competition.findUnique({
      where: { id },
      include: {
        teams: true,
        players: true,
        challenges: {
          include: { challenge: true, scores: true },
          orderBy: { order: 'asc' },
        },
      },
    })
    if (!competition) return reply.status(404).send({ error: 'Competition not found' })

    // Build team points map: teamId -> { totalPoints, challengeBreakdown }
    const teamPoints: Record<string, { totalPoints: number; challengeBreakdown: Record<string, number> }> = {}
    for (const team of competition.teams) {
      teamPoints[team.id] = { totalPoints: 0, challengeBreakdown: {} }
    }

    // Build individual points map: userId -> totalPoints
    const playerPoints: Record<string, number> = {}
    for (const p of competition.players) {
      playerPoints[p.userId] = 0
    }

    const challengeLeaderboards: any[] = []

    for (const cc of competition.challenges) {
      const scoreType: ScoreType = (cc.scoreTypeOverride ?? cc.challenge.scoreType) as ScoreType
      const teamScoreMode: TeamScoreMode = (cc.teamScoreModeOverride ?? cc.challenge.defaultTeamScoreMode) as TeamScoreMode
      const bestN = cc.bestNPlayersOverride ?? cc.challenge.bestNPlayers

      const allScoreInputs = cc.scores.map(s => ({
        userId: s.userId,
        rawScore: s.rawScore,
        timeMs: s.timeMs,
        placement: s.placement,
        calculatedPoints: s.calculatedPoints,
        teamId: null,
      }))

      // Calculate points per player for this challenge
      const playerChallengePoints: Record<string, number> = {}
      for (const s of cc.scores) {
        const pts = computeCalculatedPoints(
          { userId: s.userId, rawScore: s.rawScore, timeMs: s.timeMs, placement: s.placement, calculatedPoints: s.calculatedPoints, teamId: null },
          allScoreInputs,
          scoreType
        )
        playerChallengePoints[s.userId] = pts
        if (playerPoints[s.userId] !== undefined) {
          playerPoints[s.userId] += pts
        }
      }

      // Group players by CURRENT team assignment
      const teamPlayerPoints: Record<string, number[]> = {}
      for (const cp of competition.players) {
        if (!cp.teamId) continue
        if (!teamPlayerPoints[cp.teamId]) teamPlayerPoints[cp.teamId] = []
        const pts = playerChallengePoints[cp.userId] ?? 0
        if (playerChallengePoints[cp.userId] !== undefined) {
          teamPlayerPoints[cp.teamId].push(pts)
        }
      }

      // Calculate team scores for this challenge
      const teamChallengeScores: Array<{ teamId: string; teamName: string; score: number }> = []
      for (const team of competition.teams) {
        if (teamScoreMode === 'manual_team_score') continue
        const playerPts = teamPlayerPoints[team.id] ?? []
        const teamScore = computeTeamScore(playerPts, teamScoreMode, bestN)
        teamChallengeScores.push({ teamId: team.id, teamName: team.name, score: teamScore })
      }

      // Rank teams for this challenge
      const lowerBetter = isLowerBetter(scoreType)
      const rankedTeams = [...teamChallengeScores].sort((a, b) =>
        lowerBetter ? a.score - b.score : b.score - a.score
      )

      // Accumulate team totals based on competition scoring mode
      const numTeams = competition.teams.length
      if (competition.scoringMode === 'placement_points') {
        rankedTeams.forEach((t, i) => {
          const pts = (numTeams - i) * 10
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
          ...(competition.scoringMode === 'placement_points' && { placementPoints: (numTeams - i) * 10 }),
        })),
      })
    }

    // Build team leaderboard (sum of all challenge team scores)
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

    // Build individual leaderboard
    const individualLeaderboard = competition.players
      .map(cp => {
        const team = competition.teams.find(t => t.id === cp.teamId)
        return {
          userId: cp.userId,
          teamId: cp.teamId,
          teamName: team?.name ?? null,
          totalPoints: playerPoints[cp.userId] ?? 0,
        }
      })
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((p, i) => ({ ...p, rank: i + 1 }))

    return {
      competition: { id: competition.id, name: competition.name, scoringMode: competition.scoringMode },
      teamLeaderboard,
      individualLeaderboard,
      challengeLeaderboards,
    }
  })

  app.get('/historical', { preHandler: requireAuth }, async () => {
    const competitions = await prisma.competition.findMany({
      where: { status: 'COMPLETED' },
      include: { teams: true },
      orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }],
    })
    return { competitions }
  })

  app.get('/challenge/:challengeId/all-time', { preHandler: requireAuth }, async (request, reply) => {
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
