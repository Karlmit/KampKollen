import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { GlobalRole } from '@prisma/client'
import { getRegistrationConfig } from './settings.js'

export async function groupRoutes(app: FastifyInstance) {
  // List groups — admin sees all with member counts, player sees only their own
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const me = request.user as { id: string; role: GlobalRole }
    if (me.role === GlobalRole.ADMIN) {
      const groups = await prisma.group.findMany({
        include: { _count: { select: { members: true, competitions: true } } },
        orderBy: { name: 'asc' },
      })
      return { groups }
    }
    const groups = await prisma.group.findMany({
      where: { members: { some: { userId: me.id } } },
      include: { _count: { select: { members: true, competitions: true } } },
      orderBy: { name: 'asc' },
    })
    return { groups }
  })

  // Public list of group names for registration (no auth required).
  // Also exposes whether single-group registration mode is active, so the
  // sign-up page can skip the group chooser and auto-assign the set group.
  app.get('/public', async () => {
    const [groups, registration] = await Promise.all([
      prisma.group.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      getRegistrationConfig(),
    ])
    return { groups, ...registration }
  })

  // Create group — admin only
  app.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const body = z.object({ name: z.string().min(1).max(64) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })
    const existing = await prisma.group.findUnique({ where: { name: body.data.name } })
    if (existing) return reply.status(409).send({ error: 'Group name already exists' })
    const group = await prisma.group.create({ data: { name: body.data.name } })
    return reply.status(201).send({ group })
  })

  // List members of a group — admin only
  app.get('/:id/members', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const members = await prisma.userGroup.findMany({
      where: { groupId: id },
      include: { user: { select: { id: true, username: true, displayName: true, profileImageUrl: true, globalRole: true } } },
      orderBy: { user: { displayName: 'asc' } },
    })
    return { members: members.map(m => m.user) }
  })

  // Add member to group — admin only
  app.post('/:id/members', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = z.object({ userId: z.string() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'userId required' })
    await prisma.userGroup.upsert({
      where: { userId_groupId: { userId: body.data.userId, groupId: id } },
      create: { userId: body.data.userId, groupId: id },
      update: {},
    })
    return { success: true }
  })

  // Remove member from group — admin only
  app.delete('/:id/members/:userId', { preHandler: requireAdmin }, async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string }
    await prisma.userGroup.deleteMany({ where: { groupId: id, userId } })
    return { success: true }
  })
}
