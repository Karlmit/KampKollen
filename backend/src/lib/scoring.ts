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
}

// ── Shooting mode ────────────────────────────────────────────────────────────

// Sort shot values best-first. "Best" = highest, unless lower is better.
function bestFirst(values: number[], lowerBetter: boolean): number[] {
  return [...values].sort((a, b) => (lowerBetter ? a - b : b - a))
}

// A player's individual shooting score: the sum of their best min(Y, n) shots.
export function playerShootingScore(
  values: number[],
  shotsPerPlayer: number,
  lowerBetter: boolean
): number {
  return bestFirst(values, lowerBetter)
    .slice(0, Math.max(0, shotsPerPlayer))
    .reduce((a, b) => a + b, 0)
}

export interface ShootingShotInput {
  id: string
  userId: string
  value: number
}

// Team shooting score — "Guaranteed Y + fill lowest surplus":
//  1. Each player's best min(Y, n) shots are guaranteed counted.
//  2. deficit = Σ max(0, Y − n) for players who shot fewer than Y.
//  3. surplus pool = every shot a player has beyond their first Y.
//  4. Fill `deficit` slots from the surplus pool using the WORST-for-the-team
//     surplus shots first (the substitution penalty).
//  5. Cap the counted set at the best X shots overall.
// Returns the set of counted shot ids and the summed team total.
export function computeShootingCounted(
  shots: ShootingShotInput[],
  maxShots: number,
  shotsPerPlayer: number,
  lowerBetter: boolean
): { countedIds: Set<string>; teamTotal: number } {
  const X = Math.max(0, maxShots)
  const Y = Math.max(0, shotsPerPlayer)

  // Group shots by player
  const byPlayer = new Map<string, ShootingShotInput[]>()
  for (const s of shots) {
    const arr = byPlayer.get(s.userId)
    if (arr) arr.push(s)
    else byPlayer.set(s.userId, [s])
  }

  const guaranteed: ShootingShotInput[] = []
  const surplus: ShootingShotInput[] = []
  let deficit = 0

  for (const playerShots of byPlayer.values()) {
    // Sort this player's shots best-first so the guaranteed slice is their best.
    const sorted = [...playerShots].sort((a, b) =>
      lowerBetter ? a.value - b.value : b.value - a.value
    )
    const take = Math.min(Y, sorted.length)
    guaranteed.push(...sorted.slice(0, take))
    if (sorted.length < Y) deficit += Y - sorted.length
    else surplus.push(...sorted.slice(Y))
  }

  // Fill deficit from the surplus pool using the worst-for-the-team shots first.
  // Higher-better -> lowest values are worst; lower-better -> highest values.
  const surplusWorstFirst = [...surplus].sort((a, b) =>
    lowerBetter ? b.value - a.value : a.value - b.value
  )
  const filled = surplusWorstFirst.slice(0, Math.max(0, deficit))

  // Cap the combined counted set at the best X shots overall.
  let counted = [...guaranteed, ...filled]
  if (counted.length > X) {
    counted = bestFirstShots(counted, lowerBetter).slice(0, X)
  }

  return {
    countedIds: new Set(counted.map(s => s.id)),
    teamTotal: counted.reduce((a, b) => a + b.value, 0),
  }
}

function bestFirstShots(shots: ShootingShotInput[], lowerBetter: boolean): ShootingShotInput[] {
  return [...shots].sort((a, b) => (lowerBetter ? a.value - b.value : b.value - a.value))
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
