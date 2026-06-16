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
// The team shoots up to `shotsPerTeam` shots; each member must take at least
// `minShotsPerPlayer` (a participation rule, enforced as a UI warning only).
// Team score = the plain sum of every shot. Individual score = the sum of a
// player's own shots. Nothing is dropped — there is no "best N" selection.

export function sumShots(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
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
