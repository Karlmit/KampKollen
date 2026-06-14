import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GlobalRole } from '@prisma/client'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { generateImage, DEFAULT_PROMPTS } from '../lib/imageGeneration.js'

const createTeamSchema = z.object({
  name: z.string().min(1).max(64),
  leaderUserId: z.string().optional(),
})

const updateTeamSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  leaderUserId: z.string().optional().nullable(),
})

async function canManageTeam(
  teamId: string,
  userId: string,
  userRole: GlobalRole
): Promise<boolean> {
  if (userRole === GlobalRole.ADMIN) return true
  const team = await prisma.team.findUnique({ where: { id: teamId } })
  if (!team) return false
  if (team.leaderUserId === userId) return true
  const cp = await prisma.competitionPlayer.findUnique({
    where: { competitionId_userId: { competitionId: team.competitionId, userId } },
  })
  return cp?.isTeamLeader === true && cp.teamId === teamId
}

export async function teamRoutes(app: FastifyInstance) {
  app.get('/competition/:competitionId', { preHandler: requireAuth }, async (request) => {
    const { competitionId } = request.params as { competitionId: string }
    const teams = await prisma.team.findMany({
      where: { competitionId },
      include: {
        leader: { select: { id: true, username: true, displayName: true } },
        players: {
          include: {
            user: { select: { id: true, username: true, displayName: true, profileImageUrl: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })
    return { teams }
  })

  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        leader: { select: { id: true, username: true, displayName: true } },
        players: {
          include: {
            user: { select: { id: true, username: true, displayName: true, profileImageUrl: true } },
          },
        },
        competition: true,
      },
    })
    if (!team) return reply.status(404).send({ error: 'Team not found' })
    return { team }
  })

  app.post('/competition/:competitionId', { preHandler: requireAdmin }, async (request, reply) => {
    const { competitionId } = request.params as { competitionId: string }
    const body = createTeamSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    const team = await prisma.team.create({
      data: { competitionId, ...body.data },
      include: { leader: { select: { id: true, username: true } } },
    })
    return reply.status(201).send({ team })
  })

  app.put('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: GlobalRole }
    const body = updateTeamSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    if (!(await canManageTeam(id, me.id, me.role))) {
      return reply.status(403).send({ error: 'Not authorized to manage this team' })
    }

    // Only admins can change the leader
    const data: Record<string, unknown> = {}
    if (body.data.name !== undefined) data.name = body.data.name
    if (body.data.leaderUserId !== undefined && me.role === GlobalRole.ADMIN) {
      data.leaderUserId = body.data.leaderUserId
    }

    const team = await prisma.team.update({ where: { id }, data, include: { leader: true } })
    return { team }
  })

  app.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const team = await prisma.team.findUnique({ where: { id } })
    if (!team) return reply.status(404).send({ error: 'Team not found' })

    // Send any members back to the player pool (keeping them in the competition
    // and keeping their scores, which are tied to the user, not the team) before
    // removing the team.
    await prisma.$transaction([
      prisma.competitionPlayer.updateMany({
        where: { teamId: id },
        data: { teamId: null, isTeamLeader: false },
      }),
      prisma.team.delete({ where: { id } }),
    ])
    return { success: true }
  })

  // Add player to team
  app.post('/:id/players', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: GlobalRole }
    const body = request.body as { userId: string }

    const team = await prisma.team.findUnique({ where: { id } })
    if (!team) return reply.status(404).send({ error: 'Team not found' })

    if (!(await canManageTeam(id, me.id, me.role))) {
      return reply.status(403).send({ error: 'Not authorized to manage this team' })
    }

    const cp = await prisma.competitionPlayer.findUnique({
      where: { competitionId_userId: { competitionId: team.competitionId, userId: body.userId } },
    })
    if (!cp) return reply.status(404).send({ error: 'Player not in this competition' })

    const updated = await prisma.competitionPlayer.update({
      where: { competitionId_userId: { competitionId: team.competitionId, userId: body.userId } },
      data: { teamId: id },
      include: { user: { select: { id: true, username: true, displayName: true, profileImageUrl: true } } },
    })
    return { player: updated }
  })

  // Remove player from team (sends back to player pool)
  app.delete('/:id/players/:userId', { preHandler: requireAuth }, async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string }
    const me = request.user as { id: string; role: GlobalRole }

    const team = await prisma.team.findUnique({ where: { id } })
    if (!team) return reply.status(404).send({ error: 'Team not found' })

    if (!(await canManageTeam(id, me.id, me.role))) {
      return reply.status(403).send({ error: 'Not authorized to manage this team' })
    }

    // Remove from team but keep in competition (player pool) and keep scores
    await prisma.competitionPlayer.update({
      where: { competitionId_userId: { competitionId: team.competitionId, userId } },
      data: { teamId: null, isTeamLeader: false },
    })
    return { success: true }
  })

  app.post('/:id/generate-image', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: GlobalRole }
    const body = request.body as { prompt?: string }

    const team = await prisma.team.findUnique({ where: { id } })
    if (!team) return reply.status(404).send({ error: 'Team not found' })

    if (!(await canManageTeam(id, me.id, me.role))) {
      return reply.status(403).send({ error: 'Not authorized to manage this team' })
    }

    const prompt = body.prompt ?? DEFAULT_PROMPTS.team(team.name)
    const result = await generateImage({ prompt }, 'teams')
    const updated = await prisma.team.update({
      where: { id },
      data: { imageUrl: result.publicUrl },
    })
    return { team: updated, imageUrl: result.publicUrl }
  })
}
