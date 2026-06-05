import { prisma } from '../db.js'

// Idempotent: runs on every startup. Creates "Bjorn Lunden" group and assigns
// all existing users, competitions, and trophies to it as needed.
export async function runGroupMigration(): Promise<void> {
  let group = await prisma.group.findUnique({ where: { name: 'Bjorn Lunden' } })

  // Always stamp awarded trophies that have no group yet (covers existing deploys)
  if (group) {
    await prisma.trophy.updateMany({
      where: { userId: { not: null }, groupId: null },
      data: { groupId: group.id },
    })
    return
  }

  group = await prisma.group.create({ data: { name: 'Bjorn Lunden' } })

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
    // Stamp all existing awarded trophies with the Bjorn Lunden group
    prisma.trophy.updateMany({
      where: { userId: { not: null }, groupId: null },
      data: { groupId: group.id },
    }),
  ])

  console.log(`[migration] Created "Bjorn Lunden" group, assigned ${users.length} users and ${competitions.length} competitions.`)
}
