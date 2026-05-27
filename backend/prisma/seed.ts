import { PrismaClient, GlobalRole, ScoreType, TeamScoreMode } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Users
  const adminHash = await bcrypt.hash('admin1234', 12)
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminHash,
      displayName: 'Admin',
      realName: 'App Administrator',
      globalRole: GlobalRole.ADMIN,
    },
  })

  const players = await Promise.all([
    { username: 'anna', displayName: 'Anna K', realName: 'Anna Karlsson' },
    { username: 'bjorn', displayName: 'Björn L', realName: 'Björn Lindqvist' },
    { username: 'cecilia', displayName: 'Cecilia H', realName: 'Cecilia Hansson' },
    { username: 'david', displayName: 'David N', realName: 'David Nilsson' },
    { username: 'emma', displayName: 'Emma S', realName: 'Emma Svensson' },
    { username: 'fredrik', displayName: 'Fredrik A', realName: 'Fredrik Andersson' },
  ].map(async (u) => {
    const hash = await bcrypt.hash('player1234', 12)
    return prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { ...u, passwordHash: hash, globalRole: GlobalRole.PLAYER },
    })
  }))

  // Event
  const event = await prisma.event.upsert({
    where: { id: 'seed-event-summer2026' },
    update: {},
    create: {
      id: 'seed-event-summer2026',
      name: 'Summer Party 2026',
      date: new Date('2026-06-20'),
      status: 'ACTIVE',
      createdByUserId: admin.id,
    },
  })

  // Challenges
  const challengeData = [
    { name: 'Bollplanket', description: 'Score as many balls as possible in 60 seconds', scoreType: ScoreType.number_highest_wins, defaultTeamScoreMode: TeamScoreMode.sum_all_players },
    { name: 'Träslaget', description: 'Hit the wooden target with precision — closest distance wins', scoreType: ScoreType.number_lowest_wins, defaultTeamScoreMode: TeamScoreMode.average_score },
    { name: 'Desperados', description: 'Fastest team to complete the obstacle course', scoreType: ScoreType.time_fastest_wins, defaultTeamScoreMode: TeamScoreMode.best_n_players, bestNPlayers: 3 },
    { name: 'Ringtoss', description: 'Classic ring toss — classic ranking points', scoreType: ScoreType.ranked_points, defaultTeamScoreMode: TeamScoreMode.sum_all_players },
    { name: 'Kaninhoppning', description: 'Golf-style placement challenge — lowest score wins', scoreType: ScoreType.placement_lowest_wins, defaultTeamScoreMode: TeamScoreMode.sum_all_players },
  ]

  const challenges = await Promise.all(
    challengeData.map(c =>
      prisma.challenge.upsert({
        where: { id: `seed-challenge-${c.name.toLowerCase().replace(/\s+/g, '-')}` },
        update: {},
        create: {
          id: `seed-challenge-${c.name.toLowerCase().replace(/\s+/g, '-')}`,
          ...c,
          isGlobalTemplate: true,
        },
      })
    )
  )

  // Competition
  const competition = await prisma.competition.upsert({
    where: { id: 'seed-competition-5kamp2026' },
    update: {},
    create: {
      id: 'seed-competition-5kamp2026',
      eventId: event.id,
      name: '5-Kamp 2026',
      status: 'ACTIVE',
      createdByUserId: admin.id,
    },
  })

  // CompetitionChallenges
  for (let i = 0; i < challenges.length; i++) {
    await prisma.competitionChallenge.upsert({
      where: {
        competitionId_challengeId: {
          competitionId: competition.id,
          challengeId: challenges[i].id,
        },
      },
      update: {},
      create: {
        competitionId: competition.id,
        challengeId: challenges[i].id,
        order: i,
      },
    })
  }

  // Teams
  const teamData = [
    { id: 'seed-team-balder', name: 'Team Balder', leaderUserId: players[0].id },
    { id: 'seed-team-kaninen', name: 'Team Kaninen', leaderUserId: players[2].id },
    { id: 'seed-team-flumeride', name: 'Team Flumeride', leaderUserId: players[4].id },
  ]

  const teams = await Promise.all(
    teamData.map(t =>
      prisma.team.upsert({
        where: { id: t.id },
        update: {},
        create: { ...t, competitionId: competition.id },
      })
    )
  )

  // CompetitionPlayers
  const assignments = [
    { user: players[0], team: teams[0], isTeamLeader: true },
    { user: players[1], team: teams[0], isTeamLeader: false },
    { user: players[2], team: teams[1], isTeamLeader: true },
    { user: players[3], team: teams[1], isTeamLeader: false },
    { user: players[4], team: teams[2], isTeamLeader: true },
    { user: players[5], team: teams[2], isTeamLeader: false },
  ]

  for (const a of assignments) {
    await prisma.competitionPlayer.upsert({
      where: { competitionId_userId: { competitionId: competition.id, userId: a.user.id } },
      update: {},
      create: {
        competitionId: competition.id,
        userId: a.user.id,
        teamId: a.team.id,
        isTeamLeader: a.isTeamLeader,
      },
    })
  }

  // Sample scores for the first challenge (Bollplanket — number_highest_wins)
  const ccBollplanket = await prisma.competitionChallenge.findFirst({
    where: { competitionId: competition.id, challengeId: challenges[0].id },
  })

  if (ccBollplanket) {
    const scoreValues = [91, 88, 74, 82, 67, 79]
    for (let i = 0; i < players.length; i++) {
      await prisma.score.upsert({
        where: { competitionChallengeId_userId: { competitionChallengeId: ccBollplanket.id, userId: players[i].id } },
        update: {},
        create: {
          competitionId: competition.id,
          competitionChallengeId: ccBollplanket.id,
          userId: players[i].id,
          rawScore: scoreValues[i],
          calculatedPoints: scoreValues[i],
          enteredByUserId: admin.id,
        },
      })
    }
  }

  console.log('Seed complete!')
  console.log('Admin login: admin / admin1234')
  console.log('Player logins: anna / player1234 (and similar for bjorn, cecilia, david, emma, fredrik)')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
