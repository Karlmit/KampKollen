import { prisma } from '../db.js'

// Idempotent: rewrite old-style subtitle text to use bold markers.
// REPLACE is naturally idempotent — the old patterns won't appear once updated.
async function migrateAwardSubtitles(): Promise<void> {
  // Step 1: Reorder winning-team sentences using JS regex (PostgreSQL POSIX doesn't support non-greedy)
  // Old: "Awarded in **X** for being in the [**]winning team[**] **Y**"
  // New: "Awarded for being in the **winning team** **Y** in **X**"
  const winningTeamTrophies = await prisma.trophy.findMany({
    where: { subtitle: { contains: 'for being in the' } },
    select: { id: true, subtitle: true },
  })
  for (const trophy of winningTeamTrophies) {
    if (!trophy.subtitle) continue
    const match = trophy.subtitle.match(/^Awarded in \*\*(.+?)\*\* for being in the (?:\*\*)?winning team(?:\*\*)? \*\*(.+?)\*\*/)
    if (match) {
      await prisma.trophy.update({
        where: { id: trophy.id },
        data: { subtitle: `Awarded for being in the **winning team** **${match[2]}** in **${match[1]}**` },
      })
    }
  }

  // Step 2: Bold remaining plain-text phrases via SQL REPLACE (idempotent)
  await prisma.$executeRaw`
    UPDATE "Trophy"
    SET subtitle =
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        subtitle,
        'the top score in',  'the **top score** in'),
        'the winning team ', 'the **winning team** '),
        '🥇 1st place',     '🥇 **1st place**'),
        '🥈 2nd place',     '🥈 **2nd place**'),
        '🥉 3rd place',     '🥉 **3rd place**')
    WHERE subtitle IS NOT NULL
  `
}

// Idempotent: runs on every startup. Creates "Bjorn Lunden" group and assigns
// all existing users, competitions, and trophies to it as needed.
export async function runGroupMigration(): Promise<void> {
  // Always run subtitle migration (idempotent)
  await migrateAwardSubtitles()

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
