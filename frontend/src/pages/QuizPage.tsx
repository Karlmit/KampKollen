import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Avatar } from '../components/ui/Avatar'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'
import { sanitizeRichText } from '../utils'
import { useTranslation } from 'react-i18next'
import { CountUp, Confetti } from '../components/quiz/QuizFx'

// Renders the optional rich-text question description (bold/italic/underline)
// shown beneath the question text. Re-sanitised at render as defence in depth.
function QuestionDescription({ html }: { html?: string | null }) {
  const clean = sanitizeRichText(html)
  if (!clean) return null
  return (
    <div
      className="rte-content"
      style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', lineHeight: 1.5, color: 'var(--text-muted)', marginTop: 8 }}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}

// ── Timer bar ─────────────────────────────────────────────────────────────────
function TimerBar({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const { t } = useTranslation()
  const [remaining, setRemaining] = useState(seconds)
  useEffect(() => {
    if (seconds <= 0) return
    setRemaining(seconds)
    const interval = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { clearInterval(interval); onExpire(); return 0 }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [seconds, onExpire])
  if (seconds <= 0) return null
  const pct = (remaining / seconds) * 100
  const urgent = remaining <= 5
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-ui)', fontWeight: 700, marginBottom: 4 }}>
        <span>{t('quiz.timeLeft')}</span>
        <span
          className={urgent ? 'qz-timer-urgent' : undefined}
          style={{ color: urgent ? 'var(--accent-warm)' : undefined, fontWeight: 800 }}
        >{remaining}s</span>
      </div>
      <div className={urgent ? 'qz-bar-urgent' : undefined} style={{ height: 6, background: 'var(--surface)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 99,
          background: urgent ? 'var(--accent-warm)' : 'var(--accent)',
          transition: 'width 1s linear, background 0.3s',
        }} />
      </div>
    </div>
  )
}

// ── Mini scoreboard ───────────────────────────────────────────────────────────
function MiniScoreboard({ questions, teams, players, isTeamComp }: any) {
  // Calculate running quiz scores up to the current correction index
  const scores: Record<string, number> = {}
  for (const q of questions) {
    if (!q.answerCounts || !q.options) continue
    const correctOpt = q.options.find((o: any) => o.isCorrect)
    if (!correctOpt) continue
    const correct = q.answerCounts.find((ac: any) => ac.optionId === correctOpt.id)
    if (!correct) continue
    if (isTeamComp) {
      for (const teamId of correct.teams ?? []) {
        scores[teamId] = (scores[teamId] ?? 0) + q.points
      }
    }
  }
  const sorted = isTeamComp
    ? [...teams].sort((a: any, b: any) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0)).slice(0, 3)
    : []
  if (sorted.length === 0 && !isTeamComp) return null

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' }}>
      {sorted.map((t: any, i: number) => (
        <div key={t.id} className={i === 0 ? 'qz-gold-pulse' : undefined} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
          borderRadius: 'var(--radius)', background: i === 0 ? 'var(--text-primary)' : 'var(--surface)',
          minWidth: 100, flexShrink: 0, transition: 'background 300ms var(--ease-out)',
        }}>
          <span style={{ fontSize: '14px' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
          <div>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px', color: i === 0 ? '#fff' : undefined }}>{t.name}</p>
            <p style={{ fontSize: '11px', color: i === 0 ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
              <CountUp value={scores[t.id] ?? 0} duration={700} /> pts
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// Group a free-text question's per-field answers by respondent (team or player),
// so the QM/correction/completed views can show one card per team/player with all
// of their field answers (and per-field points) together.
function groupFieldAnswers(q: any, competition: any, isTeamComp: boolean) {
  const fields: any[] = q.fields ?? []
  const map = new Map<string, { key: string; teamId: string | null; userId: string | null; name: string; entries: { field: any; answer: any }[] }>()
  for (const field of fields) {
    for (const a of field.answers ?? []) {
      const key = isTeamComp ? a.teamId : a.userId
      if (!key) continue
      if (!map.has(key)) {
        const name = isTeamComp
          ? competition.teams.find((x: any) => x.id === a.teamId)?.name ?? a.teamId
          : competition.players.find((x: any) => x.userId === a.userId)?.user?.displayName ?? competition.players.find((x: any) => x.userId === a.userId)?.user?.username ?? a.userId
        map.set(key, { key, teamId: a.teamId ?? null, userId: a.userId ?? null, name, entries: [] })
      }
      map.get(key)!.entries.push({ field, answer: a })
    }
  }
  for (const r of map.values()) r.entries.sort((x, y) => (x.field.order ?? 0) - (y.field.order ?? 0))
  return [...map.values()]
}

// Every submitted field answer locked? Gate for advancing past a free-text question.
function allFieldAnswersLocked(q: any) {
  const answers = (q.fields ?? []).flatMap((f: any) => f.answers ?? [])
  return answers.length === 0 || answers.every((a: any) => a.locked)
}

// Sum of points the QM has awarded a respondent across all of a question's fields.
function respondentPoints(entries: { field: any; answer: any }[]) {
  return entries.reduce((sum, e) => sum + (e.answer.points ?? 0), 0)
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function QuizPage() {
  const { competitionId, ccId } = useParams<{ competitionId: string; ccId: string }>()
  const { user, isAdmin } = useAuth()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [freeTextInputs, setFreeTextInputs] = useState<Record<string, string>>({})
  const [confirmStart, setConfirmStart] = useState(false)
  const [countdownSecs, setCountdownSecs] = useState<number | null>(null)
  const [showFullResults, setShowFullResults] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['quiz', ccId],
    queryFn: () => api.quiz.getState(ccId!),
    enabled: !!ccId,
    refetchInterval: 2000, // Polling fallback — SSE takes over when connected
  })

  // SSE for instant updates
  useEffect(() => {
    if (!ccId) return
    const es = new EventSource(`api/quiz/${ccId}/stream`)
    es.addEventListener('quiz-update', () => {
      qc.invalidateQueries({ queryKey: ['quiz', ccId] })
    })
    es.onerror = () => { /* polling fallback already active */ }
    return () => es.close()
  }, [ccId, qc])

  // Reset local selection when question advances
  const sessionStatus = data?.session?.status
  const currentIdx = data?.session?.currentQuestionIndex
  const countdownEndsAt: number | null = data?.session?.countdownEndsAt ?? null
  useEffect(() => { setSelectedOption(null); setSubmitted(false); setFreeTextInputs({}) }, [currentIdx, sessionStatus])

  // Live countdown tick from server-provided endsAt timestamp
  useEffect(() => {
    if (!countdownEndsAt) { setCountdownSecs(null); return }
    const tick = () => {
      const s = Math.ceil((countdownEndsAt - Date.now()) / 1000)
      setCountdownSecs(s > 0 ? s : null)
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [countdownEndsAt])

  const submitAnswer = useMutation({
    mutationFn: ({ optionId, fields, teamId }: { optionId?: string; fields?: { fieldId: string; answer: string }[]; teamId?: string }) =>
      api.quiz.submitAnswer(ccId!, { questionId: currentQ?.id, optionId, fields, teamId }),
    onSuccess: () => { setSubmitted(true); qc.invalidateQueries({ queryKey: ['quiz', ccId] }) },
  })

  const setFieldPoints = useMutation({
    mutationFn: ({ answerId, points }: { answerId: string; points: number }) =>
      api.quiz.setFieldPoints(ccId!, answerId, points),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', ccId] }),
  })

  const toggleFieldLock = useMutation({
    mutationFn: (answerId: string) => api.quiz.toggleFieldLock(ccId!, answerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', ccId] }),
  })

  const readyMutation = useMutation({
    mutationFn: (teamId?: string) => api.quiz.markReady(ccId!, teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', ccId] }),
  })

  const announceMutation = useMutation({
    mutationFn: (announced: boolean) => api.quiz.announce(ccId!, announced),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', ccId] }),
  })

  const qmMutate = useCallback((action: () => Promise<any>) => {
    action().then(() => qc.invalidateQueries({ queryKey: ['quiz', ccId] }))
  }, [ccId, qc])

  if (isLoading) return <Layout title={t('quiz.title')} back={`/competitions/${competitionId}`}><LoadingSpinner /></Layout>
  if (!data) return <Layout title={t('quiz.title')} back={`/competitions/${competitionId}`}><p>{t('quiz.notFound')}</p></Layout>

  const { session, isQM, isTeamComp, myTeamId, myIsTeamLeader, myIsScorekeeper, competition, questions, challengeId, challengeLogoUrl } = data
  const isGuest = !user
  // In team mode: leaders, scorekeepers, and non-QM admins can act; individual mode: everyone (guests never act)
  const canAct = !isGuest && (!isTeamComp || myIsTeamLeader || myIsScorekeeper || (isAdmin && !isQM))
  const myTeam = competition.teams.find((t: any) => t.id === myTeamId)
  const currentQ = questions[session.currentQuestionIndex]
  const correctionQ = questions[session.correctionIndex]

  const readyIds = new Set((session.readyEntries ?? []).map((r: any) => r.teamId ?? r.userId))
  const amReady = isTeamComp ? readyIds.has(myTeamId) : readyIds.has(user?.id)

  // effective option my team/I already submitted
  const mySubmittedOption = currentQ?.myOptionId ?? null

  function handleSelectOption(optId: string) {
    if (currentQ?.locked || session.status !== 'ACTIVE') return
    setSelectedOption(optId)
    const teamId = isTeamComp ? myTeamId ?? undefined : undefined
    submitAnswer.mutate({ optionId: optId, teamId })
  }

  function handleSubmitFreeText() {
    if (currentQ?.locked || session.status !== 'ACTIVE') return
    const fields = (currentQ?.fields ?? []).map((f: any) => ({ fieldId: f.id, answer: (freeTextInputs[f.id] ?? '').trim() }))
    if (fields.length === 0 || fields.every((f: any) => !f.answer)) return
    const teamId = isTeamComp ? myTeamId ?? undefined : undefined
    submitAnswer.mutate({ fields, teamId })
  }

  // Whether this player/team has already submitted the current free-text question
  // (any field filled). Drives the "answer submitted" confirmation card.
  const myFreeTextSubmitted = (currentQ?.fields ?? []).some((f: any) => f.myAnswer != null)

  return (
    <Layout
      title={t('quiz.title')}
      back={`/competitions/${competitionId}`}
    >
      {/* ── LOBBY ────────────────────────────────────────────────────────── */}
      {session.status === 'LOBBY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card className="qz-pop-in" style={{ textAlign: 'center', padding: '32px 16px' }}>
            {challengeLogoUrl ? (
              <img src={challengeLogoUrl} alt="" className="qz-pop-in" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 'var(--radius-lg)', margin: '0 auto 12px', boxShadow: 'var(--shadow-md)' }} />
            ) : (
              <p className="qz-float" style={{ fontSize: '40px', marginBottom: '8px' }}>🎯</p>
            )}
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '20px', marginBottom: '4px' }}>{t('quiz.lobbyTitle')}</p>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              {t('quiz.lobbyDesc', { count: questions.length })}
            </p>
          </Card>

          {/* Ready button — team mode: leaders/SK only; individual mode: everyone (guests never) */}
          {!isGuest && !isQM && canAct && !amReady && (
            <Button
              fullWidth
              size="lg"
              onClick={() => readyMutation.mutate(isTeamComp ? myTeamId ?? undefined : undefined)}
              loading={readyMutation.isPending}
            >
              {isTeamComp ? t('quiz.markReady', { name: myTeam?.name ?? 'team' }) : t('quiz.markMeReady')}
            </Button>
          )}
          {!isGuest && !isQM && !canAct && !amReady && (
            <Card padding="12px" style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)' }}>
                {t('quiz.waitingForLeader')}
              </p>
            </Card>
          )}
          {isGuest && (
            <Card padding="12px" style={{ textAlign: 'center', background: 'var(--surface)' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)' }}>
                {t('quiz.watchingSign')}
              </p>
            </Card>
          )}
          {amReady && (
            <Card className="qz-pop-in" padding="12px" style={{ textAlign: 'center', background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)', border: '1px solid var(--accent-green)' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--accent-green)' }}>{t('quiz.ready')}</p>
            </Card>
          )}

          {/* Ready list */}
          <Card>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>
              {isTeamComp ? t('quiz.teamsReady') : t('quiz.playersReady')} (<CountUp value={readyIds.size} duration={500} />/{isTeamComp ? competition.teams.length : competition.players.length})
            </p>
            <div className="qz-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(isTeamComp ? competition.teams : competition.players).map((item: any) => {
                const id = isTeamComp ? item.id : item.userId
                const name = isTeamComp ? item.name : (item.user?.displayName ?? item.user?.username)
                const isReady = readyIds.has(id)
                const isMyTeam = isTeamComp && id === myTeamId
                const isMe = !isTeamComp && id === user?.id
                return (
                  <span key={id} style={{
                    padding: '4px 10px', borderRadius: '99px', fontSize: '13px', fontFamily: 'var(--font-ui)', fontWeight: 600,
                    background: isReady ? 'color-mix(in srgb, var(--accent-green) 15%, transparent)' : (isMyTeam || isMe) ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--surface)',
                    color: isReady ? 'var(--accent-green)' : (isMyTeam || isMe) ? 'var(--accent)' : 'var(--text-muted)',
                    border: `1.5px solid ${isReady ? 'var(--accent-green)' : (isMyTeam || isMe) ? 'var(--accent)' : 'var(--border-light)'}`
                  }}>
                    {isReady ? '✓ ' : ''}{name}{(isMyTeam || isMe) ? ` (${t('quiz.you')})` : ''}
                  </span>
                )
              })}
            </div>
          </Card>

          {/* QM controls */}
          {isQM && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Button
                fullWidth
                variant={session.lobbyAnnounced ? 'primary' : 'ghost'}
                size="lg"
                loading={announceMutation.isPending}
                onClick={() => announceMutation.mutate(!session.lobbyAnnounced)}
              >
                {session.lobbyAnnounced ? t('quiz.callPlayersStop') : t('quiz.callPlayers')}
              </Button>
              {session.lobbyAnnounced && (
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '-2px' }}>
                  {t('quiz.callPlayersHint')}
                </p>
              )}
              <Link to={`/competitions/${competitionId}/quiz/${ccId}/edit`} style={{ textDecoration: 'none' }}>
                <Button fullWidth variant="ghost" size="lg">{t('quiz.editQuestions')}</Button>
              </Link>
              <div className="qz-cta">
                <Button fullWidth size="lg" onClick={() => setConfirmStart(true)}>
                  {t('quiz.startQuiz')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Start quiz confirmation */}
      <Modal
        open={confirmStart}
        onClose={() => setConfirmStart(false)}
        title={t('quiz.startQuizTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmStart(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => { setConfirmStart(false); qmMutate(() => api.quiz.start(ccId!)) }}>
              {t('quiz.start')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {t('quiz.startQuizDesc')}
        </p>
      </Modal>

      {/* ── ACTIVE ───────────────────────────────────────────────────────── */}
      {session.status === 'ACTIVE' && currentQ && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Progress */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              {t('quiz.question', { current: session.currentQuestionIndex + 1, total: questions.length })}
            </p>
            <span className="qz-points" style={{
              padding: '3px 10px', borderRadius: '99px',
              background: 'var(--accent)', color: '#fff',
              fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '13px',
            }}>
              {t('quiz.points', { count: currentQ.points })}
            </span>
          </div>

          {/* Per-question timer */}
          {currentQ.timerSeconds > 0 && !currentQ.locked && !countdownSecs && (
            <TimerBar key={session.currentQuestionIndex} seconds={currentQ.timerSeconds} onExpire={() => {}} />
          )}

          {/* Next-question countdown — shown to EVERY role (players, team leaders, scorekeepers, QM, guests) */}
          {countdownSecs !== null && (() => {
            const ringSize = 96
            const ringR = 42
            const circ = 2 * Math.PI * ringR
            const progress = Math.max(0, Math.min(1, countdownSecs / 5))
            const isLast = session.currentQuestionIndex >= questions.length - 1
            return (
              <div className="qz-countdown-card qz-pop-in" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                padding: '18px 16px', marginBottom: 4,
                borderRadius: 'var(--radius-lg)',
                background: 'color-mix(in srgb, var(--accent-warm) 7%, var(--surface))',
                border: '1.5px solid color-mix(in srgb, var(--accent-warm) 28%, transparent)',
              }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-warm)' }}>
                  {isLast ? t('quiz.quizCompletesIn') : t('quiz.nextQuestionIn')}
                </span>
                <div style={{ position: 'relative', width: ringSize, height: ringSize }}>
                  <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
                    <circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} fill="none" strokeWidth={7}
                      stroke="color-mix(in srgb, var(--accent-warm) 16%, transparent)" />
                    <circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} fill="none" strokeWidth={7}
                      stroke="var(--accent-warm)" strokeLinecap="round"
                      strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}
                      style={{ transition: 'stroke-dashoffset 220ms linear' }} />
                  </svg>
                  <span key={countdownSecs} className="qz-count-num" style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '38px', color: 'var(--accent-warm)', lineHeight: 1,
                  }}>
                    {countdownSecs}
                  </span>
                </div>
              </div>
            )
          })()}

          {/* Question card */}
          <Card key={session.currentQuestionIndex} className="qz-question-in">
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px', lineHeight: 1.4 }}>
              {currentQ.text}
            </p>
            <QuestionDescription html={currentQ.description} />
            {currentQ.imageUrl && (
              <img src={currentQ.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginTop: 10, display: 'block' }} />
            )}
          </Card>

          {/* Options — QM sees live distribution, guests see read-only, players see answer buttons */}
          {isQM ? (
            currentQ.isFreeText ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)' }}>
                  {t('quiz.freeTextAnswers')} ({isTeamComp ? currentQ.answeredTeams?.length ?? 0 : currentQ.answeredUserIds?.length ?? 0})
                </p>
                {(() => {
                  const respondents = groupFieldAnswers(currentQ, competition, isTeamComp)
                  if (respondents.length === 0) return <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('quiz.freeTextNoAnswers')}</p>
                  return respondents.map(r => (
                    <div key={r.key} style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', border: '1px solid var(--border-light)' }}>
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px', color: 'var(--text-muted)', marginBottom: 6 }}>{r.name}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {r.entries.map(({ field, answer }) => (
                          <div key={answer.id}>
                            {field.label && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginRight: 6 }}>{field.label}:</span>}
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}>{answer.answer}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                })()}
              </div>
            ) : (
              <div className="qz-deal" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(() => {
                  const counts = currentQ.options.map((o: any) => {
                    const c = currentQ.answerCounts?.find((ac: any) => ac.optionId === o.id)
                    return isTeamComp ? (c?.teams?.length ?? 0) : (c?.count ?? 0)
                  })
                  const maxAnswered = Math.max(0, ...counts)
                  return currentQ.options.map((opt: any) => {
                  const count = currentQ.answerCounts?.find((ac: any) => ac.optionId === opt.id)
                  const teams: string[] = count?.teams ?? []
                  const answered = isTeamComp ? teams.length : (count?.count ?? 0)
                  const total = isTeamComp ? competition.teams.length : competition.players.length
                  const pct = total > 0 ? Math.round((answered / total) * 100) : 0
                  const hasPicks = answered > 0
                  const isLead = hasPicks && answered === maxAnswered
                  return (
                    <div key={opt.id} className={isLead ? 'qz-bar-lead' : undefined} style={{
                      borderRadius: 'var(--radius)', border: `2px solid ${hasPicks ? 'var(--accent)' : 'var(--border-light)'}`,
                      overflow: 'hidden', background: 'var(--background)', position: 'relative',
                      transition: 'border-color 200ms var(--ease-out), box-shadow 250ms var(--ease-out)',
                    }}>
                      {hasPicks && (
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', transition: 'width 500ms var(--ease-out)' }} />
                      )}
                      <div style={{ position: 'relative', padding: '12px 14px' }}>
                        {opt.imageUrl && (
                          <img src={opt.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginBottom: 8, display: 'block' }} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <p style={{ fontFamily: 'var(--font-ui)', fontWeight: hasPicks ? 700 : 500, fontSize: '15px' }}>{opt.text}</p>
                          {hasPicks && !isTeamComp && (
                            <CountUp value={answered} duration={500} style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: 'var(--accent)', flexShrink: 0 }} />
                          )}
                        </div>
                        {isTeamComp && teams.length > 0 && (
                          <div className="qz-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                            {teams.map((teamId: string) => {
                              const teamObj = competition.teams.find((x: any) => x.id === teamId)
                              return <span key={teamId} style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: 700, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>{teamObj?.name ?? teamId}</span>
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
                })()}
              </div>
            )
          ) : isGuest ? (
            <Card padding="14px" style={{ textAlign: 'center', background: 'var(--surface)' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)' }}>
                {t('quiz.watchingSign')}
              </p>
            </Card>
          ) : currentQ.locked ? (
            <Card padding="14px" style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--text-muted)' }}>
                {currentQ.isFreeText
                  ? (myFreeTextSubmitted ? t('quiz.freeTextAnswerSubmitted') : t('quiz.questionLocked'))
                  : (mySubmittedOption ? t('quiz.answerSubmitted') : t('quiz.questionLocked'))}
              </p>
              {currentQ.isFreeText && myFreeTextSubmitted && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: 8 }}>
                  {(currentQ.fields ?? []).map((f: any) => (
                    <p key={f.id} style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)' }}>
                      {f.label && <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{f.label}:</span>}{f.myAnswer}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          ) : !canAct ? (
            <div className="qz-deal" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentQ.isFreeText ? (
                myFreeTextSubmitted ? (
                  <Card padding="14px" style={{ background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)', border: '1px solid var(--accent-green)' }}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: 'var(--accent-green)', marginBottom: 6 }}>{t('quiz.teamAnswered')}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(currentQ.fields ?? []).map((f: any) => (
                        <p key={f.id} style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}>
                          {f.label && <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{f.label}:</span>}{f.myAnswer}
                        </p>
                      ))}
                    </div>
                  </Card>
                ) : (
                  <Card padding="14px" style={{ textAlign: 'center', background: 'var(--surface)' }}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)' }}>{t('quiz.waitingForTeam')}</p>
                  </Card>
                )
              ) : (
                <>
                  {currentQ.options.map((opt: any) => {
                    const picked = mySubmittedOption === opt.id
                    return (
                      <div
                        key={opt.id}
                        style={{
                          padding: opt.imageUrl ? '12px' : '14px 16px',
                          borderRadius: 'var(--radius)',
                          border: `2px solid ${picked ? 'var(--accent-green)' : 'var(--border-light)'}`,
                          background: picked ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)' : 'var(--background)',
                        }}
                      >
                        {opt.imageUrl && (
                          <img src={opt.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginBottom: 8, display: 'block' }} />
                        )}
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: picked ? 700 : 500, fontSize: '15px' }}>
                          {opt.text}
                          {picked && <span style={{ fontSize: '12px', color: 'var(--accent-green)', marginLeft: 8 }}>{t('quiz.teamAnswered')}</span>}
                        </p>
                      </div>
                    )
                  })}
                  {!mySubmittedOption && (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', fontFamily: 'var(--font-ui)' }}>{t('quiz.waitingForTeam')}</p>
                  )}
                </>
              )}
            </div>
          ) : currentQ.isFreeText ? (
            submitted || myFreeTextSubmitted ? (
              <Card padding="14px" style={{ textAlign: 'center', background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)', border: '1px solid var(--accent-green)' }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--accent-green)' }}>{t('quiz.freeTextAnswerSubmitted')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: 8 }}>
                  {(currentQ.fields ?? []).map((f: any) => (
                    <p key={f.id} style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}>
                      {f.label && <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{f.label}:</span>}{f.myAnswer ?? freeTextInputs[f.id] ?? ''}
                    </p>
                  ))}
                </div>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(currentQ.fields ?? []).map((f: any) => (
                  <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {f.label && (
                      <label style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{f.label}</span>
                        <span style={{ fontWeight: 400 }}>{t('quiz.points', { count: f.points })}</span>
                      </label>
                    )}
                    <input
                      value={freeTextInputs[f.id] ?? ''}
                      onChange={e => setFreeTextInputs(prev => ({ ...prev, [f.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmitFreeText() } }}
                      placeholder={t('quiz.freeTextPlaceholder')}
                      style={{ width: '100%', height: 46, padding: '0 12px', borderRadius: 'var(--radius)', border: '2px solid var(--border-light)', fontSize: '15px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                ))}
                <Button
                  fullWidth
                  size="lg"
                  disabled={(currentQ.fields ?? []).every((f: any) => !(freeTextInputs[f.id] ?? '').trim())}
                  loading={submitAnswer.isPending}
                  onClick={handleSubmitFreeText}
                >
                  {t('quiz.freeTextSubmit')}
                </Button>
              </div>
            )
          ) : (
            <div className="qz-deal" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentQ.options.map((opt: any) => {
                const picked = (selectedOption ?? mySubmittedOption) === opt.id
                // Wrapper owns the one-shot deal-in; the button owns selection state.
                // Keeping them on separate elements stops a de-selected option from
                // replaying the (opacity:0) entrance and flashing away.
                return (
                  <div key={opt.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectOption(opt.id)}
                      className={`card-interactive${picked ? ' qz-selected' : ''}`}
                      style={{
                        padding: opt.imageUrl ? '12px' : '14px 16px',
                        borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left', width: '100%',
                        border: `2px solid ${picked ? 'var(--accent)' : 'var(--border-light)'}`,
                        background: picked ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--background)',
                        transition: 'border-color 120ms var(--ease-out), background 120ms var(--ease-out)',
                      }}
                    >
                      {opt.imageUrl && (
                        <img src={opt.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginBottom: 8, display: 'block' }} />
                      )}
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: picked ? 700 : 500, fontSize: '15px' }}>{opt.text}</p>
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* QM controls */}
          {isQM && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius)', marginTop: '4px' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('quiz.quizMaster')}</p>

              {/* Answer status per team/player */}
              <div className="qz-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                {isTeamComp && competition.teams.map((t: any) => {
                  const answered = currentQ.answeredTeams?.includes(t.id)
                  return (
                    <span key={t.id} style={{
                      padding: '3px 8px', borderRadius: '99px', fontSize: '12px', fontFamily: 'var(--font-ui)', fontWeight: 600,
                      background: answered ? 'color-mix(in srgb, var(--accent-green) 15%, transparent)' : 'var(--surface)',
                      color: answered ? 'var(--accent-green)' : 'var(--text-muted)',
                      border: `1px solid ${answered ? 'var(--accent-green)' : 'var(--border-light)'}`,
                    }}>
                      {answered ? '✓ ' : ''}{t.name}
                    </span>
                  )
                })}
                {!isTeamComp && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {t('quiz.answered', { count: currentQ.answeredUserIds?.length ?? 0, total: competition.players.length })}
                    {currentQ.answeredUserIds?.length === competition.players.length && (
                      <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{t('quiz.allAnswered')}</span>
                    )}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  size="sm"
                  disabled={countdownSecs !== null}
                  onClick={() => qmMutate(() => api.quiz.nextQuestion(ccId!))}
                >
                  {countdownSecs !== null
                    ? t('quiz.countdown5s', { count: countdownSecs })
                    : session.currentQuestionIndex >= questions.length - 1 ? t('quiz.startCorrection') : t('quiz.nextQuestion')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CORRECTING ───────────────────────────────────────────────────── */}
      {session.status === 'CORRECTING' && correctionQ && (() => {
        // Did *I* / my team get this one right? Drives a happy vs. sad reveal.
        const myOpt = correctionQ.options?.find((o: any) => o.id === correctionQ.myOptionId)
        const iAnswered = !correctionQ.isFreeText && !!correctionQ.myOptionId
        const iGotItRight = iAnswered && !!myOpt?.isCorrect
        const iGotItWrong = iAnswered && !!myOpt && !myOpt.isCorrect
        const isObserver = isQM || isGuest
        const revealed = session.correctAnswerVisible && !correctionQ.isFreeText
        const showHappy = revealed && (iGotItRight || (isObserver && !iGotItWrong))
        const showSad = revealed && iGotItWrong
        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
          {/* Win → confetti + coins. Loss → red flash + sad-smiley rain. */}
          {showHappy && (
            <Confetti key={`win-${session.correctionIndex}`} count={46} emojis={['🎉', '⭐', '🪙']} />
          )}
          {showSad && (
            <>
              <div className="qz-red-flash" key={`flash-${session.correctionIndex}`} aria-hidden />
              <Confetti
                key={`lose-${session.correctionIndex}`}
                count={30}
                durationBase={2000}
                emojiChance={0.85}
                colors={['#d7283d', '#9aa3ab', '#6b7480']}
                emojis={['😢', '😭', '💧', '💔']}
              />
            </>
          )}
          {/* Scoreboard strip — includes current question once answer is revealed */}
          <MiniScoreboard
            questions={questions.slice(0, session.correctionIndex + (session.correctAnswerVisible ? 1 : 0))}
            teams={competition.teams}
            players={competition.players}
            isTeamComp={isTeamComp}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              {t('quiz.correcting', { current: session.correctionIndex + 1, total: questions.length })}
            </p>
            <span className="qz-points" style={{
              padding: '3px 10px', borderRadius: '99px',
              background: 'var(--accent)', color: '#fff',
              fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '13px',
            }}>
              {t('quiz.points', { count: correctionQ.points })}
            </span>
          </div>

          <Card key={session.correctionIndex} className="qz-question-in">
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px', lineHeight: 1.4 }}>{correctionQ.text}</p>
            <QuestionDescription html={correctionQ.description} />
            {correctionQ.imageUrl && <img src={correctionQ.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginTop: 8, display: 'block' }} />}
          </Card>

          {/* Answer options / free text answers */}
          {correctionQ.isFreeText ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Player view: their own per-field answers; points revealed once locked */}
              {!isQM && (correctionQ.fields ?? []).some((f: any) => f.myAnswer != null) && (
                <Card padding="12px">
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: 6 }}>{t('quiz.yourAnswer')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(correctionQ.fields ?? []).map((f: any) => (
                      <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '15px' }}>
                          {f.label && <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '12px', marginRight: 6 }}>{f.label}:</span>}
                          <span style={{ fontWeight: 700 }}>{f.myAnswer}</span>
                        </p>
                        {f.myLocked && f.myPoints !== null && (
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--accent-green)', fontWeight: 700, flexShrink: 0 }}>
                            {t('quiz.freeTextPointsAwarded', { points: f.myPoints, max: f.points })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* QM view: one card per respondent; each field scored individually with lock */}
              {isQM && (() => {
                const respondents = groupFieldAnswers(correctionQ, competition, isTeamComp)
                return (
                  <>
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {t('quiz.freeTextAnswers')}
                    </p>
                    {respondents.length === 0 ? (
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('quiz.freeTextNoAnswers')}</p>
                    ) : respondents.map(r => {
                      const allLocked = r.entries.every(e => e.answer.locked)
                      return (
                        <div key={r.key} style={{
                          padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--background)',
                          border: `1.5px solid ${allLocked ? 'var(--accent-green)' : 'var(--border-light)'}`,
                          transition: 'border-color 200ms',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px' }}>{r.name}</p>
                            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '13px', color: 'var(--accent)' }}>
                              {t('quiz.points', { count: respondentPoints(r.entries) })}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {r.entries.map(({ field, answer }) => {
                              const pts = answer.points ?? 0
                              const locked = !!answer.locked
                              return (
                                <div key={answer.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8, borderTop: '1px solid var(--border-light)' }}>
                                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}>
                                    {field.label && <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, marginRight: 6 }}>{field.label}:</span>}
                                    {answer.answer || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}
                                  </p>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                      type="button"
                                      onClick={() => !locked && setFieldPoints.mutate({ answerId: answer.id, points: Math.max(0, pts - 1) })}
                                      disabled={pts <= 0 || locked}
                                      style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border-light)', background: 'var(--surface)', fontSize: '18px', cursor: (pts <= 0 || locked) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (pts <= 0 || locked) ? 0.3 : 1, fontWeight: 700 }}
                                    >−</button>
                                    <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '15px', minWidth: 54, textAlign: 'center' }}>
                                      {pts} / {field.points}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => !locked && setFieldPoints.mutate({ answerId: answer.id, points: Math.min(field.points, pts + 1) })}
                                      disabled={locked || pts >= field.points}
                                      style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border-light)', background: 'var(--surface)', fontSize: '18px', cursor: (locked || pts >= field.points) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (locked || pts >= field.points) ? 0.3 : 1, fontWeight: 700 }}
                                    >+</button>
                                    <button
                                      type="button"
                                      onClick={() => toggleFieldLock.mutate(answer.id)}
                                      style={{
                                        marginLeft: 'auto', padding: '4px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                        border: `1.5px solid ${locked ? 'var(--accent-green)' : 'var(--border-light)'}`,
                                        background: locked ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)' : 'var(--surface)',
                                        color: locked ? 'var(--accent-green)' : 'var(--text-muted)',
                                        fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px',
                                        transition: 'border-color 150ms, background 150ms, color 150ms',
                                      }}
                                    >
                                      {locked ? t('quiz.freeTextLockedStatus') : t('quiz.freeTextLock')}
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )
              })()}
            </div>
          ) : (
            <div className="qz-deal" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {correctionQ.options.map((opt: any) => {
                const isMine = correctionQ.myOptionId === opt.id
                const isCorrect = session.correctAnswerVisible && opt.isCorrect
                const isWrong = session.correctAnswerVisible && isMine && !opt.isCorrect
                const count = correctionQ.answerCounts?.find((ac: any) => ac.optionId === opt.id)
                const teams = count?.teams ?? []
                const pct = isTeamComp
                  ? Math.round(((count?.count ?? 0) / Math.max(1, competition.teams.length)) * 100)
                  : Math.round(((count?.count ?? 0) / Math.max(1, competition.players.length)) * 100)

                return (
                  <div
                    key={opt.id}
                    className={isCorrect ? 'qz-correct-burst' : isWrong ? 'qz-wrong-shake' : undefined}
                    style={{
                      padding: '12px 14px', borderRadius: 'var(--radius)', position: 'relative', overflow: 'hidden',
                      border: `2px solid ${isCorrect ? 'var(--accent-green)' : isMine ? 'var(--accent)' : 'var(--border-light)'}`,
                      background: isCorrect ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)' : 'var(--background)',
                      boxShadow: isCorrect ? '0 0 0 3px color-mix(in srgb, var(--accent-green) 25%, transparent)' : 'none',
                      transition: 'border-color 300ms var(--ease-out), box-shadow 300ms var(--ease-out)',
                    }}
                  >
                    {session.correctAnswerVisible && (
                      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, background: isCorrect ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)' : 'color-mix(in srgb, var(--text-muted) 8%, transparent)', transition: 'width 650ms var(--ease-out)' }} />
                    )}

                    <div style={{ position: 'relative' }}>
                      {opt.imageUrl && (
                        <img src={opt.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginBottom: 8, display: 'block' }} />
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <p style={{ flex: 1, fontFamily: 'var(--font-ui)', fontWeight: isMine ? 700 : 500, fontSize: '15px' }}>
                          {opt.text}
                          {isMine && <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 6 }}>{t('quiz.yourAnswer')}</span>}
                          {isCorrect && <span style={{ marginLeft: 8 }}>✅</span>}
                          {isWrong && <span style={{ marginLeft: 8 }}>❌</span>}
                        </p>
                        {session.correctAnswerVisible && (
                          <CountUp value={pct} suffix="%" duration={650} style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: isCorrect ? 'var(--accent-green)' : 'var(--text-muted)', flexShrink: 0 }} />
                        )}
                      </div>
                    </div>

                    {session.correctAnswerVisible && isTeamComp && teams.length > 0 && (
                      <div className="qz-chips" style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {teams.map((teamId: string) => {
                          const teamObj = competition.teams.find((x: any) => x.id === teamId)
                          return (
                            <span key={teamId} style={{
                              padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: 600,
                              background: isCorrect ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)' : 'var(--surface)',
                              color: isCorrect ? 'var(--accent-green)' : 'var(--text-muted)',
                            }}>
                              {teamObj?.name ?? teamId}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* QM controls */}
          {isQM && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius)' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('quiz.quizMaster')}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {correctionQ.isFreeText ? (() => {
                  const allLocked = allFieldAnswersLocked(correctionQ)
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <Button size="sm" disabled={!allLocked} onClick={() => qmMutate(() => api.quiz.nextCorrection(ccId!))}>
                        {session.correctionIndex >= questions.length - 1 ? t('quiz.completeQuiz') : t('quiz.nextCorrection')}
                      </Button>
                      {!allLocked && (
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{t('quiz.freeTextLockAllFirst')}</p>
                      )}
                    </div>
                  )
                })() : (
                  <>
                    {!session.correctAnswerVisible && (
                      <Button size="sm" onClick={() => qmMutate(() => api.quiz.showAnswer(ccId!))}>
                        {t('quiz.showAnswer')}
                      </Button>
                    )}
                    {session.correctAnswerVisible && (
                      <Button size="sm" onClick={() => qmMutate(() => api.quiz.nextCorrection(ccId!))}>
                        {session.correctionIndex >= questions.length - 1 ? t('quiz.completeQuiz') : t('quiz.nextCorrection')}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        )
      })()}

      {/* ── COMPLETED ────────────────────────────────────────────────────── */}
      {session.status === 'COMPLETED' && (() => {
        // Compute quiz scores from answer data
        const scoreMap: Record<string, number> = {}
        for (const q of questions) {
          if (q.isFreeText) {
            for (const f of q.fields ?? []) {
              for (const a of f.answers ?? []) {
                const pts = a.points ?? 0
                if (pts <= 0) continue
                if (isTeamComp && a.teamId) {
                  scoreMap[a.teamId] = (scoreMap[a.teamId] ?? 0) + pts
                } else if (!isTeamComp && a.userId) {
                  scoreMap[a.userId] = (scoreMap[a.userId] ?? 0) + pts
                }
              }
            }
          } else {
            const correctOpt = q.options?.find((o: any) => o.isCorrect)
            if (!correctOpt) continue
            const entry = q.answerCounts?.find((ac: any) => ac.optionId === correctOpt.id)
            if (!entry) continue
            if (isTeamComp) {
              for (const teamId of entry.teams ?? []) {
                scoreMap[teamId] = (scoreMap[teamId] ?? 0) + q.points
              }
            } else {
              for (const uid of entry.users ?? []) {
                scoreMap[uid] = (scoreMap[uid] ?? 0) + q.points
              }
            }
          }
        }

        // Build sorted list with tied ranks
        const allEntries = (isTeamComp
          ? competition.teams
              .map((t: any) => ({ id: t.id, name: t.name, imageUrl: t.imageUrl, score: scoreMap[t.id] ?? 0 }))
          : competition.players
              .filter((p: any) => !p.user?.isDummy)
              .map((p: any) => ({ id: p.userId, name: p.user?.displayName ?? p.user?.username, imageUrl: p.user?.profileImageUrl, score: scoreMap[p.userId] ?? 0 }))
        ).sort((a: any, b: any) => b.score - a.score)

        // Assign tied ranks (1,1,3 style)
        const ranked: Array<any & { rank: number }> = []
        let currentRank = 1
        for (let i = 0; i < allEntries.length; i++) {
          if (i > 0 && allEntries[i].score !== allEntries[i - 1].score) currentRank = i + 1
          ranked.push({ ...allEntries[i], rank: currentRank })
        }

        // Group by rank, keep only rank 1, 2, 3
        const rankGroups: Record<number, typeof ranked> = {}
        for (const e of ranked) {
          if (e.rank > 3) break
          if (!rankGroups[e.rank]) rankGroups[e.rank] = []
          rankGroups[e.rank].push(e)
        }
        const podiumMedal = (rank: number) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
        const podiumPlatformHeight = (rank: number) => rank === 1 ? 100 : rank === 2 ? 80 : 60
        // Visual order: 2nd left, 1st centre, 3rd right — only include ranks that have entries
        const podiumVisualOrder = ([2, 1, 3] as const).filter(r => rankGroups[r])

        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
          {/* Grand-finale celebration */}
          <Confetti count={70} durationBase={2200} emojis={['🎉', '🎊', '⭐', '🏆', '🪙']} style={{ position: 'fixed', zIndex: 50 }} />
          <Card className="qz-banner-in" style={{ textAlign: 'center', padding: '20px 16px', background: 'var(--text-primary)' }}>
            <p className="qz-float" style={{ fontSize: '32px', marginBottom: '6px' }}>🏁</p>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '20px', color: '#fff', marginBottom: '4px' }}>{t('quiz.quizComplete')}</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{t('quiz.scoresSubmitted')}</p>
          </Card>

          {/* Podium — visual columns, tied ranks show overlapping avatars */}
          {podiumVisualOrder.length > 0 && (
            <Card padding="16px">
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', textAlign: 'center' }}>
                {isTeamComp ? t('quiz.teamScores') : t('quiz.playerScores')}
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px' }}>
                {podiumVisualOrder.map(rank => {
                  const entries = rankGroups[rank]
                  const h = podiumPlatformHeight(rank)
                  const gold = rank === 1
                  // Stagger the reveal so the winner lands last for maximum drama
                  const riseDelay = rank === 1 ? 320 : rank === 2 ? 150 : 0
                  return (
                    <div key={rank} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                      <span className="qz-medal" style={{ fontSize: gold ? '26px' : '22px', lineHeight: 1, animationDelay: `${riseDelay + 280}ms` }}>{podiumMedal(rank)}</span>
                      {/* Overlapping avatars when multiple entries share a rank */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {entries.map((e: any, i: number) => (
                          <div key={e.id} className={gold && i === 0 ? 'qz-gold-pulse' : undefined} style={{ marginLeft: i > 0 ? '-10px' : 0, zIndex: entries.length - i, borderRadius: '50%' }}>
                            <Avatar
                              src={e.imageUrl} name={e.name}
                              size={gold ? 40 : 32}
                              style={{ border: '2px solid var(--background)', ...(isTeamComp ? { borderRadius: '50%' } : {}) }}
                            />
                          </div>
                        ))}
                      </div>
                      {/* Name(s) — truncated if too long */}
                      <div style={{ width: '100%', textAlign: 'center' }}>
                        {entries.map((e: any) => (
                          <p key={e.id} style={{
                            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '11px',
                            lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{e.name}</p>
                        ))}
                      </div>
                      {/* Platform block */}
                      <div className={`qz-platform${gold ? ' qz-gold-shimmer' : ''}`} style={{
                        width: '100%', height: h,
                        borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                        background: gold ? 'var(--text-primary)' : 'var(--surface)',
                        border: gold ? '2px solid var(--text-primary)' : '1.5px solid var(--border-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animationDelay: `${riseDelay}ms`,
                      }}>
                        <p style={{ position: 'relative', fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: gold ? '20px' : '16px', color: gold ? '#fff' : 'var(--text-primary)' }}>
                          <CountUp value={entries[0].score} duration={1100} />
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Full results toggle — only shown when more than 3 participants */}
              {ranked.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowFullResults(v => !v)}
                  style={{
                    display: 'block', width: '100%', marginTop: '16px', padding: '8px 0',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px',
                    color: 'var(--accent)', textAlign: 'center',
                  }}
                >
                  {showFullResults ? t('quiz.hideFullResults') : t('quiz.seeAllResults', { count: ranked.length })}
                </button>
              )}

              {/* Expanded full leaderboard */}
              {showFullResults && (
                <div className="stagger" style={{ marginTop: '4px' }}>
                  {ranked.map((e: any, i: number) => (
                    <div key={e.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 0', borderTop: '1px solid var(--border-light)',
                    }}>
                      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', minWidth: '30px', textAlign: 'center', flexShrink: 0 }}>
                        {e.rank <= 3 ? podiumMedal(e.rank) : `#${e.rank}`}
                      </span>
                      <Avatar src={e.imageUrl} name={e.name} size={28} style={{ flexShrink: 0, ...(isTeamComp ? { borderRadius: '50%' } : {}) }} />
                      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '14px', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                        {e.score} {t('leaderboardContent.pts')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Full answer matrix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {questions.map((q: any, qi: number) => (
              <Card key={q.id} padding="14px">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px' }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>Q{qi + 1}.</span>{q.text}
                      {q.isFreeText && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>{t('quiz.freeText')}</span>}
                    </p>
                    <QuestionDescription html={q.description} />
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}>
                    {t('quiz.points', { count: q.isFreeText ? (q.fields ?? []).reduce((s: number, f: any) => s + f.points, 0) : q.points })}
                  </span>
                </div>
                {q.imageUrl && (
                  <img src={q.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginBottom: 10, display: 'block' }} />
                )}
                {q.isFreeText ? (() => {
                  const respondents = groupFieldAnswers(q, competition, isTeamComp)
                  const maxPts = (q.fields ?? []).reduce((s: number, f: any) => s + f.points, 0)
                  return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {respondents.length === 0 ? (
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('quiz.freeTextNoAnswers')}</p>
                    ) : respondents.map(r => {
                      const isMine = isTeamComp ? r.teamId === myTeamId : r.userId === user?.id
                      const pts = respondentPoints(r.entries)
                      return (
                        <div key={r.key} style={{
                          padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                          border: `1.5px solid ${isMine ? 'var(--accent)' : 'var(--border-light)'}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontWeight: 700 }}>{r.name}</p>
                            <span style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', fontWeight: 700, color: pts > 0 ? 'var(--accent-green)' : 'var(--text-muted)', flexShrink: 0 }}>
                              {t('quiz.freeTextPointsAwarded', { points: pts, max: maxPts })}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                            {r.entries.map(({ field, answer }) => (
                              <p key={answer.id} style={{ fontSize: '14px', fontFamily: 'var(--font-ui)' }}>
                                {field.label && <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginRight: 6 }}>{field.label}:</span>}{answer.answer}
                              </p>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  )
                })() : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {q.options.map((opt: any) => {
                      const isMine = q.myOptionId === opt.id
                      const count = q.answerCounts?.find((ac: any) => ac.optionId === opt.id)
                      const teams = count?.teams ?? []
                      return (
                        <div key={opt.id} style={{
                          padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                          border: `1.5px solid ${opt.isCorrect ? 'var(--accent-green)' : isMine ? 'var(--accent)' : 'var(--border-light)'}`,
                          background: opt.isCorrect ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)' : 'transparent',
                        }}>
                          {opt.imageUrl && (
                            <img src={opt.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginBottom: 6, display: 'block' }} />
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px' }}>{opt.isCorrect ? '✅' : isMine ? '❌' : '○'}</span>
                            <p style={{ flex: 1, fontSize: '14px', fontFamily: 'var(--font-ui)', fontWeight: opt.isCorrect ? 700 : 400 }}>{opt.text}</p>
                            {isMine && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('quiz.yourAnswer')}</span>}
                            {count?.count > 0 && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{count.count}</span>
                            )}
                          </div>
                          {isTeamComp && teams.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px', paddingLeft: '21px' }}>
                              {teams.map((teamId: string) => {
                                const teamObj = competition.teams.find((x: any) => x.id === teamId)
                                return <span key={teamId} style={{ padding: '1px 6px', borderRadius: '99px', fontSize: '10px', background: 'var(--surface)', color: 'var(--text-muted)' }}>{teamObj?.name ?? teamId}</span>
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
        )
      })()}
    </Layout>
  )
}
