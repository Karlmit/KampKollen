import { ScoreType, TeamScoreMode } from '@prisma/client'

export interface PlayerScore {
  userId: string
  rawScore: number | null
  timeMs: number | null
  placement: number | null
  calculatedPoints: number | null
  teamId?: string | null
}

export interface TeamScoreResult {
  teamId: string
  totalPoints: number
  challengeScores: Record<string, number>
}

const RANKED_POINTS = [10, 8, 6, 4, 2, 0]

export function computeCalculatedPoints(
  score: PlayerScore,
  allScores: PlayerScore[],
  scoreType: ScoreType
): number {
  switch (scoreType) {
    case 'number_highest_wins':
      return score.rawScore ?? 0

    case 'number_lowest_wins':
      return score.rawScore ?? 0

    case 'time_fastest_wins':
      return score.timeMs ?? 0

    case 'ranked_points': {
      const validScores = allScores
        .filter(s => s.rawScore != null)
        .sort((a, b) => (b.rawScore ?? 0) - (a.rawScore ?? 0))
      const rank = validScores.findIndex(s => s.userId === score.userId)
      return RANKED_POINTS[rank] ?? 0
    }

    case 'placement_lowest_wins':
      return score.placement ?? 0

    case 'manual_points':
      return score.calculatedPoints ?? 0

    case 'win_loss':
      return (score.rawScore ?? 0) === 1 ? 1 : 0

    default:
      return 0
  }
}

export function isLowerBetter(scoreType: ScoreType): boolean {
  return scoreType === 'placement_lowest_wins'
    || scoreType === 'number_lowest_wins'
    || scoreType === 'time_fastest_wins'
    || scoreType === 'least_time_difference'
}

// "Least time difference" (Time Walk): a team walks the same distance twice and
// the score is how many seconds the two times differ — closest to zero wins.
// Returns null until both times have been recorded so the team stays unranked.
export function computeTimeDifferenceSeconds(
  time1Ms: number | null | undefined,
  time2Ms: number | null | undefined
): number | null {
  if (time1Ms == null || time2Ms == null) return null
  return Math.abs(time1Ms - time2Ms) / 1000
}

// ── Shooting mode ────────────────────────────────────────────────────────────
// The team shoots up to `shotsPerTeam` shots; each member must take at least
// `minShotsPerPlayer` (a participation rule, enforced as a UI warning only).
// Team score = the plain sum of every shot. Individual score = the sum of a
// player's own shots. Nothing is dropped — there is no "best N" selection.

// A player's individual shooting score: the sum of their best `n` shots (where
// n = minShotsPerPlayer). Capping at n keeps players who took extra shots from
// out-scoring everyone on the individual leaderboard. "Best" = highest, unless
// lower is better.
export function bestNSum(values: number[], n: number, lowerBetter: boolean): number {
  return [...values]
    .sort((a, b) => (lowerBetter ? a - b : b - a))
    .slice(0, Math.max(0, n))
    .reduce((a, b) => a + b, 0)
}

export interface ShootingShotInput {
  id: string
  userId: string
  value: number
}

// Which of a team's shots count toward its team score, and their sum.
//   1. Every player's best min(minShotsPerPlayer, n) shots are locked in first
//      (honours "each member must shoot N"), so no one is shut out of the team
//      score.
//   2. Remaining slots up to `shotsPerTeam` are filled with the best shots left
//      over across the whole team.
//   3. The counted set never exceeds `shotsPerTeam`, so every team has the same
//      ceiling (shotsPerTeam × maxScorePerShot) regardless of roster size.
// Players still take all their shots — this only decides what counts for the
// team; individual scores use bestNSum independently. "Best" = highest unless
// lower is better.
export function computeShootingCounted(
  shots: ShootingShotInput[],
  shotsPerTeam: number,
  minShotsPerPlayer: number,
  lowerBetter: boolean
): { countedIds: Set<string>; teamTotal: number } {
  const X = Math.max(0, shotsPerTeam)
  const Y = Math.max(0, minShotsPerPlayer)
  const bestFirst = (arr: ShootingShotInput[]) =>
    [...arr].sort((a, b) => (lowerBetter ? a.value - b.value : b.value - a.value))

  const byPlayer = new Map<string, ShootingShotInput[]>()
  for (const s of shots) {
    const arr = byPlayer.get(s.userId)
    if (arr) arr.push(s)
    else byPlayer.set(s.userId, [s])
  }

  const guaranteed: ShootingShotInput[] = []
  const rest: ShootingShotInput[] = []
  for (const playerShots of byPlayer.values()) {
    const sorted = bestFirst(playerShots)
    guaranteed.push(...sorted.slice(0, Y))
    rest.push(...sorted.slice(Y))
  }

  let counted: ShootingShotInput[]
  if (guaranteed.length >= X) {
    // More guaranteed shots than the team budget (very large roster): keep the
    // best X of them so the ceiling still holds.
    counted = bestFirst(guaranteed).slice(0, X)
  } else {
    counted = [...guaranteed, ...bestFirst(rest).slice(0, X - guaranteed.length)]
  }

  return {
    countedIds: new Set(counted.map(s => s.id)),
    teamTotal: counted.reduce((a, b) => a + b.value, 0),
  }
}

export function computeTeamScore(
  playerPoints: number[],
  mode: TeamScoreMode,
  bestN?: number | null
): number {
  if (playerPoints.length === 0) return 0

  switch (mode) {
    case 'sum_all_players':
      return playerPoints.reduce((a, b) => a + b, 0)

    case 'best_n_players': {
      const n = bestN ?? playerPoints.length
      return [...playerPoints]
        .sort((a, b) => b - a)
        .slice(0, n)
        .reduce((a, b) => a + b, 0)
    }

    case 'average_score':
      return playerPoints.reduce((a, b) => a + b, 0) / playerPoints.length

    case 'manual_team_score':
      return 0

    default:
      return 0
  }
}

export interface ChallengeLeaderboardEntry {
  challengeId: string
  challengeName: string
  order: number
  scoreType: ScoreType
  teamScoreMode: TeamScoreMode
  lowerIsBetter: boolean
  teams: Array<{
    teamId: string
    teamName: string
    score: number
    rank: number
    players: Array<{
      userId: string
      username: string
      displayName: string | null
      score: number
      points: number
    }>
  }>
}

export interface CompetitionLeaderboard {
  competitionId: string
  teams: Array<{
    teamId: string
    teamName: string
    teamImageUrl: string | null
    totalPoints: number
    rank: number
    challengeBreakdown: Record<string, number>
  }>
  challenges: ChallengeLeaderboardEntry[]
  individualRankings: Array<{
    userId: string
    username: string
    displayName: string | null
    profileImageUrl: string | null
    teamId: string | null
    teamName: string | null
    totalPoints: number
    rank: number
  }>
}
