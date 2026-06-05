import { ScoreType, TeamScoreMode } from '@prisma/client'
import { prisma } from '../db.js'
import { generateImage } from './imageGeneration.js'
import { computeCalculatedPoints, computeTeamScore, isLowerBetter } from './scoring.js'

const DEFAULT_TROPHY_WORDS = [
  'Old rocking horse', 'Teddy bear with one missing eye', 'Pristine fountain pen',
  'Shiny red apple', 'Cracked porcelain duck', 'Golden banana', 'Tiny wizard hat',
  'Rusty bicycle bell', 'Suspicious pineapple', 'Fancy teaspoon', 'Broken alarm clock',
  'Very proud potato', 'Plastic crown', 'Rubber duck in sunglasses', 'Ancient office chair',
  'Glorious traffic cone', 'Half-melted candle', 'Tiny wooden stool', 'Fancy monocle',
  'Bent silver spoon', 'Emotional support cactus', 'Slightly haunted sandwich',
  'Golden toilet brush', 'Dusty trophy cup', 'Tiny garden gnome', 'Royal-looking cabbage',
  'Sock with a medal', 'Miniature pirate ship', 'Sad balloon', 'Heroic meatball',
  'Crystal doorknob', 'Wobbly chess knight', 'Suspicious egg', 'Majestic cheese wheel',
  'Lonely mitten', 'Fancy umbrella', 'Tiny dragon statue', 'Broken snow globe',
  'Glittery snail shell', 'Old TV remote', 'Ceremonial frying pan', 'Stuffed moose head',
  'Tiny treasure chest', 'Extremely normal rock', 'Banana peel on a pedestal',
  'Wooden spoon of destiny', 'Noble rubber boot', 'Golden stapler', 'Mysterious key',
  'Fancy teacup', 'Angry-looking lemon', 'Tiny accordion', 'Dusty violin',
  'Heroic garden shovel', 'Sparkly fishbowl', 'Old captain\'s hat', 'Royal egg cup',
  'Crooked picture frame', 'Tiny cannon', 'Very serious pumpkin', 'Broken compass',
  'Majestic toothbrush', 'Antique door knocker', 'Golden mushroom', 'Sleepy owl figurine',
  'Trophy-shaped sandwich', 'Fancy feather quill', 'Crowned frog statue', 'Tiny train engine',
  'Melancholy cupcake', 'Ancient calculator', 'Wooden duck on wheels', 'Plastic dinosaur',
  'Dramatic cape', 'Tiny lighthouse', 'Lucky horseshoe', 'Golden carrot',
  'Confused chicken statue', 'Silver waffle iron', 'Tiny bathtub', 'Worn-out boxing glove',
  'Fancy jam jar', 'Noble soup ladle', 'Crystal pineapple', 'Broken magic wand',
  'Tiny castle tower', 'Golden rolling pin', 'Mysterious blue bottle', 'Old leather boot',
  'Tiny scarecrow', 'Decorative fish', 'Bronze acorn', 'Fancy biscuit tin',
  'Tiny astronaut helmet', 'Royal lunchbox', 'Glittering onion', 'Old typewriter key',
  'Miniature windmill', 'Golden popcorn bucket',
]

async function getTrophyWords(): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key: 'trophy_words' } })
  return row ? JSON.parse(row.value) : DEFAULT_TROPHY_WORDS
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

let generatingCount = 0
export function getGeneratingCount() { return generatingCount }

async function generateOneTrophy(): Promise<void> {
  generatingCount++
  try {
    const words = await getTrophyWords()
    const title = randomFrom(words)
    const prompt = `A flat 2D cartoon illustration of "${title}". Pure white background, exactly #ffffff, no off-white or cream. Object centered, bold outlines, bright colors. No text, no shadows, no gradients.`
    const result = await generateImage({ prompt }, 'trophies')
    await prisma.trophy.create({
      data: { title, imageUrl: result.publicUrl },
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
    const winnerCount = c.isTeamCompetition ? maxTeamSize : 3
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
  const winnerCount = competition.isTeamCompetition ? maxTeamSize : 3
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
  subtitle: string
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
        subtitle: `Awarded for having the top score in **${cc.challenge.name}** in **${competition.name}**`,
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

  if (!competition.isTeamCompetition) {
    // Individual competition: top 3 players by total points
    const posLabels = ['🥇 1st place', '🥈 2nd place', '🥉 3rd place']
    const top3 = Object.entries(playerTotalPoints)
      .filter(([userId]) => {
        const cp = competition.players.find(p => p.userId === userId)
        return cp && !cp.user.isDummy
      })
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)

    for (const [i, [userId, points]] of top3.entries()) {
      if (points === 0) continue
      recipients.push({
        userId,
        subtitle: `${posLabels[i]} in **${competition.name}**`,
      })
    }
  } else {
    // Team competition: winning team members (non-dummy)
    const sortedTeams = competition.teams
      .map(t => ({ id: t.id, name: t.name, points: teamPoints[t.id] ?? 0 }))
      .sort((a, b) => b.points - a.points)

    if (sortedTeams.length > 0 && sortedTeams[0].points > 0) {
      const winningTeam = sortedTeams[0]
      const members = competition.players.filter(p => p.teamId === winningTeam.id && !p.user.isDummy)
      for (const member of members) {
        recipients.push({
          userId: member.userId,
          subtitle: `Awarded in **${competition.name}** for being in the winning team **${winningTeam.name}**`,
        })
      }
    }
  }

  recipients.push(...challengeTopScorers)
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

  await ensureForCompetition(competitionId)

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
    console.error(`[awards] Not enough trophies: need ${recipients.length}, have ${trophyIds.length}`)
  }

  const now = new Date()
  await Promise.all(
    recipients.slice(0, trophyIds.length).map((recipient, i) =>
      prisma.trophy.update({
        where: { id: trophyIds[i] },
        data: {
          userId: recipient.userId,
          subtitle: recipient.subtitle,
          sentAt: now,
          isOpened: false,
          reservedForCompetitionId: null,
          ...(trophyGroupId ? { groupId: trophyGroupId } : {}),
        },
      })
    )
  )
}
