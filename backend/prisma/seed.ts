import { PrismaClient, GlobalRole, ScoreType, TeamScoreMode } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Admin account
  const adminHash = await bcrypt.hash('admin1234', 12)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminHash,
      displayName: 'admin',
      globalRole: GlobalRole.ADMIN,
    },
  })

  // Global challenge templates
  const challengeData = [
    { name: 'Bollplanket',      description: 'Score as many balls as possible in 60 seconds',         scoreType: ScoreType.number_highest_wins,   defaultTeamScoreMode: TeamScoreMode.sum_all_players },
    { name: 'Träslaget',        description: 'Hit the wooden target — closest distance wins',          scoreType: ScoreType.number_lowest_wins,    defaultTeamScoreMode: TeamScoreMode.average_score },
    { name: 'Desperados',       description: 'Fastest team to complete the obstacle course',           scoreType: ScoreType.time_fastest_wins,     defaultTeamScoreMode: TeamScoreMode.best_n_players, bestNPlayers: 3 },
    { name: 'Ringtoss',         description: 'Classic ring toss — classic ranking points',             scoreType: ScoreType.ranked_points,         defaultTeamScoreMode: TeamScoreMode.sum_all_players },
    { name: 'Kaninhoppning',    description: 'Golf-style placement challenge — lowest score wins',     scoreType: ScoreType.placement_lowest_wins, defaultTeamScoreMode: TeamScoreMode.sum_all_players },
  ]

  await Promise.all(
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

  console.log('Seed complete.')
  console.log('Admin login: admin / admin1234')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
