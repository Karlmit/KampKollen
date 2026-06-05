import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GlobalRole } from '@prisma/client'
import { prisma } from '../db.js'
import { hashPassword, validatePassword } from '../lib/auth.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { generateImage, DEFAULT_PROMPTS } from '../lib/imageGeneration.js'

const updateUserSchema = z.object({
  displayName: z.string().max(64).optional(),
  realName: z.string().max(128).optional(),
  globalRole: z.nativeEnum(GlobalRole).optional(),
  password: z.string().min(4).max(128).optional(),
})

const userSelect = {
  id: true, username: true, displayName: true, realName: true,
  profileImageUrl: true, globalRole: true, createdAt: true,
  groups: { select: { groupId: true, group: { select: { id: true, name: true } } } },
}

export async function userRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAdmin }, async () => {
    const users = await prisma.user.findMany({ select: userSelect, orderBy: { createdAt: 'asc' } })
    return { users }
  })

  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: GlobalRole }

    // For other users' profiles, restrict to data from groups the caller shares
    let callerGroupIds: string[] = []
    const isOtherUser = me.id !== id && me.role !== GlobalRole.ADMIN
    if (isOtherUser) {
      const callerGroups = await prisma.userGroup.findMany({ where: { userId: me.id }, select: { groupId: true } })
      callerGroupIds = callerGroups.map(g => g.groupId)
    }

    const groupCompFilter = isOtherUser && callerGroupIds.length > 0
      ? { groupId: { in: callerGroupIds } }
      : undefined

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        ...userSelect,
        competitionPlayers: {
          where: groupCompFilter ? { competition: groupCompFilter } : undefined,
          include: {
            competition: true,
            team: true,
          },
          orderBy: { joinedAt: 'desc' },
        },
        scores: {
          where: groupCompFilter ? { competition: groupCompFilter } : undefined,
          include: {
            competitionChallenge: { include: { challenge: true, competition: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        trophies: {
          where: isOtherUser && callerGroupIds.length > 0
            ? { groupId: { in: callerGroupIds } }
            : undefined,
          orderBy: { sentAt: 'desc' },
        },
      },
    })

    if (!user) return reply.status(404).send({ error: 'User not found' })
    return { user }
  })

  app.put('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: GlobalRole }

    if (me.id !== id && me.role !== GlobalRole.ADMIN) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const body = updateUserSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    const { password, globalRole, ...rest } = body.data

    if (globalRole !== undefined && me.role !== GlobalRole.ADMIN) {
      return reply.status(403).send({ error: 'Only admins can change roles' })
    }

    const data: Record<string, unknown> = { ...rest }
    if (globalRole !== undefined) data.globalRole = globalRole
    if (password) {
      const err = validatePassword(password)
      if (err) return reply.status(400).send({ error: err })
      data.passwordHash = await hashPassword(password)
    }

    const user = await prisma.user.update({ where: { id }, data, select: userSelect })
    return { user }
  })

  app.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string }

    if (id === me.id) return reply.status(400).send({ error: 'Cannot delete your own account' })

    await prisma.$transaction(async tx => {
      // Reassign competitions/scores this user created so data isn't lost
      await tx.competition.updateMany({ where: { createdByUserId: id }, data: { createdByUserId: me.id } })
      await tx.score.updateMany({ where: { enteredByUserId: id }, data: { enteredByUserId: me.id } })
      // Clear team leadership
      await tx.team.updateMany({ where: { leaderUserId: id }, data: { leaderUserId: null } })
      // Remove from all competitions and delete their own scores
      await tx.competitionPlayer.deleteMany({ where: { userId: id } })
      await tx.score.deleteMany({ where: { userId: id } })
      await tx.user.delete({ where: { id } })
    })

    return { success: true }
  })

  app.post('/:id/generate-image', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: GlobalRole }
    const body = request.body as { prompt?: string }

    if (me.id !== id && me.role !== GlobalRole.ADMIN) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { username: true } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const prompt = body.prompt ?? DEFAULT_PROMPTS.profile
    const result = await generateImage({ prompt }, 'profiles')
    const updated = await prisma.user.update({
      where: { id },
      data: { profileImageUrl: result.publicUrl },
      select: userSelect,
    })

    return { user: updated, imageUrl: result.publicUrl }
  })
}
