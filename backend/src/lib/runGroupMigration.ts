import { prisma } from '../db.js'

// Idempotent: runs on every startup. Creates "Bjorn Lunden" group and assigns
// all existing users and competitions to it if it doesn't already exist.
export async function runGroupMigration(): Promise<void> {
  const existing = await prisma.group.findUnique({ where: { name: 'Bjorn Lunden' } })
  if (existing) return

  const group = await prisma.group.create({ data: { name: 'Bjorn Lunden' } })

  const [users, competitions] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    prisma.competition.findMany({ select: { id: true } }),
  ])

  await Promise.all([
    prisma.userGroup.createMany({
      data: users.map(u => ({ userId: u.id, groupId: group.id })),
      skipDuplicates: true,
    }),
    prisma.competition.updateMany({
      where: { groupId: null },
      data: { groupId: group.id },
    }),
  ])

  console.log(`[migration] Created "Bjorn Lunden" group, assigned ${users.length} users and ${competitions.length} competitions.`)
}
