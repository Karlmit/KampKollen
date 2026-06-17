import { FastifyInstance } from 'fastify'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { generateImage } from '../lib/imageGeneration.js'
import { getGeneratingCount, getActiveCompetitionNeeds, ensureForCompetition } from '../lib/awardTrophies.js'
import { getTrophyWords, normalizeTrophyWords, randomFrom, wordToTitle, TrophyWord } from '../lib/trophyWords.js'
import { GlobalRole } from '@prisma/client'

export async function trophyWordRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAdmin }, async () => {
    return { words: await getTrophyWords() }
  })

  app.put('/', { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { words?: unknown }
    if (!Array.isArray(body.words) || body.words.length === 0) {
      return reply.status(400).send({ error: 'words must be a non-empty array' })
    }
    const words = normalizeTrophyWords(body.words)
    if (words.length === 0) {
      return reply.status(400).send({ error: 'words must contain at least one English name' })
    }
    await prisma.setting.upsert({
      where: { key: 'trophy_words' },
      update: { value: JSON.stringify(words) },
      create: { key: 'trophy_words', value: JSON.stringify(words) },
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

  // Award history — players with trophies visible to the caller, sorted by count
  app.get('/history', { preHandler: requireAuth }, async (request) => {
    const me = request.user as { id: string }
    const { groupId: filterGroupId } = request.query as { groupId?: string }
    const memberships = await prisma.userGroup.findMany({ where: { userId: me.id }, select: { groupId: true } })
    const callerGroupIds = memberships.map(m => m.groupId)
    // Use specific group filter if provided (and caller is in it), else all caller's groups
    const activeGroupIds = filterGroupId && callerGroupIds.includes(filterGroupId)
      ? [filterGroupId]
      : callerGroupIds

    const usersWithTrophies = await prisma.user.findMany({
      where: {
        isDummy: false,
        trophies: { some: { sentAt: { not: null }, groupId: activeGroupIds.length > 0 ? { in: activeGroupIds } : undefined } },
      },
      include: {
        trophies: {
          where: {
            sentAt: { not: null },
            ...(activeGroupIds.length > 0 ? { groupId: { in: activeGroupIds } } : {}),
          },
          orderBy: { sentAt: 'desc' },
          select: { id: true, title: true, titleSv: true, subtitle: true, subtitleKey: true, subtitleParams: true, imageUrl: true, sentAt: true },
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
    const body = request.body as { word?: string; wordSv?: string }
    const words = await getTrophyWords()
    const chosen: TrophyWord = body.word?.trim()
      ? { en: body.word.trim(), sv: body.wordSv?.trim() || undefined }
      : randomFrom(words)
    const { title, titleSv } = wordToTitle(chosen)
    // The image generator always works from the English name.
    const prompt = `A flat 2D cartoon illustration of "${title}". Pure white background, exactly #ffffff, no off-white or cream. Object centered, bold outlines, bright colors. No text, no shadows, no gradients.`
    const result = await generateImage({ prompt }, 'trophies')
    const trophy = await prisma.trophy.create({
      data: { title, titleSv, imageUrl: result.publicUrl },
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

    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      include: { groups: { select: { groupId: true }, take: 1 } },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const recipientGroupId = user.groups[0]?.groupId ?? null
    const words = await getTrophyWords()
    const { title, titleSv } = wordToTitle(randomFrom(words))
    const prompt = `A flat 2D cartoon illustration of "${title}". Pure white background, exactly #ffffff, no off-white or cream. Object centered, bold outlines, bright colors. No text, no shadows, no gradients.`
    const result = await generateImage({ prompt }, 'trophies')
    const trophy = await prisma.trophy.create({
      data: { title, titleSv, imageUrl: result.publicUrl, userId: body.userId, sentAt: new Date(), ...(recipientGroupId ? { groupId: recipientGroupId } : {}) },
    })
    return { trophy }
  })

  // Send a stored trophy to a user
  app.post('/:id/send', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { userId?: string }
    if (!body.userId) return reply.status(400).send({ error: 'userId required' })

    const [trophy, recipient] = await Promise.all([
      prisma.trophy.findUnique({ where: { id } }),
      prisma.userGroup.findFirst({ where: { userId: body.userId }, select: { groupId: true } }),
    ])
    if (!trophy) return reply.status(404).send({ error: 'Trophy not found' })
    if (trophy.userId) return reply.status(400).send({ error: 'Trophy already assigned' })

    const updated = await prisma.trophy.update({
      where: { id },
      data: { userId: body.userId, sentAt: new Date(), isOpened: false, ...(recipient?.groupId ? { groupId: recipient.groupId } : {}) },
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
