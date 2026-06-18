import { prisma } from '../db.js'

// Deep-copy a quiz challenge into a brand-new challenge — every question with its
// options, free-text fields (incl. expected answers), images, phase, manus notes
// and the "find the red thread" references. The references are stored as question
// ids, so they're bridged old→new through each question's `order` (unique per
// challenge) after the rows exist.
//
// Used both when an admin builds a new competition quiz from a template and when
// a quiz is snapshotted to a global template as it starts being played, so the
// two paths can never drift apart. Returns the new Challenge, or null if the
// source doesn't exist.
export async function cloneQuizChallenge(
  sourceId: string,
  opts: { name?: string; isGlobalTemplate: boolean; templateSourceId?: string | null },
) {
  const src = await prisma.challenge.findUnique({
    where: { id: sourceId },
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
  if (!src) return null

  // Per question that references earlier ones, the template orders it points at.
  const orderById = new Map(src.quizQuestions.map(q => [q.id, q.order]))
  const refsByOrder = src.quizQuestions
    .filter(q => (q.showAnswersFromQuestionIds ?? []).length > 0)
    .map(q => ({
      order: q.order,
      refOrders: (q.showAnswersFromQuestionIds as string[])
        .map(id => orderById.get(id))
        .filter((o): o is number => o !== undefined),
    }))

  const clone = await prisma.challenge.create({
    data: {
      name: opts.name ?? src.name,
      description: src.description ?? undefined,
      scoreType: src.scoreType,
      defaultTeamScoreMode: src.defaultTeamScoreMode,
      bestNPlayers: src.bestNPlayers ?? undefined,
      isGlobalTemplate: opts.isGlobalTemplate,
      isQuiz: true,
      quizPhaseCorrection: src.quizPhaseCorrection,
      logoUrl: src.logoUrl ?? undefined,
      templateSourceId: opts.templateSourceId ?? null,
      quizQuestions: {
        create: src.quizQuestions.map(q => ({
          text: q.text,
          description: q.description ?? undefined,
          points: q.points,
          timerSeconds: q.timerSeconds,
          isFreeText: q.isFreeText,
          order: q.order,
          phase: q.phase,
          manusText: q.manusText,
          correctionManusText: q.correctionManusText,
          imageUrl: q.imageUrl ?? undefined,
          // Remapped to the cloned question ids once they exist (see below).
          showAnswersFromQuestionIds: [],
          options: {
            create: q.options.map(o => ({
              text: o.text,
              isCorrect: o.isCorrect,
              order: o.order,
              imageUrl: o.imageUrl ?? undefined,
            })),
          },
          fields: {
            create: q.fields.map(f => ({
              label: f.label,
              points: f.points,
              order: f.order,
              correctAnswer: f.correctAnswer,
            })),
          },
        })),
      },
    },
  })

  if (refsByOrder.length > 0) {
    const cloned = await prisma.quizQuestion.findMany({ where: { challengeId: clone.id }, select: { id: true, order: true } })
    const idByOrder = new Map(cloned.map(q => [q.order, q.id]))
    await Promise.all(refsByOrder.map(({ order, refOrders }) => {
      const targetId = idByOrder.get(order)
      if (!targetId) return Promise.resolve()
      const newRefs = refOrders.map(o => idByOrder.get(o)).filter((x): x is string => !!x)
      return prisma.quizQuestion.update({ where: { id: targetId }, data: { showAnswersFromQuestionIds: newRefs } })
    }))
  }

  return clone
}

// Create (or refresh) the reusable global template snapshotted from a competition
// quiz — an exact copy the admin can later use to build new quizzes. Deduped by
// `templateSourceId`: any existing template taken from this quiz is replaced, so
// replaying or re-snapshotting the same quiz never piles up duplicates. Returns
// the template Challenge, or null if the source isn't a quiz.
export async function snapshotChallengeToTemplate(sourceChallengeId: string) {
  const src = await prisma.challenge.findUnique({ where: { id: sourceChallengeId }, select: { id: true, isQuiz: true } })
  if (!src || !src.isQuiz) return null
  const existing = await prisma.challenge.findMany({
    where: { isGlobalTemplate: true, templateSourceId: sourceChallengeId },
    select: { id: true },
  })
  for (const e of existing) await prisma.challenge.delete({ where: { id: e.id } })
  return cloneQuizChallenge(sourceChallengeId, { isGlobalTemplate: true, templateSourceId: sourceChallengeId })
}
