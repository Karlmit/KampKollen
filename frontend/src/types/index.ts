export type GlobalRole = 'PLAYER' | 'SCOREKEEPER' | 'ADMIN'

export interface Group {
  id: string
  name: string
  createdAt: string
  _count?: { members: number; competitions: number }
}

export interface UserGroup {
  groupId: string
  group: Pick<Group, 'id' | 'name'>
}
export type CompetitionStatus = 'DRAFT' | 'REGISTRATION' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
export type ScoreType = 'number_highest_wins' | 'number_lowest_wins' | 'time_fastest_wins' | 'ranked_points' | 'placement_lowest_wins' | 'manual_points' | 'win_loss' | 'shooting' | 'least_time_difference'
export type TeamScoreMode = 'sum_all_players' | 'best_n_players' | 'average_score' | 'manual_team_score'
export type CompetitionScoringMode = 'raw_sum' | 'placement_points'

export interface User {
  id: string
  username: string
  displayName?: string
  realName?: string
  profileImageUrl?: string
  globalRole: GlobalRole
  isDummy?: boolean
  createdAt: string
  groups?: UserGroup[]
}

export interface Competition {
  id: string
  name: string
  date?: string
  imageUrl?: string
  status: CompetitionStatus
  scoringMode?: CompetitionScoringMode
  isTeamCompetition?: boolean
  groupId?: string
  createdAt: string
  teams?: Team[]
  players?: CompetitionPlayer[]
  challenges?: CompetitionChallenge[]
  _count?: { players: number }
}

export interface Challenge {
  id: string
  name: string
  description?: string
  logoUrl?: string
  scoreType: ScoreType
  defaultTeamScoreMode: TeamScoreMode
  bestNPlayers?: number
  shotsPerTeam?: number
  minShotsPerPlayer?: number
  maxScorePerShot?: number
  shootingLowerIsBetter?: boolean
  valueUnit?: string
  allowDecimals?: boolean
  attemptsPerPlayer?: number | null
  sumAllAttempts?: boolean
  useTeamScoreMode?: boolean
  isGlobalTemplate: boolean
  createdAt: string
}

export interface CompetitionChallenge {
  id: string
  competitionId: string
  challengeId: string
  challenge: Challenge
  order: number
  scoreTypeOverride?: ScoreType
  teamScoreModeOverride?: TeamScoreMode
  bestNPlayersOverride?: number
}

export interface Team {
  id: string
  competitionId: string
  name: string
  imageUrl?: string
  leaderUserId?: string
  leader?: Pick<User, 'id' | 'username' | 'displayName'>
  players?: CompetitionPlayer[]
  createdAt: string
}

export interface CompetitionPlayer {
  id: string
  competitionId: string
  userId: string
  user: Pick<User, 'id' | 'username' | 'displayName' | 'profileImageUrl' | 'isDummy'>
  teamId?: string
  team?: Pick<Team, 'id' | 'name'>
  isTeamLeader: boolean
  isScorekeeper: boolean
  isQuizMaster: boolean
  joinedAt: string
}

export interface Score {
  id: string
  competitionId: string
  competitionChallengeId: string
  competitionChallenge?: CompetitionChallenge
  userId: string
  player?: Pick<User, 'id' | 'username' | 'displayName' | 'profileImageUrl'>
  rawScore?: number
  timeMs?: number
  placement?: number
  calculatedPoints?: number
  enteredByUserId: string
  enteredByUser?: Pick<User, 'id' | 'username'>
  note?: string
  createdAt: string
}

export interface Shot {
  id: string
  competitionId: string
  competitionChallengeId: string
  userId: string
  player?: Pick<User, 'id' | 'username' | 'displayName' | 'profileImageUrl'>
  value: number
  order: number
  counted?: boolean
  createdAt: string
}

export interface LeaderboardTeam {
  teamId: string
  teamName: string
  teamImageUrl?: string
  totalPoints: number
  rank: number
  challengeBreakdown: Record<string, number>
  playerCount: number
  hasScore: boolean
}

export interface CompetitionLeaderboard {
  competition: { id: string; name: string; scoringMode: CompetitionScoringMode; isTeamCompetition?: boolean; status?: string }
  teamLeaderboard: LeaderboardTeam[]
  individualLeaderboard: Array<{
    userId: string
    displayName?: string | null
    username?: string | null
    profileImageUrl?: string | null
    teamId?: string | null
    teamName?: string | null
    totalPoints: number
    rank: number
    hasScore: boolean
  }>
  challengeLeaderboards: Array<{
    challengeId: string
    competitionChallengeId: string
    challengeName: string
    challengeLogoUrl?: string
    order: number
    scoreType: ScoreType
    teamScoreMode: TeamScoreMode
    lowerIsBetter: boolean
    teams: Array<{ teamId: string; teamName: string; score: number; rank: number; placementPoints?: number }>
    players: Array<{ userId: string; displayName?: string | null; username?: string | null; profileImageUrl?: string | null; teamId?: string | null; teamName?: string | null; score: number; rank: number; placementPoints?: number }>
  }>
}

export const SCORE_TYPE_LABELS: Record<ScoreType, string> = {
  number_highest_wins: 'Highest Score Wins',
  number_lowest_wins: 'Lowest Score Wins',
  time_fastest_wins: 'Fastest Time Wins',
  ranked_points: 'Ranked Points (10-8-6-4-2)',
  placement_lowest_wins: 'Placement (Golf Style)',
  manual_points: 'Manual Points',
  win_loss: 'Win / Loss',
  shooting: 'Shooting',
  least_time_difference: 'Least Time Difference',
}

export const TEAM_SCORE_MODE_LABELS: Record<TeamScoreMode, string> = {
  sum_all_players: 'Sum All Players',
  best_n_players: 'Best N Players',
  average_score: 'Average Score',
  manual_team_score: 'Manual Team Score',
}
