import { PrismaClient, GlobalRole } from '@prisma/client'
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

  console.log('Seed complete.')
  console.log('Admin login: admin / admin1234')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
