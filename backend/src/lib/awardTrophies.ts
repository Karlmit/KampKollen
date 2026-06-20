import { prisma } from '../db.js'
import { generateImage } from './imageGeneration.js'
import { getTrophyWords, randomFrom, wordToTitle } from './trophyWords.js'
import { competitionLeaderboardInclude, computeCompetitionLeaderboard } from './competitionLeaderboard.js'

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
    include: competitionLeaderboardInclude,
  })
  if (!competition || competition.players.length === 0) return []

  // Pick winners from the SAME standings the leaderboard endpoint shows players,
  // so a trophy always matches a player's real finishing position. (See
  // computeCompetitionLeaderboard — the single source of truth for scoring.)
  const { teamLeaderboard, individualLeaderboard, challengeLeaderboards } =
    computeCompetitionLeaderboard(competition)

  const recipients: AwardRecipient[] = []
  const compName = competition.name

  // Individual standings, best-first, real players only (guests never win), and
  // only players who actually scored something.
  const rankedIndividuals = individualLeaderboard
    .filter(p => !p.isDummy && p.totalPoints > 0)

  const medals = ['🥇', '🥈', '🥉']

  if (!competition.isTeamCompetition) {
    // Individual competition: the overall top 3 placement.
    const posLabels = ['🥇 **1st place**', '🥈 **2nd place**', '🥉 **3rd place**']
    const placementKeys = ['placement1', 'placement2', 'placement3']
    rankedIndividuals.slice(0, 3).forEach((p, i) => {
      recipients.push({
        userId: p.userId,
        subtitle: `${posLabels[i]} in **${compName}**`,
        subtitleKey: placementKeys[i],
        subtitleParams: { competition: compName },
      })
    })
  } else {
    // Team competition: every member (non-dummy) of the winning team...
    const winningTeam = teamLeaderboard[0]
    if (winningTeam && winningTeam.totalPoints > 0) {
      const members = competition.players.filter(p => p.teamId === winningTeam.teamId && !p.user.isDummy)
      for (const member of members) {
        recipients.push({
          userId: member.userId,
          subtitle: `Awarded for being in the **winning team** **${winningTeam.teamName}** in **${compName}**`,
          subtitleKey: 'winningTeam',
          subtitleParams: { team: winningTeam.teamName, competition: compName },
        })
      }
    }

    // ...plus the top 3 of the individual leaderboard.
    const individualKeys = ['individualLeaderboard1', 'individualLeaderboard2', 'individualLeaderboard3']
    rankedIndividuals.slice(0, 3).forEach((p, i) => {
      recipients.push({
        userId: p.userId,
        subtitle: `${medals[i]} Awarded for being **top ${i + 1}** in the **individual leaderboard** during **${compName}**`,
        subtitleKey: individualKeys[i],
        subtitleParams: { competition: compName },
      })
    })
  }

  for (const cl of challengeLeaderboards) {
    // Team-comp quizzes give a winning-team award (below) instead, so the
    // quiz winners aren't double-awarded a "top score" trophy on top of it.
    const quizTeamAward = cl.isQuiz && competition.isTeamCompetition

    // Top scorer (non-dummy) of each non-quiz challenge that has scores.
    if (!quizTeamAward) {
      const topPlayer = cl.players.find((p: { isDummy: boolean }) => !p.isDummy)
      if (topPlayer) {
        recipients.push({
          userId: topPlayer.userId,
          subtitle: `Awarded for having the **top score** in **${cl.challengeName}** in **${compName}**`,
          subtitleKey: 'topScore',
          subtitleParams: { challenge: cl.challengeName, competition: compName },
        })
      }
    }

    // Quiz challenges instead award every member of the winning team (team comps).
    if (quizTeamAward) {
      const topTeam = cl.teams[0]
      if (topTeam && topTeam.score > 0) {
        const members = competition.players.filter(p => p.teamId === topTeam.teamId && !p.user.isDummy)
        for (const member of members) {
          recipients.push({
            userId: member.userId,
            subtitle: `Awarded for being in the **winning team** **${topTeam.teamName}** of the quiz **${cl.challengeName}**`,
            subtitleKey: 'quizWinningTeam',
            subtitleParams: { team: topTeam.teamName, quiz: cl.challengeName },
          })
        }
      }
    }
  }

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
