import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { GlobalRole, TeamScoreMode } from '@prisma/client'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, optionalAuth } from '../middleware/auth.js'
import path from 'path'
import fs from 'fs'
import { config } from '../config.js'
import { generateImage } from '../lib/imageGeneration.js'

// ── SSE broadcast ─────────────────────────────────────────────────────────────
const sseClients = new Map<string, Set<FastifyReply>>()

// In-memory countdown state (5-second window — no need to persist to DB)
const countdownMap = new Map<string, number>() // ccId → endsAt (unix ms)

function broadcast(ccId: string) {
  const clients = sseClients.get(ccId)
  if (!clients) return
  const msg = 'event: quiz-update\ndata: {}\n\n'
  for (const reply of clients) {
    try { reply.raw.write(msg) } catch { /* closed */ }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getOrCreateSession(ccId: string) {
  return prisma.quizSession.upsert({
    where: { competitionChallengeId: ccId },
    create: { competitionChallengeId: ccId },
    update: {},
  })
}

// QM check by ccId: only isQuizMaster flag, no admin bypass.
async function isQM(userId: string, ccId: string): Promise<boolean> {
  const cc = await prisma.competitionChallenge.findUnique({ where: { id: ccId }, select: { competitionId: true } })
  if (!cc) return false
  const player = await prisma.competitionPlayer.findUnique({
    where: { competitionId_userId: { competitionId: cc.competitionId, userId } },
    select: { isQuizMaster: true },
  })
  return player?.isQuizMaster ?? false
}

// Edit access: admin OR a QM in any competition that uses this challenge.
async function canEditQuiz(userId: string, role: string, challengeId: string): Promise<boolean> {
  if (role === GlobalRole.ADMIN) return true
  const ccs = await prisma.competitionChallenge.findMany({
    where: { challengeId },
    select: { competitionId: true },
  })
  for (const cc of ccs) {
    const player = await prisma.competitionPlayer.findUnique({
      where: { competitionId_userId: { competitionId: cc.competitionId, userId } },
      select: { isQuizMaster: true },
    })
    if (player?.isQuizMaster) return true
  }
  return false
}

// Resolve challengeId from an option id (option → question → challenge)
async function challengeIdFromOption(optionId: string): Promise<string | null> {
  const opt = await prisma.quizOption.findUnique({ where: { id: optionId }, select: { question: { select: { challengeId: true } } } })
  return opt?.question?.challengeId ?? null
}

// Resolve challengeId from a question id
async function challengeIdFromQuestion(questionId: string): Promise<string | null> {
  const q = await prisma.quizQuestion.findUnique({ where: { id: questionId }, select: { challengeId: true } })
  return q?.challengeId ?? null
}

// Best-effort delete of a stored upload from disk. Handles both the upload
// ("/uploads/quiz/…") and generated ("uploads/quiz/…") forms; ignores remote
// placeholder URLs and missing files.
function removeStoredImage(imageUrl: string | null | undefined) {
  if (!imageUrl) return
  const rel = imageUrl.replace(/^\/?uploads\//, '')
  if (rel === imageUrl) return // not an uploads/ path (e.g. https placeholder)
  try { fs.unlinkSync(path.join(config.uploadsDir, rel)) } catch { /* already gone */ }
}

async function computeAndSaveScores(ccId: string, actorId: string) {
  const cc = await prisma.competitionChallenge.findUnique({
    where: { id: ccId },
    include: {
      competition: { include: { players: true, teams: true } },
      challenge: { include: { quizQuestions: { include: { options: true, answers: true } } } },
    },
  })
  if (!cc) return

  const isTeamComp = cc.competition.isTeamCompetition

  // Accumulate points per player or team
  const teamPoints: Record<string, number> = {}
  const playerPoints: Record<string, number> = {}

  for (const question of cc.challenge.quizQuestions) {
    if (question.isFreeText) {
      // Free text: use QM-awarded freeTextPoints
      for (const answer of question.answers) {
        const pts = answer.freeTextPoints ?? 0
        if (pts <= 0) continue
        if (isTeamComp && answer.teamId) {
          teamPoints[answer.teamId] = (teamPoints[answer.teamId] ?? 0) + pts
        } else if (!isTeamComp && answer.userId) {
          playerPoints[answer.userId] = (playerPoints[answer.userId] ?? 0) + pts
        }
      }
    } else {
      const correctOptionIds = new Set(question.options.filter(o => o.isCorrect).map(o => o.id))
      for (const answer of question.answers) {
        if (!answer.optionId || !correctOptionIds.has(answer.optionId)) continue
        if (isTeamComp && answer.teamId) {
          teamPoints[answer.teamId] = (teamPoints[answer.teamId] ?? 0) + question.points
        } else if (!isTeamComp && answer.userId) {
          playerPoints[answer.userId] = (playerPoints[answer.userId] ?? 0) + question.points
        }
      }
    }
  }

  if (isTeamComp) {
    // Store score for every non-dummy player in each team
    for (const [teamId, pts] of Object.entries(teamPoints)) {
      const members = cc.competition.players.filter(p => p.teamId === teamId)
      for (const member of members) {
        await prisma.score.upsert({
          where: { competitionChallengeId_userId: { competitionChallengeId: ccId, userId: member.userId } },
          create: { competitionId: cc.competitionId, competitionChallengeId: ccId, userId: member.userId, rawScore: pts, calculatedPoints: pts, enteredByUserId: actorId },
          update: { rawScore: pts, calculatedPoints: pts, enteredByUserId: actorId },
        })
      }
    }
    // Update CompetitionChallenge to use average_score so all same-score members → correct team total
    await prisma.competitionChallenge.update({
      where: { id: ccId },
      data: { teamScoreModeOverride: TeamScoreMode.average_score, scoreTypeOverride: 'manual_points' },
    })
  } else {
    for (const [userId, pts] of Object.entries(playerPoints)) {
      await prisma.score.upsert({
        where: { competitionChallengeId_userId: { competitionChallengeId: ccId, userId } },
        create: { competitionId: cc.competitionId, competitionChallengeId: ccId, userId, rawScore: pts, calculatedPoints: pts, enteredByUserId: actorId },
        update: { rawScore: pts, calculatedPoints: pts, enteredByUserId: actorId },
      })
    }
    await prisma.competitionChallenge.update({
      where: { id: ccId },
      data: { scoreTypeOverride: 'manual_points' },
    })
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function quizRoutes(app: FastifyInstance) {

  // ── Challenge questions (admin/QM editor) ──────────────────────────────────
  app.get('/challenge/:challengeId/questions', { preHandler: requireAuth }, async (request, reply) => {
    const { challengeId } = request.params as { challengeId: string }
    const me = request.user as { id: string; role: string }
    if (!await canEditQuiz(me.id, me.role, challengeId)) return reply.status(403).send({ error: 'Admin or Quiz Master required' })
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } })
    if (!challenge) return reply.status(404).send({ error: 'Not found' })
    const questions = await prisma.quizQuestion.findMany({
      where: { challengeId },
      orderBy: { order: 'asc' },
      include: { options: { orderBy: { order: 'asc' } } },
    })
    return { challenge, questions }
  })

  // ── SSE stream ──────────────────────────────────────────────────────────────
  app.get('/:ccId/stream', { preHandler: optionalAuth }, async (request, reply) => {
    const { ccId } = request.params as { ccId: string }
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders()

    if (!sseClients.has(ccId)) sseClients.set(ccId, new Set())
    sseClients.get(ccId)!.add(reply)

    // Send initial ping so the connection confirms
    reply.raw.write('event: connected\ndata: {}\n\n')

    // Keep-alive every 25s
    const keepAlive = setInterval(() => {
      try { reply.raw.write(': ping\n\n') } catch { clearInterval(keepAlive) }
    }, 25_000)

    request.socket.on('close', () => {
      clearInterval(keepAlive)
      sseClients.get(ccId)?.delete(reply)
    })

    // Don't resolve — keep connection open
    await new Promise(() => {})
  })

  // ── Get full quiz state ─────────────────────────────────────────────────────
  app.get('/:ccId/state', { preHandler: optionalAuth }, async (request, reply) => {
    const { ccId } = request.params as { ccId: string }
    // Guests have no user — they see read-only state (isQM=false, canAct=false)
    const me = (request.user as { id: string; role: string } | null) ?? null

    const cc = await prisma.competitionChallenge.findUnique({
      where: { id: ccId },
      include: {
        competition: { include: { players: true, teams: true } },
        challenge: {
          include: {
            quizQuestions: {
              orderBy: { order: 'asc' },
              include: {
                options: { orderBy: { order: 'asc' } },
                answers: { orderBy: { submittedAt: 'asc' } },
              },
            },
          },
        },
        quizSession: { include: { readyEntries: true } },
      },
    })
    if (!cc) return reply.status(404).send({ error: 'Not found' })

    const myPlayer = me ? cc.competition.players.find(p => p.userId === me.id) : null
    const isQM = myPlayer?.isQuizMaster ?? false
    const rawSession = cc.quizSession ?? await getOrCreateSession(ccId)
    const sessionWithReady = await prisma.quizSession.findUnique({ where: { id: rawSession.id }, include: { readyEntries: true } })
    const session = sessionWithReady!
    const isCompleted = session.status === 'COMPLETED'

    // Determine my team (for team competitions)
    const myTeamId = myPlayer?.teamId ?? null
    const isTeamComp = cc.competition.isTeamCompetition

    // Build questions visible to this player based on session state
    const questions = cc.challenge.quizQuestions.map((q, idx) => {
      const isCurrentQuestion = session.status === 'ACTIVE' && idx === session.currentQuestionIndex
      const isPastQuestion = session.status === 'ACTIVE' && idx < session.currentQuestionIndex
      const isCompleted_ = session.status === 'COMPLETED'
      const isCorrecting = session.status === 'CORRECTING'
      const corrIdx = session.correctionIndex
      const isBeingCorrected = isCorrecting && idx === corrIdx
      const isPastCorrection = isCorrecting && idx < corrIdx
      const showAnswers = isCompleted_ || isPastCorrection || (isBeingCorrected && session.correctAnswerVisible)
      const showOptions = isCurrentQuestion || isPastQuestion || isCompleted_ || isCorrecting

      // My answer for this question (me is null for guests)
      const myAnswer = !me ? undefined : isTeamComp
        ? q.answers.find(a => a.teamId === myTeamId)
        : q.answers.find(a => a.userId === me.id)

      // Answer distribution (for QM and correction/completed states)
      const showDistribution = isQM || isBeingCorrected || isPastCorrection || isCompleted_
      const answerCounts = showDistribution
        ? q.options.map(o => ({
            optionId: o.id,
            count: isTeamComp
              ? q.answers.filter(a => a.optionId === o.id && a.teamId).length
              : q.answers.filter(a => a.optionId === o.id && a.userId).length,
            teams: isTeamComp && (isQM || isBeingCorrected || isPastCorrection || isCompleted_)
              ? q.answers.filter(a => a.optionId === o.id && a.teamId).map(a => a.teamId)
              : [],
            users: !isTeamComp && isCompleted_
              ? q.answers.filter(a => a.optionId === o.id && a.userId).map(a => a.userId)
              : [],
          }))
        : []

      // QM sees who has answered
      const answeredTeams = isQM && isTeamComp
        ? q.answers.map(a => a.teamId).filter(Boolean)
        : []
      const answeredUserIds = isQM && !isTeamComp
        ? q.answers.map(a => a.userId).filter(Boolean)
        : []

      // Free text: include submitted answers (for QM and correction/completed states) with their text and points
      const freeTextAnswers = q.isFreeText && (isQM || isBeingCorrected || isPastCorrection || isCompleted_)
        ? q.answers.map(a => ({
            id: a.id,
            freeTextAnswer: a.freeTextAnswer,
            freeTextPoints: a.freeTextPoints,
            freeTextLocked: a.freeTextLocked,
            userId: a.userId,
            teamId: a.teamId,
          }))
        : []

      return {
        id: q.id,
        text: showOptions ? q.text : null,
        imageUrl: showOptions ? q.imageUrl : null,
        points: q.points,
        timerSeconds: q.timerSeconds,
        order: q.order,
        isFreeText: q.isFreeText,
        options: (!q.isFreeText && showOptions) ? q.options.map(o => ({
          id: o.id,
          text: o.text,
          imageUrl: o.imageUrl,
          order: o.order,
          isCorrect: showAnswers ? o.isCorrect : undefined,
        })) : [],
        myOptionId: myAnswer?.optionId ?? null,
        myFreeTextAnswer: q.isFreeText ? (myAnswer?.freeTextAnswer ?? null) : null,
        myFreeTextPoints: q.isFreeText ? (myAnswer?.freeTextPoints ?? null) : null,
        myFreeTextLocked: q.isFreeText ? (myAnswer?.freeTextLocked ?? false) : null,
        answeredTeams,
        answeredUserIds,
        answerCounts,
        freeTextAnswers,
        locked: session.status === 'ACTIVE' && (idx < session.currentQuestionIndex || session.questionLocked),
      }
    })

    return {
      session: {
        id: session.id,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        questionLocked: session.questionLocked,
        correctionIndex: session.correctionIndex,
        correctAnswerVisible: session.correctAnswerVisible,
        lobbyAnnounced: session.lobbyAnnounced,
        readyEntries: session.readyEntries,
        countdownEndsAt: countdownMap.get(ccId) ?? null,
      },
      isQM,
      isTeamComp,
      myTeamId,
      myIsTeamLeader: myPlayer?.isTeamLeader ?? false,
      myIsScorekeeper: myPlayer?.isScorekeeper ?? false,
      challengeId: cc.challenge.id,
      competition: {
        id: cc.competition.id,
        teams: cc.competition.teams,
        players: cc.competition.players,
      },
      questions,
    }
  })

  // ── Question CRUD (admin or QM) ─────────────────────────────────────────────
  app.post('/questions', { preHandler: requireAuth }, async (request, reply) => {
    const me = request.user as { id: string; role: string }
    const body = z.object({
      challengeId: z.string(),
      text: z.string().min(1),
      points: z.number().int().min(1).default(3),
      timerSeconds: z.number().int().min(0).default(0),
      isFreeText: z.boolean().default(false),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })
    if (!await canEditQuiz(me.id, me.role, body.data.challengeId)) return reply.status(403).send({ error: 'Admin or Quiz Master required' })

    const maxOrder = await prisma.quizQuestion.aggregate({ where: { challengeId: body.data.challengeId }, _max: { order: true } })
    const question = await prisma.quizQuestion.create({
      data: { ...body.data, order: (maxOrder._max.order ?? -1) + 1 },
      include: { options: true },
    })
    return reply.status(201).send({ question })
  })

  app.put('/questions/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: string }
    const cid = await challengeIdFromQuestion(id)
    if (!cid || !await canEditQuiz(me.id, me.role, cid)) return reply.status(403).send({ error: 'Admin or Quiz Master required' })
    const body = z.object({
      text: z.string().min(1).optional(),
      points: z.number().int().min(1).optional(),
      timerSeconds: z.number().int().min(0).optional(),
      isFreeText: z.boolean().optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })
    const question = await prisma.quizQuestion.update({ where: { id }, data: body.data, include: { options: true } })
    return { question }
  })

  app.delete('/questions/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: string }
    const cid = await challengeIdFromQuestion(id)
    if (!cid || !await canEditQuiz(me.id, me.role, cid)) return reply.status(403).send({ error: 'Admin or Quiz Master required' })
    await prisma.quizQuestion.delete({ where: { id } })
    return { success: true }
  })

  app.put('/questions/reorder', { preHandler: requireAuth }, async (request, reply) => {
    const me = request.user as { id: string; role: string }
    const body = z.object({ order: z.array(z.string()) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'order must be an array of IDs' })
    if (body.data.order.length > 0) {
      const cid = await challengeIdFromQuestion(body.data.order[0])
      if (!cid || !await canEditQuiz(me.id, me.role, cid)) return reply.status(403).send({ error: 'Admin or Quiz Master required' })
    }
    await Promise.all(body.data.order.map((id, i) => prisma.quizQuestion.update({ where: { id }, data: { order: i } })))
    return { success: true }
  })

  // ── Reorder options ─────────────────────────────────────────────────────────
  app.put('/options/reorder', { preHandler: requireAuth }, async (request, reply) => {
    const me = request.user as { id: string; role: string }
    const body = z.object({ order: z.array(z.string()) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'order must be an array of IDs' })
    if (body.data.order.length > 0) {
      const cid = await challengeIdFromOption(body.data.order[0])
      if (!cid || !await canEditQuiz(me.id, me.role, cid)) return reply.status(403).send({ error: 'Admin or Quiz Master required' })
    }
    await Promise.all(body.data.order.map((id, i) => prisma.quizOption.update({ where: { id }, data: { order: i } })))
    return { success: true }
  })

  // ── Image upload for question ───────────────────────────────────────────────
  app.post('/questions/:id/image', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: string }
    const cid = await challengeIdFromQuestion(id)
    if (!cid || !await canEditQuiz(me.id, me.role, cid)) return reply.status(403).send({ error: 'Admin or Quiz Master required' })
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file' })
    const ext = path.extname(data.filename) || '.jpg'
    const dir = path.join(config.uploadsDir, 'quiz')
    fs.mkdirSync(dir, { recursive: true })
    const filename = `q_${id}${ext}`
    const dest = path.join(dir, filename)
    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    fs.writeFileSync(dest, Buffer.concat(chunks))
    const publicUrl = `/uploads/quiz/${filename}`
    await prisma.quizQuestion.update({ where: { id }, data: { imageUrl: publicUrl } })
    return { imageUrl: publicUrl }
  })

  // ── AI image generation for question ────────────────────────────────────────
  app.post('/questions/:id/generate-image', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: string }
    const cid = await challengeIdFromQuestion(id)
    if (!cid || !await canEditQuiz(me.id, me.role, cid)) return reply.status(403).send({ error: 'Admin or Quiz Master required' })
    const question = await prisma.quizQuestion.findUnique({ where: { id } })
    if (!question) return reply.status(404).send({ error: 'Question not found' })
    const body = (request.body ?? {}) as { prompt?: string }
    const prompt = body.prompt?.trim()
      || `An illustration for a quiz question: "${question.text}". Relevant to the question, no text or letters in the image.`
    const result = await generateImage({ prompt }, 'quiz')
    // generateImage returns a slashless "uploads/quiz/…" path (or a full http URL
    // for the placeholder fallback). Match the upload route's leading-slash form
    // so it renders the same way in the editor and the live quiz.
    const imageUrl = result.publicUrl.startsWith('uploads/') ? `/${result.publicUrl}` : result.publicUrl
    await prisma.quizQuestion.update({ where: { id }, data: { imageUrl } })
    return { imageUrl }
  })

  // ── Remove image from question ──────────────────────────────────────────────
  app.delete('/questions/:id/image', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: string }
    const cid = await challengeIdFromQuestion(id)
    if (!cid || !await canEditQuiz(me.id, me.role, cid)) return reply.status(403).send({ error: 'Admin or Quiz Master required' })
    const question = await prisma.quizQuestion.findUnique({ where: { id }, select: { imageUrl: true } })
    if (!question) return reply.status(404).send({ error: 'Question not found' })
    removeStoredImage(question.imageUrl)
    await prisma.quizQuestion.update({ where: { id }, data: { imageUrl: null } })
    return { success: true }
  })

  // ── Option CRUD ─────────────────────────────────────────────────────────────
  app.post('/questions/:questionId/options', { preHandler: requireAuth }, async (request, reply) => {
    const { questionId } = request.params as { questionId: string }
    const me = request.user as { id: string; role: string }
    const cid = await challengeIdFromQuestion(questionId)
    if (!cid || !await canEditQuiz(me.id, me.role, cid)) return reply.status(403).send({ error: 'Admin or Quiz Master required' })
    const body = z.object({ text: z.string().min(1), isCorrect: z.boolean().default(false) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })
    const maxOrder = await prisma.quizOption.aggregate({ where: { questionId }, _max: { order: true } })
    const option = await prisma.quizOption.create({
      data: { questionId, text: body.data.text, isCorrect: body.data.isCorrect, order: (maxOrder._max.order ?? -1) + 1 },
    })
    if (body.data.isCorrect) {
      await prisma.quizOption.updateMany({ where: { questionId, id: { not: option.id } }, data: { isCorrect: false } })
    }
    return reply.status(201).send({ option })
  })

  app.put('/options/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: string }
    const cid = await challengeIdFromOption(id)
    if (!cid || !await canEditQuiz(me.id, me.role, cid)) return reply.status(403).send({ error: 'Admin or Quiz Master required' })
    const body = z.object({ text: z.string().min(1).optional(), isCorrect: z.boolean().optional() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })
    if (body.data.isCorrect) {
      const opt = await prisma.quizOption.findUnique({ where: { id }, select: { questionId: true } })
      if (opt) await prisma.quizOption.updateMany({ where: { questionId: opt.questionId, id: { not: id } }, data: { isCorrect: false } })
    }
    const option = await prisma.quizOption.update({ where: { id }, data: body.data })
    return { option }
  })

  app.delete('/options/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: string }
    const cid = await challengeIdFromOption(id)
    if (!cid || !await canEditQuiz(me.id, me.role, cid)) return reply.status(403).send({ error: 'Admin or Quiz Master required' })
    await prisma.quizOption.delete({ where: { id } })
    return { success: true }
  })

  // ── Image upload for option ─────────────────────────────────────────────────
  app.post('/options/:id/image', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: string }
    const cid = await challengeIdFromOption(id)
    if (!cid || !await canEditQuiz(me.id, me.role, cid)) return reply.status(403).send({ error: 'Admin or Quiz Master required' })
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file' })
    const ext = path.extname(data.filename) || '.jpg'
    const dir = path.join(config.uploadsDir, 'quiz')
    fs.mkdirSync(dir, { recursive: true })
    const filename = `opt_${id}${ext}`
    const dest = path.join(dir, filename)
    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    fs.writeFileSync(dest, Buffer.concat(chunks))
    const publicUrl = `/uploads/quiz/${filename}`
    await prisma.quizOption.update({ where: { id }, data: { imageUrl: publicUrl } })
    return { imageUrl: publicUrl }
  })

  // ── Remove image from option ────────────────────────────────────────────────
  app.delete('/options/:id/image', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const me = request.user as { id: string; role: string }
    const cid = await challengeIdFromOption(id)
    if (!cid || !await canEditQuiz(me.id, me.role, cid)) return reply.status(403).send({ error: 'Admin or Quiz Master required' })
    const option = await prisma.quizOption.findUnique({ where: { id }, select: { imageUrl: true } })
    if (!option) return reply.status(404).send({ error: 'Option not found' })
    removeStoredImage(option.imageUrl)
    await prisma.quizOption.update({ where: { id }, data: { imageUrl: null } })
    return { success: true }
  })

  // ── Session control ─────────────────────────────────────────────────────────
  app.post('/:ccId/session/ready', { preHandler: requireAuth }, async (request, reply) => {
    const { ccId } = request.params as { ccId: string }
    const me = request.user as { id: string }
    const body = z.object({ teamId: z.string().optional() }).safeParse(request.body)
    const teamId = (body.success ? body.data.teamId : undefined) ?? null

    const session = await getOrCreateSession(ccId)
    if (session.status !== 'LOBBY') return reply.status(400).send({ error: 'Quiz already started' })

    if (teamId) {
      await prisma.quizReady.upsert({
        where: { sessionId_teamId: { sessionId: session.id, teamId } },
        create: { sessionId: session.id, teamId, userId: null },
        update: {},
      })
    } else {
      await prisma.quizReady.upsert({
        where: { sessionId_userId: { sessionId: session.id, userId: me.id } },
        create: { sessionId: session.id, userId: me.id, teamId: null },
        update: {},
      })
    }
    broadcast(ccId)
    return { success: true }
  })

  app.post('/:ccId/session/start', { preHandler: requireAuth }, async (request, reply) => {
    const { ccId } = request.params as { ccId: string }
    const me = request.user as { id: string; role: string }
    if (!await isQM(me.id, ccId)) return reply.status(403).send({ error: 'QM or admin required' })

    await prisma.quizSession.upsert({
      where: { competitionChallengeId: ccId },
      create: { competitionChallengeId: ccId, status: 'ACTIVE', currentQuestionIndex: 0, questionLocked: false },
      update: { status: 'ACTIVE', currentQuestionIndex: 0, questionLocked: false, lobbyAnnounced: false },
    })
    broadcast(ccId)
    return { success: true }
  })

  // QM toggles a "come to the lobby" announcement banner shown to all players
  app.post('/:ccId/session/announce', { preHandler: requireAuth }, async (request, reply) => {
    const { ccId } = request.params as { ccId: string }
    const me = request.user as { id: string; role: string }
    if (!await isQM(me.id, ccId)) return reply.status(403).send({ error: 'QM or admin required' })

    const body = z.object({ announced: z.boolean() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'announced required' })

    const session = await getOrCreateSession(ccId)
    if (session.status !== 'LOBBY') return reply.status(400).send({ error: 'Quiz already started' })

    await prisma.quizSession.update({ where: { id: session.id }, data: { lobbyAnnounced: body.data.announced } })
    broadcast(ccId)
    return { success: true }
  })

  // QM presses "Next Question" → 5-second countdown visible to everyone, then auto-advance
  app.post('/:ccId/session/next-question', { preHandler: requireAuth }, async (request, reply) => {
    const { ccId } = request.params as { ccId: string }
    const me = request.user as { id: string; role: string }
    if (!await isQM(me.id, ccId)) return reply.status(403).send({ error: 'QM or admin required' })

    const session = await getOrCreateSession(ccId)
    if (session.status !== 'ACTIVE') return reply.status(400).send({ error: 'Quiz not active' })

    // Start 5-second countdown — broadcast immediately so all clients show it
    const endsAt = Date.now() + 5000
    countdownMap.set(ccId, endsAt)
    broadcast(ccId)

    // Auto-advance after 5 seconds
    setTimeout(async () => {
      countdownMap.delete(ccId)
      try {
        const s = await getOrCreateSession(ccId)
        if (s.status !== 'ACTIVE') { broadcast(ccId); return }
        const cc = await prisma.competitionChallenge.findUnique({ where: { id: ccId }, select: { challengeId: true } })
        const qCount = await prisma.quizQuestion.count({ where: { challengeId: cc!.challengeId } })
        const nextIdx = s.currentQuestionIndex + 1
        if (nextIdx >= qCount) {
          await prisma.quizSession.update({ where: { id: s.id }, data: { status: 'CORRECTING', questionLocked: true, correctionIndex: 0, correctAnswerVisible: false } })
        } else {
          await prisma.quizSession.update({ where: { id: s.id }, data: { currentQuestionIndex: nextIdx, questionLocked: false } })
        }
      } catch { /* session may have been manually advanced */ }
      broadcast(ccId)
    }, 5000)

    return { success: true }
  })

  app.post('/:ccId/session/show-answer', { preHandler: requireAuth }, async (request, reply) => {
    const { ccId } = request.params as { ccId: string }
    const me = request.user as { id: string; role: string }
    if (!await isQM(me.id, ccId)) return reply.status(403).send({ error: 'QM or admin required' })

    const session = await getOrCreateSession(ccId)
    if (session.status !== 'CORRECTING') return reply.status(400).send({ error: 'Not in correction mode' })
    await prisma.quizSession.update({ where: { id: session.id }, data: { correctAnswerVisible: true } })
    broadcast(ccId)
    return { success: true }
  })

  app.post('/:ccId/session/next-correction', { preHandler: requireAuth }, async (request, reply) => {
    const { ccId } = request.params as { ccId: string }
    const me = request.user as { id: string; role: string }
    if (!await isQM(me.id, ccId)) return reply.status(403).send({ error: 'QM or admin required' })

    const session = await getOrCreateSession(ccId)
    if (session.status !== 'CORRECTING') return reply.status(400).send({ error: 'Not in correction mode' })

    const cc = await prisma.competitionChallenge.findUnique({ where: { id: ccId }, select: { challengeId: true } })
    const qCount = await prisma.quizQuestion.count({ where: { challengeId: cc!.challengeId } })
    const nextIdx = session.correctionIndex + 1

    if (nextIdx >= qCount) {
      // All corrected — mark completed and compute scores
      await prisma.quizSession.update({ where: { id: session.id }, data: { status: 'COMPLETED', correctAnswerVisible: false } })
      await computeAndSaveScores(ccId, me.id)
    } else {
      await prisma.quizSession.update({ where: { id: session.id }, data: { correctionIndex: nextIdx, correctAnswerVisible: false } })
    }
    broadcast(ccId)
    return { success: true }
  })

  app.post('/:ccId/session/complete', { preHandler: requireAuth }, async (request, reply) => {
    const { ccId } = request.params as { ccId: string }
    const me = request.user as { id: string; role: string }
    if (!await isQM(me.id, ccId)) return reply.status(403).send({ error: 'QM or admin required' })

    const session = await getOrCreateSession(ccId)
    await prisma.quizSession.update({ where: { id: session.id }, data: { status: 'COMPLETED' } })
    await computeAndSaveScores(ccId, me.id)
    broadcast(ccId)
    return { success: true }
  })

  // ── Submit answer (player) ──────────────────────────────────────────────────
  app.post('/:ccId/answers', { preHandler: requireAuth }, async (request, reply) => {
    const { ccId } = request.params as { ccId: string }
    const me = request.user as { id: string }
    const body = z.object({
      questionId: z.string(),
      optionId: z.string().optional(),
      freeTextAnswer: z.string().optional(),
      teamId: z.string().optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    const session = await prisma.quizSession.findUnique({ where: { competitionChallengeId: ccId } })
    if (!session || session.status !== 'ACTIVE') return reply.status(400).send({ error: 'Quiz not accepting answers' })
    if (session.questionLocked) return reply.status(400).send({ error: 'Question is locked' })

    // Verify question is the current one
    const cc = await prisma.competitionChallenge.findUnique({ where: { id: ccId }, select: { challengeId: true } })
    const currentQ = await prisma.quizQuestion.findFirst({
      where: { challengeId: cc!.challengeId, order: session.currentQuestionIndex },
    })
    if (!currentQ || currentQ.id !== body.data.questionId) {
      return reply.status(400).send({ error: 'Can only answer the current question' })
    }

    if (currentQ.isFreeText) {
      const freeText = body.data.freeTextAnswer?.trim() ?? ''
      const { teamId } = body.data
      if (teamId) {
        await prisma.quizAnswer.upsert({
          where: { questionId_teamId: { questionId: body.data.questionId, teamId } },
          create: { questionId: body.data.questionId, freeTextAnswer: freeText, teamId, submittedAt: new Date() },
          update: { freeTextAnswer: freeText, submittedAt: new Date() },
        })
      } else {
        await prisma.quizAnswer.upsert({
          where: { questionId_userId: { questionId: body.data.questionId, userId: me.id } },
          create: { questionId: body.data.questionId, freeTextAnswer: freeText, userId: me.id, submittedAt: new Date() },
          update: { freeTextAnswer: freeText, submittedAt: new Date() },
        })
      }
    } else {
      if (!body.data.optionId) return reply.status(400).send({ error: 'optionId required for multiple choice question' })
      const { teamId } = body.data
      if (teamId) {
        await prisma.quizAnswer.upsert({
          where: { questionId_teamId: { questionId: body.data.questionId, teamId } },
          create: { questionId: body.data.questionId, optionId: body.data.optionId, teamId, submittedAt: new Date() },
          update: { optionId: body.data.optionId, submittedAt: new Date() },
        })
      } else {
        await prisma.quizAnswer.upsert({
          where: { questionId_userId: { questionId: body.data.questionId, userId: me.id } },
          create: { questionId: body.data.questionId, optionId: body.data.optionId, userId: me.id, submittedAt: new Date() },
          update: { optionId: body.data.optionId, submittedAt: new Date() },
        })
      }
    }
    broadcast(ccId)
    return { success: true }
  })

  // ── Set points for a free text answer (QM only) ─────────────────────────────
  app.put('/:ccId/answers/:answerId/points', { preHandler: requireAuth }, async (request, reply) => {
    const { ccId, answerId } = request.params as { ccId: string; answerId: string }
    const me = request.user as { id: string; role: string }
    if (!await isQM(me.id, ccId)) return reply.status(403).send({ error: 'QM or admin required' })

    const answer = await prisma.quizAnswer.findUnique({
      where: { id: answerId },
      include: { question: true },
    })
    if (!answer) return reply.status(404).send({ error: 'Answer not found' })

    const body = z.object({ points: z.number().int().min(0) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message })

    await prisma.quizAnswer.update({ where: { id: answerId }, data: { freeTextPoints: body.data.points } })
    broadcast(ccId)
    return { success: true }
  })

  // ── Toggle lock on a free text answer (QM only) ─────────────────────────────
  app.put('/:ccId/answers/:answerId/lock', { preHandler: requireAuth }, async (request, reply) => {
    const { ccId, answerId } = request.params as { ccId: string; answerId: string }
    const me = request.user as { id: string; role: string }
    if (!await isQM(me.id, ccId)) return reply.status(403).send({ error: 'QM or admin required' })

    const answer = await prisma.quizAnswer.findUnique({ where: { id: answerId } })
    if (!answer) return reply.status(404).send({ error: 'Answer not found' })

    await prisma.quizAnswer.update({ where: { id: answerId }, data: { freeTextLocked: !answer.freeTextLocked } })
    broadcast(ccId)
    return { success: true }
  })

  // ── Active lobby announcements for the current user ──────────────────────────
  // Returns quizzes in LOBBY whose QM has raised the "come to the lobby" banner,
  // limited to competitions the user actually plays in. Drives the global banner.
  app.get('/announcements', { preHandler: requireAuth }, async (request) => {
    const me = request.user as { id: string }
    const sessions = await prisma.quizSession.findMany({
      where: {
        status: 'LOBBY',
        lobbyAnnounced: true,
        competitionChallenge: {
          competition: { players: { some: { userId: me.id } } },
        },
      },
      include: {
        competitionChallenge: {
          include: {
            challenge: { select: { name: true } },
            competition: { select: { id: true, name: true } },
          },
        },
      },
    })

    return {
      announcements: sessions.map(s => ({
        ccId: s.competitionChallengeId,
        competitionId: s.competitionChallenge.competition.id,
        competitionName: s.competitionChallenge.competition.name,
        quizName: s.competitionChallenge.challenge.name,
      })),
    }
  })

  // ── Quiz history — completed quiz sessions ───────────────────────────────────
  app.get('/history', { preHandler: optionalAuth }, async (request, reply) => {
    const { groupId } = request.query as { groupId?: string }
    const groupFilter: string | null = groupId ?? null

    const sessions = await prisma.quizSession.findMany({
      where: {
        status: 'COMPLETED',
        ...(groupFilter ? {
          competitionChallenge: { competition: { groupId: groupFilter } }
        } : {}),
      },
      include: {
        competitionChallenge: {
          include: {
            challenge: { select: { id: true, name: true } },
            competition: { select: { id: true, name: true } },
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
    })

    return reply.send({
      quizSessions: sessions.map(s => ({
        ccId: s.competitionChallengeId,
        competitionId: s.competitionChallenge.competition.id,
        competitionName: s.competitionChallenge.competition.name,
        quizName: s.competitionChallenge.challenge.name,
        challengeId: s.competitionChallenge.challenge.id,
        updatedAt: s.updatedAt.toISOString(),
      }))
    })
  })

  // ── Quiz Master toggle (admin only) ─────────────────────────────────────────
  app.put('/competition/:compId/players/:userId/quiz-master', { preHandler: requireAdmin }, async (request, reply) => {
    const { compId, userId } = request.params as { compId: string; userId: string }
    const body = z.object({ isQuizMaster: z.boolean() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'isQuizMaster required' })

    const player = await prisma.competitionPlayer.update({
      where: { competitionId_userId: { competitionId: compId, userId } },
      data: { isQuizMaster: body.data.isQuizMaster },
    })
    return { player }
  })
}
