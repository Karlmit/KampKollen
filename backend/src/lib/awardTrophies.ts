import { ScoreType, TeamScoreMode } from '@prisma/client'
import { prisma } from '../db.js'
import { generateImage } from './imageGeneration.js'
import { computeCalculatedPoints, computeTeamScore, isLowerBetter } from './scoring.js'
import { getTrophyWords, randomFrom, wordToTitle } from './trophyWords.js'

let generatingCount = 0
export function getGeneratingCount() { return generatingCount }

async function generateOneTrophy(): Promise<void> {
  generatingCount++
  try {
    const words = await getTrophyWords()
    const { title, titleSv } = wordToTitle(randomFrom(words))
    const prompt = `A flat 2D cartoon illustration of "${title}". Pure white background, exactly #ffffff, no off-white or cream. Object centered, bold outlines, bright colors. No text, no shadows, no gradients.`
    const result = await generateImage({ prompt }, 'trophies')
    await prisma.trophy.create({
      data: { title, titleSv, imageUrl: result.publicUrl },
    })
  } finally {
    generatingCount--
  }
}

async function ensureTrophiesInStorage(count: number): Promise<void> {
  const existing = await prisma.trophy.count({ where: { userId: null } })
  const toGenerate = Math.max(0, count - existing)
  if (toGenerate === 0) return

  const BATCH_SIZE = 3
  for (let i = 0; i < toGenerate; i += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, toGenerate - i)
    await Promise.all(Array.from({ length: batchCount }, () => generateOneTrophy()))
  }
}

// Generate `count` brand-new random awards into storage (admin bulk action).
export async function generateRandomTrophies(count: number): Promise<void> {
  const n = Math.max(0, Math.floor(count))
  if (n === 0) return

  const BATCH_SIZE = 3
  for (let i = 0; i < n; i += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, n - i)
    await Promise.all(Array.from({ length: batchCount }, () => generateOneTrophy()))
  }
}

export interface CompetitionNeeds {
  id: string
  name: string
  challengeCount: number
  maxTeamSize: number
  needed: number
  reservedCount: number
}

export async function getActiveCompetitionNeeds(): Promise<CompetitionNeeds[]> {
  const competitions = await prisma.competition.findMany({
    where: { status: 'ACTIVE' },
    include: {
      teams: {
        include: { players: { include: { user: { select: { isDummy: true } } } } },
      },
      challenges: { select: { id: true } },
      reservedTrophies: { where: { userId: null }, select: { id: true } },
    },
  })
  return competitions.map(c => {
    const maxTeamSize = c.teams.reduce((max, t) =>
      Math.max(max, t.players.filter(p => !p.user.isDummy).length), 0)
    const challengeCount = c.challenges.length
    // Team comps award the winning team's members AND the individual-leaderboard
    // top 3; individual comps award the top 3 players.
    const winnerCount = c.isTeamCompetition ? maxTeamSize + 3 : 3
    return {
      id: c.id,
      name: c.name,
      challengeCount,
      maxTeamSize: winnerCount,
      needed: winnerCount + challengeCount,
      reservedCount: c.reservedTrophies.length,
    }
  })
}

export async function ensureForCompetition(competitionId: string): Promise<void> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      teams: {
        include: { players: { include: { user: { select: { isDummy: true } } } } },
      },
      challenges: { select: { id: true } },
    },
  })
  if (!competition) return

  const maxTeamSize = competition.teams.reduce((max, t) =>
    Math.max(max, t.players.filter(p => !p.user.isDummy).length), 0)
  const winnerCount = competition.isTeamCompetition ? maxTeamSize + 3 : 3
  const needed = winnerCount + competition.challenges.length

  // Count trophies available for this competition (reserved for it + unreserved)
  const [reservedForThis, unreserved] = await Promise.all([
    prisma.trophy.count({ where: { userId: null, reservedForCompetitionId: competitionId } }),
    prisma.trophy.count({ where: { userId: null, reservedForCompetitionId: null } }),
  ])
  const toGenerate = Math.max(0, needed - reservedForThis - unreserved)
  if (toGenerate === 0) return

  const BATCH_SIZE = 3
  for (let i = 0; i < toGenerate; i += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, toGenerate - i)
    await Promise.all(Array.from({ length: batchCount }, () => generateOneTrophy()))
  }
}

interface AwardRecipient {
  userId: string
  // English fallback sentence (kept for non-UI consumers / older clients).
  subtitle: string
  // i18n key within the `trophySubtitle` namespace + its interpolation params,
  // so the frontend can render the subtitle in the active language.
  subtitleKey: string
  subtitleParams: Record<string, string | number>
}

async function computeWinners(competitionId: string): Promise<AwardRecipient[]> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      teams: true,
      players: {
        include: { user: { select: { id: true, isDummy: true } } },
      },
      challenges: {
        include: { challenge: true, scores: true },
        orderBy: { order: 'asc' },
      },
    },
  })
  if (!competition || competition.players.length === 0) return []

  const numTeams = competition.teams.length
  const numPlayers = competition.players.length
  const teamPoints: Record<string, number> = {}
  for (const team of competition.teams) teamPoints[team.id] = 0
  const playerTotalPoints: Record<string, number> = {}
  for (const cp of competition.players) playerTotalPoints[cp.userId] = 0

  const challengeTopScorers: AwardRecipient[] = []
  // Every member of the winning team of each quiz challenge (team comps only).
  const quizTeamWinners: AwardRecipient[] = []

  for (const cc of competition.challenges) {
    if (cc.scores.length === 0) continue

    const scoreType: ScoreType = (cc.scoreTypeOverride ?? cc.challenge.scoreType) as ScoreType
    const teamScoreMode: TeamScoreMode = (cc.teamScoreModeOverride ?? cc.challenge.defaultTeamScoreMode) as TeamScoreMode
    const bestN = cc.bestNPlayersOverride ?? cc.challenge.bestNPlayers
    const lowerBetter = isLowerBetter(scoreType)

    const allScoreInputs = cc.scores.map(s => ({
      userId: s.userId, rawScore: s.rawScore, timeMs: s.timeMs,
      placement: s.placement, calculatedPoints: s.calculatedPoints, teamId: null,
    }))

    const playerChallengePoints: Record<string, number> = {}
    for (const s of cc.scores) {
      playerChallengePoints[s.userId] = computeCalculatedPoints(
        { userId: s.userId, rawScore: s.rawScore, timeMs: s.timeMs, placement: s.placement, calculatedPoints: s.calculatedPoints, teamId: null },
        allScoreInputs,
        scoreType
      )
    }

    // Top scorer (non-dummy) per challenge
    const sortedPlayers = Object.entries(playerChallengePoints)
      .filter(([userId]) => {
        const cp = competition.players.find(p => p.userId === userId)
        return cp && !cp.user.isDummy
      })
      .sort(([, a], [, b]) => lowerBetter ? a - b : b - a)

    if (sortedPlayers.length > 0) {
      challengeTopScorers.push({
        userId: sortedPlayers[0][0],
        subtitle: `Awarded for having the **top score** in **${cc.challenge.name}** in **${competition.name}**`,
        subtitleKey: 'topScore',
        subtitleParams: { challenge: cc.challenge.name, competition: competition.name },
      })
    }

    // Accumulate individual totals (mirrors leaderboard logic)
    if (competition.scoringMode === 'placement_points') {
      const rankedForPoints = [...sortedPlayers].sort(([, a], [, b]) => lowerBetter ? a - b : b - a)
      rankedForPoints.forEach(([userId, score], i) => {
        if (score === 0) return
        if (playerTotalPoints[userId] !== undefined)
          playerTotalPoints[userId] += (numPlayers - i) * 10
      })
    } else {
      for (const [userId, pts] of Object.entries(playerChallengePoints)) {
        if (playerTotalPoints[userId] !== undefined)
          playerTotalPoints[userId] += pts
      }
    }

    // Compute team scores for this challenge
    const teamPlayerPoints: Record<string, number[]> = {}
    for (const cp of competition.players) {
      if (!cp.teamId) continue
      if (!teamPlayerPoints[cp.teamId]) teamPlayerPoints[cp.teamId] = []
      if (playerChallengePoints[cp.userId] !== undefined) {
        teamPlayerPoints[cp.teamId].push(playerChallengePoints[cp.userId])
      }
    }

    const teamChallengeScores = competition.teams
      .filter(() => teamScoreMode !== 'manual_team_score')
      .map(t => ({
        teamId: t.id,
        score: computeTeamScore(teamPlayerPoints[t.id] ?? [], teamScoreMode, bestN),
      }))

    // Quiz challenges additionally award every member of the quiz's winning team.
    if (cc.challenge.isQuiz && competition.isTeamCompetition && teamChallengeScores.length > 0) {
      const topTeam = [...teamChallengeScores].sort((a, b) => lowerBetter ? a.score - b.score : b.score - a.score)[0]
      if (topTeam && topTeam.score > 0) {
        const team = competition.teams.find(t => t.id === topTeam.teamId)
        const members = competition.players.filter(p => p.teamId === topTeam.teamId && !p.user.isDummy)
        for (const member of members) {
          quizTeamWinners.push({
            userId: member.userId,
            subtitle: `Awarded for being in the **winning team** **${team?.name ?? ''}** of the quiz **${cc.challenge.name}**`,
            subtitleKey: 'quizWinningTeam',
            subtitleParams: { team: team?.name ?? '', quiz: cc.challenge.name },
          })
        }
      }
    }

    if (competition.scoringMode === 'placement_points') {
      const ranked = [...teamChallengeScores].sort((a, b) => lowerBetter ? a.score - b.score : b.score - a.score)
      ranked.forEach(({ teamId, score }, i) => {
        if (score === 0) return
        const maxPts = competition.placementMaxPoints ?? numTeams * 10
        teamPoints[teamId] = (teamPoints[teamId] ?? 0) + Math.max(0, maxPts - i * 10)
      })
    } else {
      for (const { teamId, score } of teamChallengeScores) {
        teamPoints[teamId] = (teamPoints[teamId] ?? 0) + score
      }
    }
  }

  const recipients: AwardRecipient[] = []

  // Top 3 individual players by total points (non-dummy, points > 0).
  const top3Individuals = Object.entries(playerTotalPoints)
    .filter(([userId]) => {
      const cp = competition.players.find(p => p.userId === userId)
      return cp && !cp.user.isDummy
    })
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

  const medals = ['🥇', '🥈', '🥉']

  if (!competition.isTeamCompetition) {
    // Individual competition: the overall top 3 placement.
    const posLabels = ['🥇 **1st place**', '🥈 **2nd place**', '🥉 **3rd place**']
    const placementKeys = ['placement1', 'placement2', 'placement3']
    for (const [i, [userId, points]] of top3Individuals.entries()) {
      if (points === 0) continue
      recipients.push({
        userId,
        subtitle: `${posLabels[i]} in **${competition.name}**`,
        subtitleKey: placementKeys[i],
        subtitleParams: { competition: competition.name },
      })
    }
  } else {
    // Team competition: winning team members (non-dummy)...
    const sortedTeams = competition.teams
      .map(t => ({ id: t.id, name: t.name, points: teamPoints[t.id] ?? 0 }))
      .sort((a, b) => b.points - a.points)

    if (sortedTeams.length > 0 && sortedTeams[0].points > 0) {
      const winningTeam = sortedTeams[0]
      const members = competition.players.filter(p => p.teamId === winningTeam.id && !p.user.isDummy)
      for (const member of members) {
        recipients.push({
          userId: member.userId,
          subtitle: `Awarded for being in the **winning team** **${winningTeam.name}** in **${competition.name}**`,
          subtitleKey: 'winningTeam',
          subtitleParams: { team: winningTeam.name, competition: competition.name },
        })
      }
    }

    // ...plus the top 3 of the individual leaderboard.
    const individualKeys = ['individualLeaderboard1', 'individualLeaderboard2', 'individualLeaderboard3']
    for (const [i, [userId, points]] of top3Individuals.entries()) {
      if (points === 0) continue
      recipients.push({
        userId,
        subtitle: `${medals[i]} Awarded for being **top ${i + 1}** in the **individual leaderboard** during **${competition.name}**`,
        subtitleKey: individualKeys[i],
        subtitleParams: { competition: competition.name },
      })
    }
  }

  recipients.push(...challengeTopScorers)
  recipients.push(...quizTeamWinners)
  return recipients
}

export async function preGenerateTrophies(competitionId: string): Promise<void> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      players: { include: { user: { select: { isDummy: true } } } },
      challenges: { select: { id: true } },
    },
  })
  if (!competition) return

  const nonDummyPlayers = competition.players.filter(p => !p.user.isDummy).length
  const target = Math.min(nonDummyPlayers + competition.challenges.length + 5, 30)
  await ensureTrophiesInStorage(target)
}

export async function awardCompetitionTrophies(competitionId: string): Promise<void> {
  const recipients = await computeWinners(competitionId)
  if (recipients.length === 0) return

  // Fetch competition's group so we can stamp trophies
  const comp = await prisma.competition.findUnique({ where: { id: competitionId }, select: { groupId: true } })
  const trophyGroupId = comp?.groupId ?? null

  // Make sure there is at least one award per recipient available for this
  // competition (reserved-for-it + unreserved). Generate fresh random awards
  // to cover any shortfall. Generation failures are tolerated so we still
  // hand out whatever we managed to prepare.
  const countAvailable = () => prisma.trophy.count({
    where: { userId: null, OR: [{ reservedForCompetitionId: competitionId }, { reservedForCompetitionId: null }] },
  })
  const deficit = recipients.length - await countAvailable()
  if (deficit > 0) {
    const BATCH_SIZE = 3
    for (let i = 0; i < deficit; i += BATCH_SIZE) {
      const batchCount = Math.min(BATCH_SIZE, deficit - i)
      try {
        await Promise.all(Array.from({ length: batchCount }, () => generateOneTrophy()))
      } catch (err) {
        console.error('[awards] trophy generation failed during awarding:', err)
      }
    }
  }

  // Prefer trophies reserved for this competition, then fall back to unreserved
  const [reserved, unreserved] = await Promise.all([
    prisma.trophy.findMany({
      where: { userId: null, reservedForCompetitionId: competitionId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
    prisma.trophy.findMany({
      where: { userId: null, reservedForCompetitionId: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
  ])

  const trophyIds = [...reserved.map(t => t.id), ...unreserved.map(t => t.id)]
    .slice(0, recipients.length)

  if (trophyIds.length < recipients.length) {
    console.error(`[awards] Not enough trophies after generation: need ${recipients.length}, have ${trophyIds.length}`)
  }

  const now = new Date()
  await Promise.all(
    recipients.slice(0, trophyIds.length).map((recipient, i) =>
      prisma.trophy.update({
        where: { id: trophyIds[i] },
        data: {
          userId: recipient.userId,
          subtitle: recipient.subtitle,
          subtitleKey: recipient.subtitleKey,
          subtitleParams: recipient.subtitleParams,
          sentAt: now,
          isOpened: false,
          reservedForCompetitionId: null,
          ...(trophyGroupId ? { groupId: trophyGroupId } : {}),
        },
      })
    )
  )
}
