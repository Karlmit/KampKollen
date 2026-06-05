import { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { generateImage } from '../lib/imageGeneration.js'
import { getGeneratingCount, getActiveCompetitionNeeds, ensureForCompetition } from '../lib/awardTrophies.js'
import { GlobalRole } from '@prisma/client'

const DEFAULT_TROPHY_WORDS = [
  'Old rocking horse', 'Teddy bear with one missing eye', 'Pristine fountain pen',
  'Shiny red apple', 'Cracked porcelain duck', 'Golden banana', 'Tiny wizard hat',
  'Rusty bicycle bell', 'Suspicious pineapple', 'Fancy teaspoon', 'Broken alarm clock',
  'Very proud potato', 'Plastic crown', 'Rubber duck in sunglasses', 'Ancient office chair',
  'Glorious traffic cone', 'Half-melted candle', 'Tiny wooden stool', 'Fancy monocle',
  'Bent silver spoon', 'Emotional support cactus', 'Slightly haunted sandwich',
  'Golden toilet brush', 'Dusty trophy cup', 'Tiny garden gnome', 'Royal-looking cabbage',
  'Sock with a medal', 'Miniature pirate ship', 'Sad balloon', 'Heroic meatball',
  'Crystal doorknob', 'Wobbly chess knight', 'Suspicious egg', 'Majestic cheese wheel',
  'Lonely mitten', 'Fancy umbrella', 'Tiny dragon statue', 'Broken snow globe',
  'Glittery snail shell', 'Old TV remote', 'Ceremonial frying pan', 'Stuffed moose head',
  'Tiny treasure chest', 'Extremely normal rock', 'Banana peel on a pedestal',
  'Wooden spoon of destiny', 'Noble rubber boot', 'Golden stapler', 'Mysterious key',
  'Fancy teacup', 'Angry-looking lemon', 'Tiny accordion', 'Dusty violin',
  'Heroic garden shovel', 'Sparkly fishbowl', 'Old captain\'s hat', 'Royal egg cup',
  'Crooked picture frame', 'Tiny cannon', 'Very serious pumpkin', 'Broken compass',
  'Majestic toothbrush', 'Antique door knocker', 'Golden mushroom', 'Sleepy owl figurine',
  'Trophy-shaped sandwich', 'Fancy feather quill', 'Crowned frog statue', 'Tiny train engine',
  'Melancholy cupcake', 'Ancient calculator', 'Wooden duck on wheels', 'Plastic dinosaur',
  'Dramatic cape', 'Tiny lighthouse', 'Lucky horseshoe', 'Golden carrot',
  'Confused chicken statue', 'Silver waffle iron', 'Tiny bathtub', 'Worn-out boxing glove',
  'Fancy jam jar', 'Noble soup ladle', 'Crystal pineapple', 'Broken magic wand',
  'Tiny castle tower', 'Golden rolling pin', 'Mysterious blue bottle', 'Old leather boot',
  'Tiny scarecrow', 'Decorative fish', 'Bronze acorn', 'Fancy biscuit tin',
  'Tiny astronaut helmet', 'Royal lunchbox', 'Glittering onion', 'Old typewriter key',
  'Miniature windmill', 'Golden popcorn bucket',
]

async function getTrophyWords(): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key: 'trophy_words' } })
  return row ? JSON.parse(row.value) : DEFAULT_TROPHY_WORDS
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export async function trophyWordRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAdmin }, async () => {
    return { words: await getTrophyWords() }
  })

  app.put('/', { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { words?: string[] }
    if (!Array.isArray(body.words) || body.words.length === 0) {
      return reply.status(400).send({ error: 'words must be a non-empty array' })
    }
    await prisma.setting.upsert({
      where: { key: 'trophy_words' },
      update: { value: JSON.stringify(body.words) },
      create: { key: 'trophy_words', value: JSON.stringify(body.words) },
    })
    return { success: true }
  })
}

export async function trophyRoutes(app: FastifyInstance) {
  // Generation status + active competition needs
  app.get('/status', { preHandler: requireAdmin }, async () => {
    const [storageCount, activeCompetitions] = await Promise.all([
      prisma.trophy.count({ where: { userId: null } }),
      getActiveCompetitionNeeds(),
    ])
    return { storageCount, generating: getGeneratingCount(), activeCompetitions }
  })

  // Ensure enough trophies in storage for a specific active competition
  app.post('/ensure-for-competition/:competitionId', { preHandler: requireAdmin }, async (request, reply) => {
    const { competitionId } = request.params as { competitionId: string }
    const competition = await prisma.competition.findUnique({ where: { id: competitionId }, select: { status: true } })
    if (!competition) return reply.status(404).send({ error: 'Competition not found' })
    if (competition.status !== 'ACTIVE') return reply.status(400).send({ error: 'Competition is not active' })
    ensureForCompetition(competitionId).catch(err => console.error('[awards] ensure error:', err))
    return { started: true }
  })

  // List trophies in storage (unassigned)
  app.get('/storage', { preHandler: requireAdmin }, async () => {
    const trophies = await prisma.trophy.findMany({
      where: { userId: null },
      orderBy: { createdAt: 'desc' },
      include: { reservedForCompetition: { select: { id: true, name: true } } },
    })
    return { trophies }
  })

  // Award history — all players in the caller's groups sorted by trophy count
  app.get('/history', { preHandler: requireAuth }, async (request) => {
    const me = request.user as { id: string }
    const memberships = await prisma.userGroup.findMany({ where: { userId: me.id }, select: { groupId: true } })
    const groupIds = memberships.map(m => m.groupId)

    const usersWithTrophies = await prisma.user.findMany({
      where: {
        isDummy: false,
        ...(groupIds.length > 0 ? { groups: { some: { groupId: { in: groupIds } } } } : {}),
        trophies: { some: { sentAt: { not: null } } },
      },
      include: {
        trophies: {
          where: { sentAt: { not: null } },
          orderBy: { sentAt: 'desc' },
          select: { id: true, title: true, subtitle: true, imageUrl: true, sentAt: true },
        },
      },
    })

    const players = usersWithTrophies
      .filter(u => u.trophies.length > 0)
      .sort((a, b) => b.trophies.length - a.trophies.length)
      .map(u => ({
        userId: u.id,
        displayName: u.displayName,
        username: u.username,
        profileImageUrl: u.profileImageUrl,
        trophyCount: u.trophies.length,
        trophies: u.trophies,
      }))

    return { players }
  })

  // List trophies for a user
  app.get('/user/:userId', { preHandler: requireAuth }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const me = request.user as { id: string; role: GlobalRole }

    if (me.id !== userId && me.role !== GlobalRole.ADMIN) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const trophies = await prisma.trophy.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
    })
    return { trophies }
  })

  // Generate a trophy into storage (optional specific word)
  app.post('/generate', { preHandler: requireAdmin }, async (request) => {
    const body = request.body as { word?: string }
    const words = await getTrophyWords()
    const title = body.word?.trim() || randomFrom(words)
    const prompt = `A flat 2D cartoon illustration of "${title}". Pure white background, exactly #ffffff, no off-white or cream. Object centered, bold outlines, bright colors. No text, no shadows, no gradients.`
    const result = await generateImage({ prompt }, 'trophies')
    const trophy = await prisma.trophy.create({
      data: { title, imageUrl: result.publicUrl },
    })
    return { trophy }
  })

  // Reserve a storage trophy for a specific competition (or clear reservation)
  app.put('/:id/reserve', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { competitionId?: string | null }

    const trophy = await prisma.trophy.findUnique({ where: { id } })
    if (!trophy) return reply.status(404).send({ error: 'Trophy not found' })
    if (trophy.userId) return reply.status(400).send({ error: 'Cannot reserve an assigned trophy' })

    const updated = await prisma.trophy.update({
      where: { id },
      data: { reservedForCompetitionId: body.competitionId ?? null },
      include: { reservedForCompetition: { select: { id: true, name: true } } },
    })
    return { trophy: updated }
  })

  // Generate a trophy and immediately send to user
  app.post('/generate-send', { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { userId?: string }
    if (!body.userId) return reply.status(400).send({ error: 'userId required' })

    const user = await prisma.user.findUnique({ where: { id: body.userId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const words = await getTrophyWords()
    const title = randomFrom(words)
    const prompt = `A flat 2D cartoon illustration of "${title}". Pure white background, exactly #ffffff, no off-white or cream. Object centered, bold outlines, bright colors. No text, no shadows, no gradients.`
    const result = await generateImage({ prompt }, 'trophies')
    const trophy = await prisma.trophy.create({
      data: { title, imageUrl: result.publicUrl, userId: body.userId, sentAt: new Date() },
    })
    return { trophy }
  })

  // Send a stored trophy to a user
  app.post('/:id/send', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { userId?: string }
    if (!body.userId) return reply.status(400).send({ error: 'userId required' })

    const trophy = await prisma.trophy.findUnique({ where: { id } })
    if (!trophy) return reply.status(404).send({ error: 'Trophy not found' })
    if (trophy.userId) return reply.status(400).send({ error: 'Trophy already assigned' })

    const updated = await prisma.trophy.update({
      where: { id },
      data: { userId: body.userId, sentAt: new Date(), isOpened: false },
    })
    return { trophy: updated }
  })

  // Take back a trophy to storage
  app.post('/:id/take-back', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const trophy = await prisma.trophy.findUnique({ where: { id } })
    if (!trophy) return reply.status(404).send({ error: 'Trophy not found' })

    const updated = await prisma.trophy.update({
      where: { id },
      data: { userId: null, sentAt: null, isOpened: false },
    })
    return { trophy: updated }
  })

  // Open a trophy (user's own only)
  app.post('/:id/open', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string }

    const trophy = await prisma.trophy.findUnique({ where: { id } })
    if (!trophy) return reply.status(404).send({ error: 'Trophy not found' })
    if (trophy.userId !== me.id) return reply.status(403).send({ error: 'Forbidden' })

    const updated = await prisma.trophy.update({
      where: { id },
      data: { isOpened: true },
    })
    return { trophy: updated }
  })

  // Delete trophy from storage (admin, unassigned only)
  app.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const trophy = await prisma.trophy.findUnique({ where: { id } })
    if (!trophy) return reply.status(404).send({ error: 'Trophy not found' })
    if (trophy.userId) return reply.status(400).send({ error: 'Cannot delete assigned trophy; take it back first' })

    await prisma.trophy.delete({ where: { id } })
    return { success: true }
  })
}
