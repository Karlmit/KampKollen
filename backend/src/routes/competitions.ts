import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GlobalRole } from '@prisma/client'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, optionalAuth } from '../middleware/auth.js'
import { generateImage, DEFAULT_PROMPTS, generateRandomProfileImage } from '../lib/imageGeneration.js'
import { hashPassword, validateUsername } from '../lib/auth.js'
import { preGenerateTrophies, awardCompetitionTrophies } from '../lib/awardTrophies.js'

const scoringModeEnum = z.enum(['raw_sum', 'placement_points'])
const tieBreakingModeEnum = z.enum(['best_rank', 'average', 'worst_rank'])

const createCompetitionSchema = z.object({
  name: z.string().min(1).max(128),
  date: z.string().datetime().optional(),
  scoringMode: scoringModeEnum.optional(),
  placementMaxPoints: z.number().int().min(10).max(1000).optional(),
  tieBreakingMode: tieBreakingModeEnum.optional(),
  isTeamCompetition: z.boolean().optional(),
  groupId: z.string().optional(),
  challengeIds: z.array(z.string()).optional(),
  teamCount: z.number().int().min(1).max(20).optional(),
  teamNames: z.array(z.string()).optional(),
})

const updateCompetitionSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  date: z.string().datetime().nullable().optional(),
  status: z.enum(['DRAFT', 'REGISTRATION', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  scoringMode: scoringModeEnum.optional(),
  placementMaxPoints: z.number().int().min(10).max(1000).nullable().optional(),
  tieBreakingMode: tieBreakingModeEnum.nullable().optional(),
  isTeamCompetition: z.boolean().optional(),
})

const addChallengeSchema = z.object({
  challengeId: z.string(),
  order: z.number().int().optional(),
  scoreTypeOverride: z.string().optional(),
  teamScoreModeOverride: z.string().optional(),
  bestNPlayersOverride: z.number().int().optional(),
})

async function getUserGroupIds(userId: string): Promise<string[]> {
  const memberships = await prisma.userGroup.findMany({ where: { userId }, select: { groupId: true } })
  return memberships.map(m => m.groupId)
}

// Competitions a member is automatically enrolled into (no manual join required).
const AUTO_ENROLL_STATUSES = ['REGISTRATION', 'ACTIVE']

// Ensure every member of a competition's group has a CompetitionPlayer row, i.e.
// sits in the player pool as an unassigned player. Group membership *is* enrollment
// for team competitions, so members don't actively join. Individual competitions still
// require an explicit join, so they are skipped. Idempotent and safe to call on every read.
async function ensureGroupPlayers(competitionId: string, groupId: string | null, status: string, isTeamCompetition: boolean): Promise<void> {
  if (!groupId || !AUTO_ENROLL_STATUSES.includes(status) || isTeamCompetition === false) return
  const [members, existing] = await Promise.all([
    prisma.userGroup.findMany({ where: { groupId }, select: { userId: true } }),
    prisma.competitionPlayer.findMany({ where: { competitionId }, select: { userId: true } }),
  ])
  const existingIds = new Set(existing.map(e => e.userId))
  const toAdd = members.filter(m => !existingIds.has(m.userId))
  if (toAdd.length === 0) return
  await prisma.competitionPlayer.createMany({
    data: toAdd.map(m => ({ competitionId, userId: m.userId })),
    skipDuplicates: true,
  })
}

export async function competitionRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: optionalAuth }, async (request) => {
    let where: any = {}
    let callerId: string | null = null
    try {
      await request.jwtVerify()
      const me = request.user as { id: string }
      callerId = me.id
      const groupIds = await getUserGroupIds(me.id)
      where = { groupId: { in: groupIds } }
    } catch {
      // Guest: only active competitions
      where = { status: 'ACTIVE' }
    }

    // Auto-enroll group members into the player pool before counting/returning,
    // so the roster and myPlayer flag reflect membership without a manual join.
    if (callerId) {
      const eligible = await prisma.competition.findMany({
        where: { ...where, status: { in: AUTO_ENROLL_STATUSES } },
        select: { id: true, groupId: true, status: true, isTeamCompetition: true },
      })
      await Promise.all(eligible.map(c => ensureGroupPlayers(c.id, c.groupId, c.status, c.isTeamCompetition)))
    }

    const competitions = await prisma.competition.findMany({
      where,
      include: {
        teams: { select: { id: true, name: true } },
        _count: { select: { players: true } },
        ...(callerId ? {
          players: {
            where: { userId: callerId },
            select: { userId: true, isTeamLeader: true, isScorekeeper: true, isReferee: true, isQuizMaster: true, teamId: true },
          },
        } : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    // Flatten myPlayer onto each competition so the frontend can read roles directly
    const result = competitions.map(c => {
      const { players, ...rest } = c as any
      return { ...rest, myPlayer: players?.[0] ?? null }
    })
    return { competitions: result }
  })

  app.get('/:id', { preHandler: optionalAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    // Auto-enroll group members into the player pool before reading, so the
    // viewer (and everyone in the group) appears as an unassigned player.
    const meta = await prisma.competition.findUnique({ where: { id }, select: { groupId: true, status: true, isTeamCompetition: true } })
    if (!meta) return reply.status(404).send({ error: 'Competition not found' })
    await ensureGroupPlayers(id, meta.groupId, meta.status, meta.isTeamCompetition)

    const competition = await prisma.competition.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            leader: { select: { id: true, username: true, displayName: true } },
            players: {
              include: { user: { select: { id: true, username: true, displayName: true, profileImageUrl: true, isDummy: true } } },
            },
          },
        },
        challenges: {
          include: {
            challenge: true,
            quizSession: { select: { id: true, status: true } },
          },
          orderBy: { order: 'asc' },
        },
        players: {
          include: {
            user: { select: { id: true, username: true, displayName: true, profileImageUrl: true, isDummy: true } },
            team: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!competition) return reply.status(404).send({ error: 'Competition not found' })

    // Access control: authenticated users must be in the competition's group
    try {
      await request.jwtVerify()
      const me = request.user as { id: string; role: string }
      if (me.role !== 'ADMIN' && competition.groupId) {
        const groupIds = await getUserGroupIds(me.id)
        if (!groupIds.includes(competition.groupId)) {
          return reply.status(403).send({ error: 'Access denied' })
        }
      }
    } catch {
      // Guest: only active competitions visible
      if (competition.status !== 'ACTIVE') {
        return reply.status(403).send({ error: 'Access denied' })
      }
    }

    return { competition }
  })

  app.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const body = createCompetitionSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    const me = request.user as { id: string }
    const { name, date, scoringMode, placementMaxPoints, tieBreakingMode, isTeamCompetition, groupId, challengeIds, teamCount, teamNames } = body.data

    const isTeamComp = isTeamCompetition !== false  // default true
    const competition = await prisma.competition.create({
      data: {
        name,
        createdByUserId: me.id,
        ...(date && { date: new Date(date) }),
        ...(scoringMode && { scoringMode }),
        ...(placementMaxPoints !== undefined && { placementMaxPoints }),
        ...(tieBreakingMode !== undefined && { tieBreakingMode }),
        isTeamCompetition: isTeamComp,
        ...(groupId && { groupId }),
      },
    })

    if (challengeIds?.length) {
      await prisma.competitionChallenge.createMany({
        data: challengeIds.map((challengeId, i) => ({
          competitionId: competition.id,
          challengeId,
          order: i,
        })),
      })
    }

    if (isTeamComp) {
      const count = teamCount ?? 3
      const names = teamNames ?? Array.from({ length: count }, (_, i) => `Team ${i + 1}`)
      await prisma.team.createMany({
        data: names.slice(0, count).map(teamName => ({
          competitionId: competition.id,
          name: teamName,
        })),
      })
    }

    const full = await prisma.competition.findUnique({
      where: { id: competition.id },
      include: { teams: true, challenges: { include: { challenge: true } } },
    })
    return reply.status(201).send({ competition: full })
  })

  app.put('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updateCompetitionSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    const { date, ...rest } = body.data

    let oldStatus: string | undefined
    if (rest.status) {
      const old = await prisma.competition.findUnique({ where: { id }, select: { status: true } })
      oldStatus = old?.status
    }

    const competition = await prisma.competition.update({
      where: { id },
      data: { ...rest, ...(date !== undefined ? { date: date ? new Date(date) : null } : {}) },
    })

    if (rest.status && oldStatus && oldStatus !== rest.status) {
      if (oldStatus === 'REGISTRATION' && rest.status === 'ACTIVE') {
        preGenerateTrophies(id).catch(err => console.error('[awards] pre-generate error:', err))
      } else if (oldStatus === 'ACTIVE' && rest.status === 'COMPLETED') {
        awardCompetitionTrophies(id).catch(err => console.error('[awards] award error:', err))
      }
    }

    return { competition }
  })

  app.post('/:id/generate-image', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { prompt?: string }
    const competition = await prisma.competition.findUnique({ where: { id } })
    if (!competition) return reply.status(404).send({ error: 'Competition not found' })

    const prompt = body.prompt ?? DEFAULT_PROMPTS.competition(competition.name)
    const result = await generateImage({ prompt }, 'competitions')
    const updated = await prisma.competition.update({ where: { id }, data: { imageUrl: result.publicUrl } })
    return { competition: updated, imageUrl: result.publicUrl }
  })

  app.post('/:id/challenges', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = addChallengeSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    const cc = await prisma.competitionChallenge.create({
      data: { competitionId: id, ...body.data } as any,
      include: { challenge: true },
    })
    return reply.status(201).send({ competitionChallenge: cc })
  })

  // Add a quiz to a competition by cloning a template or creating a fresh one.
  // The clone is competition-specific (isGlobalTemplate: false) so the template
  // has no direct FK link to the competition and can be safely deleted later.
  app.post('/:id/challenges/quiz', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = z.object({
      templateId: z.string().optional(),
      name: z.string().min(1).max(128).optional(),
    }).refine(d => d.templateId || d.name, { message: 'templateId or name is required' })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    const comp = await prisma.competition.findUnique({
      where: { id },
      include: { challenges: { select: { order: true } } },
    })
    if (!comp) return reply.status(404).send({ error: 'Competition not found' })

    const maxOrder = comp.challenges.length > 0
      ? Math.max(...comp.challenges.map((c: any) => c.order))
      : -1

    let newTemplate: any = null
    let cloneData: any

    if (body.data.templateId) {
      const template = await prisma.challenge.findUnique({
        where: { id: body.data.templateId },
        include: {
          quizQuestions: {
            include: {
              options: { orderBy: { order: 'asc' } },
              fields: { orderBy: { order: 'asc' } },
            },
            orderBy: { order: 'asc' },
          },
        },
      })
      if (!template) return reply.status(404).send({ error: 'Template not found' })

      cloneData = {
        name: template.name,
        description: template.description ?? undefined,
        scoreType: template.scoreType,
        defaultTeamScoreMode: template.defaultTeamScoreMode,
        bestNPlayers: template.bestNPlayers ?? undefined,
        isGlobalTemplate: false,
        isQuiz: true,
        quizQuestions: {
          create: template.quizQuestions.map((q: any) => ({
            text: q.text,
            description: q.description ?? undefined,
            points: q.points,
            timerSeconds: q.timerSeconds,
            isFreeText: q.isFreeText,
            order: q.order,
            imageUrl: q.imageUrl ?? undefined,
            options: {
              create: q.options.map((o: any) => ({
                text: o.text,
                isCorrect: o.isCorrect,
                order: o.order,
                imageUrl: o.imageUrl ?? undefined,
              })),
            },
            fields: {
              create: q.fields.map((f: any) => ({
                label: f.label,
                points: f.points,
                order: f.order,
              })),
            },
          })),
        },
      }
    } else {
      // Create a new persistent template (so admin can reuse it later)
      newTemplate = await prisma.challenge.create({
        data: {
          name: body.data.name!,
          isGlobalTemplate: true,
          isQuiz: true,
          scoreType: 'manual_points',
          defaultTeamScoreMode: 'sum_all_players',
        },
      })
      // Clone is initially empty (admin edits questions via quiz editor)
      cloneData = {
        name: body.data.name!,
        isGlobalTemplate: false,
        isQuiz: true,
        scoreType: 'manual_points',
        defaultTeamScoreMode: 'sum_all_players',
      }
    }

    const clone = await prisma.challenge.create({ data: cloneData })

    const cc = await prisma.competitionChallenge.create({
      data: { competitionId: id, challengeId: clone.id, order: maxOrder + 1 },
      include: { challenge: true },
    })

    return reply.status(201).send({ competitionChallenge: cc, template: newTemplate })
  })

  app.delete('/:id/challenges/:challengeId', { preHandler: requireAdmin }, async (request) => {
    const { id, challengeId } = request.params as { id: string; challengeId: string }
    await prisma.competitionChallenge.deleteMany({
      where: { competitionId: id, challengeId },
    })
    return { success: true }
  })

  app.put('/:id/challenges/reorder', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { order } = request.body as { order: string[] }
    if (!Array.isArray(order)) return reply.status(400).send({ error: 'order must be an array' })
    await Promise.all(order.map((ccId, i) =>
      prisma.competitionChallenge.updateMany({
        where: { id: ccId, competitionId: id },
        data: { order: i },
      })
    ))
    return { success: true }
  })

  app.post('/:id/join', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string }

    const competition = await prisma.competition.findUnique({ where: { id } })
    if (!competition) return reply.status(404).send({ error: 'Competition not found' })
    if (!['REGISTRATION', 'ACTIVE'].includes(competition.status)) {
      return reply.status(400).send({ error: 'Competition is not open for registration' })
    }
    if (competition.groupId) {
      const groupIds = await getUserGroupIds(me.id)
      if (!groupIds.includes(competition.groupId)) {
        return reply.status(403).send({ error: 'You are not a member of this competition\'s group' })
      }
    }

    const existing = await prisma.competitionPlayer.findUnique({
      where: { competitionId_userId: { competitionId: id, userId: me.id } },
    })
    if (existing) return reply.status(409).send({ error: 'Already joined this competition' })

    const player = await prisma.competitionPlayer.create({
      data: { competitionId: id, userId: me.id },
      include: { user: { select: { id: true, username: true, displayName: true } } },
    })
    return reply.status(201).send({ player })
  })

  app.post('/:id/players', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { userId: string; teamId?: string; isTeamLeader?: boolean; isScorekeeper?: boolean; isReferee?: boolean }

    const existing = await prisma.competitionPlayer.findUnique({
      where: { competitionId_userId: { competitionId: id, userId: body.userId } },
    })
    if (existing) return reply.status(409).send({ error: 'Player already in competition' })

    const player = await prisma.competitionPlayer.create({
      data: {
        competitionId: id,
        userId: body.userId,
        teamId: body.teamId ?? null,
        isTeamLeader: body.isTeamLeader ?? false,
        isScorekeeper: body.isScorekeeper ?? false,
        isReferee: body.isReferee ?? false,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        team: { select: { id: true, name: true } },
      },
    })
    return reply.status(201).send({ player })
  })

  app.put('/:id/players/:userId', { preHandler: requireAuth }, async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string }
    const me = request.user as { id: string; role: GlobalRole }
    const body = request.body as { teamId?: string | null; isTeamLeader?: boolean; isScorekeeper?: boolean; isReferee?: boolean; isQuizMaster?: boolean }

    if (me.role !== GlobalRole.ADMIN) {
      const myPlayer = await prisma.competitionPlayer.findUnique({
        where: { competitionId_userId: { competitionId: id, userId: me.id } },
      })
      if (!myPlayer?.isTeamLeader) {
        return reply.status(403).send({ error: 'Admin access required' })
      }
      if (body.teamId !== undefined || body.isTeamLeader !== undefined || body.isReferee !== undefined || body.isQuizMaster !== undefined) {
        return reply.status(403).send({ error: 'Only admins can change team assignment, leader, referee, or QM status' })
      }
      const targetPlayer = await prisma.competitionPlayer.findUnique({
        where: { competitionId_userId: { competitionId: id, userId } },
      })
      if (!targetPlayer || targetPlayer.teamId !== myPlayer.teamId) {
        return reply.status(403).send({ error: 'Can only manage scorekeepers on your own team' })
      }
    }

    const player = await prisma.competitionPlayer.update({
      where: { competitionId_userId: { competitionId: id, userId } },
      data: body,
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        team: { select: { id: true, name: true } },
      },
    })
    return { player }
  })

  app.delete('/:id/players/:userId', { preHandler: requireAdmin }, async (request) => {
    const { id, userId } = request.params as { id: string; userId: string }
    await prisma.competitionPlayer.delete({
      where: { competitionId_userId: { competitionId: id, userId } },
    })
    return { success: true }
  })

  // ── Dummy / guest player endpoints ─────────────────────────────────────────

  app.post('/:id/players/dummy', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: string }
    const body = request.body as { name?: string; teamId?: string }

    if (!body.name?.trim()) return reply.status(400).send({ error: 'Name is required' })

    // Permission: admin, or team leader in this competition
    if (me.role !== 'ADMIN') {
      const myPlayer = await prisma.competitionPlayer.findUnique({
        where: { competitionId_userId: { competitionId: id, userId: me.id } },
      })
      if (!myPlayer?.isTeamLeader) {
        return reply.status(403).send({ error: 'Only admins and team leaders can add guest players' })
      }
      // Team leaders can only add to their own team (or pool if no teamId)
      if (body.teamId && myPlayer.teamId !== body.teamId) {
        return reply.status(403).send({ error: 'You can only add players to your own team' })
      }
    }

    const comp = await prisma.competition.findUnique({ where: { id } })
    if (!comp) return reply.status(404).send({ error: 'Competition not found' })

    // Create a dummy User and immediately add as competition player
    const dummyUsername = `_guest_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`
    const user = await prisma.user.create({
      data: {
        username: dummyUsername,
        displayName: body.name.trim(),
        isDummy: true,
        globalRole: 'PLAYER',
      },
    })

    const player = await prisma.competitionPlayer.create({
      data: {
        competitionId: id,
        userId: user.id,
        teamId: body.teamId ?? null,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, profileImageUrl: true, isDummy: true } },
        team: { select: { id: true, name: true } },
      },
    })

    return { player }
  })

  // Create a real user (with a default PIN) and add them straight to a team.
  // The new user automatically joins the competition's group, so admins/team
  // leaders can onboard players without the convert dance.
  app.post('/:id/players/create-user', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: string }
    const body = request.body as { name?: string; username?: string; teamId?: string }

    if (!body.name?.trim()) return reply.status(400).send({ error: 'Name is required' })
    if (!body.username?.trim()) return reply.status(400).send({ error: 'Username is required' })

    const username = body.username.trim()
    const usernameError = validateUsername(username)
    if (usernameError) return reply.status(400).send({ error: usernameError })

    // Permission: admin, or team leader in this competition
    if (me.role !== 'ADMIN') {
      const myPlayer = await prisma.competitionPlayer.findUnique({
        where: { competitionId_userId: { competitionId: id, userId: me.id } },
      })
      if (!myPlayer?.isTeamLeader) {
        return reply.status(403).send({ error: 'Only admins and team leaders can create users' })
      }
      // Team leaders can only add to their own team (or pool if no teamId)
      if (body.teamId && myPlayer.teamId !== body.teamId) {
        return reply.status(403).send({ error: 'You can only add players to your own team' })
      }
    }

    const comp = await prisma.competition.findUnique({ where: { id } })
    if (!comp) return reply.status(404).send({ error: 'Competition not found' })

    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) return reply.status(409).send({ error: 'Username already taken' })

    // Real user with the default PIN. They auto-join the competition's group so
    // they immediately have access to it.
    const passwordHash = await hashPassword('1234')
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        displayName: body.name.trim(),
        globalRole: 'PLAYER',
        ...(comp.groupId ? { groups: { create: { groupId: comp.groupId } } } : {}),
      },
    })

    const player = await prisma.competitionPlayer.create({
      data: {
        competitionId: id,
        userId: user.id,
        teamId: body.teamId ?? null,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, profileImageUrl: true, isDummy: true } },
        team: { select: { id: true, name: true } },
      },
    })

    // Fire-and-forget: generate a profile image in the background
    generateRandomProfileImage(user.id).catch(() => {})

    return { player }
  })

  app.post('/:id/players/dummy/:dummyUserId/convert', { preHandler: requireAuth }, async (request, reply) => {
    const { id, dummyUserId } = request.params as { id: string; dummyUserId: string }
    const me = request.user as { id: string; role: string }
    const body = request.body as { realUserId: string }

    if (!body.realUserId) return reply.status(400).send({ error: 'realUserId is required' })

    // Permission check
    if (me.role !== 'ADMIN') {
      const myPlayer = await prisma.competitionPlayer.findUnique({
        where: { competitionId_userId: { competitionId: id, userId: me.id } },
      })
      if (!myPlayer?.isTeamLeader) return reply.status(403).send({ error: 'Only admins and team leaders can convert guest players' })
    }

    const dummyUser = await prisma.user.findUnique({ where: { id: dummyUserId } })
    if (!dummyUser?.isDummy) return reply.status(400).send({ error: 'Player is not a guest player' })

    const dummyPlayer = await prisma.competitionPlayer.findUnique({
      where: { competitionId_userId: { competitionId: id, userId: dummyUserId } },
    })
    if (!dummyPlayer) return reply.status(404).send({ error: 'Guest player not found in this competition' })

    // Ensure real user exists
    const realUser = await prisma.user.findUnique({ where: { id: body.realUserId } })
    if (!realUser || realUser.isDummy) return reply.status(400).send({ error: 'Invalid real user' })

    // Scores the dummy has (for conflict detection)
    const dummyScores = await prisma.score.findMany({
      where: { competitionId: id, userId: dummyUserId },
      select: { id: true, competitionChallengeId: true },
    })

    await prisma.$transaction(async tx => {
      // Delete any conflicting scores the real player already has in same challenges
      if (dummyScores.length > 0) {
        const challengeIds = dummyScores.map(s => s.competitionChallengeId)
        await tx.score.deleteMany({
          where: { competitionId: id, userId: body.realUserId, competitionChallengeId: { in: challengeIds } },
        })
        // Transfer dummy's scores to real user
        await tx.score.updateMany({
          where: { competitionId: id, userId: dummyUserId },
          data: { userId: body.realUserId },
        })
      }

      // Ensure real player is in the competition
      const existingRealPlayer = await tx.competitionPlayer.findUnique({
        where: { competitionId_userId: { competitionId: id, userId: body.realUserId } },
      })
      if (existingRealPlayer) {
        // Move real player to dummy's team
        await tx.competitionPlayer.update({
          where: { competitionId_userId: { competitionId: id, userId: body.realUserId } },
          data: { teamId: dummyPlayer.teamId, isTeamLeader: dummyPlayer.isTeamLeader, isScorekeeper: dummyPlayer.isScorekeeper, isReferee: dummyPlayer.isReferee },
        })
      } else {
        await tx.competitionPlayer.create({
          data: {
            competitionId: id,
            userId: body.realUserId,
            teamId: dummyPlayer.teamId,
            isTeamLeader: dummyPlayer.isTeamLeader,
            isScorekeeper: dummyPlayer.isScorekeeper,
            isReferee: dummyPlayer.isReferee,
          },
        })
      }

      // Remove dummy from competition and delete dummy user
      await tx.competitionPlayer.delete({
        where: { competitionId_userId: { competitionId: id, userId: dummyUserId } },
      })
      await tx.user.delete({ where: { id: dummyUserId } })
    })

    return { success: true }
  })
}
