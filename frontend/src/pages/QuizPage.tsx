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
import { useTranslation } from 'react-i18next'

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
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-ui)', fontWeight: 700, marginBottom: 4 }}>
        <span>{t('quiz.timeLeft')}</span><span style={{ color: remaining <= 5 ? 'var(--accent-warm)' : undefined }}>{remaining}s</span>
      </div>
      <div style={{ height: 6, background: 'var(--surface)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 99,
          background: remaining <= 5 ? 'var(--accent-warm)' : 'var(--accent)',
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
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
          borderRadius: 'var(--radius)', background: i === 0 ? 'var(--text-primary)' : 'var(--surface)',
          minWidth: 100, flexShrink: 0,
        }}>
          <span style={{ fontSize: '14px' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
          <div>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px', color: i === 0 ? '#fff' : undefined }}>{t.name}</p>
            <p style={{ fontSize: '11px', color: i === 0 ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>{scores[t.id] ?? 0} pts</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function QuizPage() {
  const { competitionId, ccId } = useParams<{ competitionId: string; ccId: string }>()
  const { user, isAdmin } = useAuth()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [freeTextInput, setFreeTextInput] = useState('')
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
  useEffect(() => { setSelectedOption(null); setSubmitted(false); setFreeTextInput('') }, [currentIdx, sessionStatus])

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
    mutationFn: ({ optionId, freeTextAnswer, teamId }: { optionId?: string; freeTextAnswer?: string; teamId?: string }) =>
      api.quiz.submitAnswer(ccId!, { questionId: currentQ?.id, optionId, freeTextAnswer, teamId }),
    onSuccess: () => { setSubmitted(true); qc.invalidateQueries({ queryKey: ['quiz', ccId] }) },
  })

  const setFreeTextPoints = useMutation({
    mutationFn: ({ answerId, points }: { answerId: string; points: number }) =>
      api.quiz.setFreeTextPoints(ccId!, answerId, points),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', ccId] }),
  })

  const toggleFreeTextLock = useMutation({
    mutationFn: (answerId: string) => api.quiz.toggleFreeTextLock(ccId!, answerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', ccId] }),
  })

  const readyMutation = useMutation({
    mutationFn: (teamId?: string) => api.quiz.markReady(ccId!, teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', ccId] }),
  })

  const qmMutate = useCallback((action: () => Promise<any>) => {
    action().then(() => qc.invalidateQueries({ queryKey: ['quiz', ccId] }))
  }, [ccId, qc])

  if (isLoading) return <Layout title={t('quiz.title')} back={`/competitions/${competitionId}`}><LoadingSpinner /></Layout>
  if (!data) return <Layout title={t('quiz.title')} back={`/competitions/${competitionId}`}><p>{t('quiz.notFound')}</p></Layout>

  const { session, isQM, isTeamComp, myTeamId, myIsTeamLeader, myIsScorekeeper, competition, questions, challengeId } = data
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
    const text = freeTextInput.trim()
    if (!text || currentQ?.locked || session.status !== 'ACTIVE') return
    const teamId = isTeamComp ? myTeamId ?? undefined : undefined
    submitAnswer.mutate({ freeTextAnswer: text, teamId })
  }

  return (
    <Layout
      title={t('quiz.title')}
      back={`/competitions/${competitionId}`}
    >
      {/* ── LOBBY ────────────────────────────────────────────────────────── */}
      {session.status === 'LOBBY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card style={{ textAlign: 'center', padding: '32px 16px' }}>
            <p style={{ fontSize: '40px', marginBottom: '8px' }}>🎯</p>
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
            <Card padding="12px" style={{ textAlign: 'center', background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)', border: '1px solid var(--accent-green)' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--accent-green)' }}>{t('quiz.ready')}</p>
            </Card>
          )}

          {/* Ready list */}
          <Card>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>
              {isTeamComp ? t('quiz.teamsReady') : t('quiz.playersReady')} ({readyIds.size}/{isTeamComp ? competition.teams.length : competition.players.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
              <Link to={`/competitions/${competitionId}/quiz/${ccId}/edit`} style={{ textDecoration: 'none' }}>
                <Button fullWidth variant="ghost" size="lg">{t('quiz.editQuestions')}</Button>
              </Link>
              <Button fullWidth size="lg" onClick={() => setConfirmStart(true)}>
                {t('quiz.startQuiz')}
              </Button>
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
            <span style={{
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

          {/* Next-question countdown — shown to everyone */}
          {countdownSecs !== null && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: 'var(--accent-warm)' }}>
                  {session.currentQuestionIndex >= questions.length - 1 ? t('quiz.quizCompletesIn') : t('quiz.nextQuestionIn')}
                </span>
                <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '22px', color: 'var(--accent-warm)', lineHeight: 1 }}>
                  {countdownSecs}
                </span>
              </div>
              <div style={{ height: 8, background: 'var(--surface)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: 'var(--accent-warm)',
                  width: `${(countdownSecs / 5) * 100}%`,
                  transition: 'width 200ms linear',
                }} />
              </div>
            </div>
          )}

          {/* Question card */}
          <Card>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px', lineHeight: 1.4 }}>
              {currentQ.text}
            </p>
            {currentQ.imageUrl && (
              <img src={currentQ.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginTop: 10, display: 'block' }} />
            )}
          </Card>

          {/* Options — QM sees live distribution, guests see read-only, players see answer buttons */}
          {isQM ? (
            currentQ.isFreeText ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)' }}>
                  {t('quiz.freeTextAnswers')} ({currentQ.answeredUserIds?.length ?? currentQ.answeredTeams?.length ?? 0})
                </p>
                {(currentQ.freeTextAnswers ?? []).length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('quiz.freeTextNoAnswers')}</p>
                ) : (currentQ.freeTextAnswers ?? []).map((a: any) => {
                  const label = isTeamComp
                    ? competition.teams.find((x: any) => x.id === a.teamId)?.name ?? a.teamId
                    : competition.players.find((x: any) => x.userId === a.userId)?.user?.displayName ?? a.userId
                  return (
                    <div key={a.id} style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', border: '1px solid var(--border-light)' }}>
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
                      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}>{a.freeTextAnswer}</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentQ.options.map((opt: any) => {
                  const count = currentQ.answerCounts?.find((ac: any) => ac.optionId === opt.id)
                  const teams: string[] = count?.teams ?? []
                  const answered = isTeamComp ? teams.length : (count?.count ?? 0)
                  const total = isTeamComp ? competition.teams.length : competition.players.length
                  const pct = total > 0 ? Math.round((answered / total) * 100) : 0
                  const hasPicks = answered > 0
                  return (
                    <div key={opt.id} style={{
                      borderRadius: 'var(--radius)', border: `2px solid ${hasPicks ? 'var(--accent)' : 'var(--border-light)'}`,
                      overflow: 'hidden', background: 'var(--background)', position: 'relative',
                      transition: 'border-color 200ms',
                    }}>
                      {hasPicks && (
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', transition: 'width 300ms' }} />
                      )}
                      <div style={{ position: 'relative', padding: '12px 14px' }}>
                        {opt.imageUrl && (
                          <img src={opt.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginBottom: 8, display: 'block' }} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <p style={{ fontFamily: 'var(--font-ui)', fontWeight: hasPicks ? 700 : 500, fontSize: '15px' }}>{opt.text}</p>
                          {hasPicks && !isTeamComp && (
                            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: 'var(--accent)', flexShrink: 0 }}>{answered}</span>
                          )}
                        </div>
                        {isTeamComp && teams.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                            {teams.map((teamId: string) => {
                              const teamObj = competition.teams.find((x: any) => x.id === teamId)
                              return <span key={teamId} style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: 700, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>{teamObj?.name ?? teamId}</span>
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
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
                  ? (currentQ.myFreeTextAnswer ? t('quiz.freeTextAnswerSubmitted') : t('quiz.questionLocked'))
                  : (mySubmittedOption ? t('quiz.answerSubmitted') : t('quiz.questionLocked'))}
              </p>
              {currentQ.isFreeText && currentQ.myFreeTextAnswer && (
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', marginTop: 6, color: 'var(--text-primary)' }}>{currentQ.myFreeTextAnswer}</p>
              )}
            </Card>
          ) : !canAct ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentQ.isFreeText ? (
                currentQ.myFreeTextAnswer ? (
                  <Card padding="14px" style={{ background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)', border: '1px solid var(--accent-green)' }}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: 'var(--accent-green)', marginBottom: 4 }}>{t('quiz.teamAnswered')}</p>
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}>{currentQ.myFreeTextAnswer}</p>
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
            submitted || currentQ.myFreeTextAnswer ? (
              <Card padding="14px" style={{ textAlign: 'center', background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)', border: '1px solid var(--accent-green)' }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--accent-green)' }}>{t('quiz.freeTextAnswerSubmitted')}</p>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', marginTop: 6 }}>{currentQ.myFreeTextAnswer ?? freeTextInput}</p>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea
                  value={freeTextInput}
                  onChange={e => setFreeTextInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitFreeText() } }}
                  placeholder={t('quiz.freeTextPlaceholder')}
                  rows={3}
                  style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius)', border: '2px solid var(--border-light)', fontSize: '15px', fontFamily: 'var(--font-ui)', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
                />
                <Button
                  fullWidth
                  size="lg"
                  disabled={!freeTextInput.trim()}
                  loading={submitAnswer.isPending}
                  onClick={handleSubmitFreeText}
                >
                  {t('quiz.freeTextSubmit')}
                </Button>
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentQ.options.map((opt: any) => {
                const picked = (selectedOption ?? mySubmittedOption) === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(opt.id)}
                    style={{
                      padding: opt.imageUrl ? '12px' : '14px 16px',
                      borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left', width: '100%',
                      border: `2px solid ${picked ? 'var(--accent)' : 'var(--border-light)'}`,
                      background: picked ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--background)',
                      transition: 'border-color 120ms, background 120ms',
                    }}
                  >
                    {opt.imageUrl && (
                      <img src={opt.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginBottom: 8, display: 'block' }} />
                    )}
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: picked ? 700 : 500, fontSize: '15px' }}>{opt.text}</p>
                  </button>
                )
              })}
            </div>
          )}

          {/* QM controls */}
          {isQM && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius)', marginTop: '4px' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('quiz.quizMaster')}</p>

              {/* Answer status per team/player */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
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
      {session.status === 'CORRECTING' && correctionQ && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            <span style={{
              padding: '3px 10px', borderRadius: '99px',
              background: 'var(--accent)', color: '#fff',
              fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '13px',
            }}>
              {t('quiz.points', { count: correctionQ.points })}
            </span>
          </div>

          <Card>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px', lineHeight: 1.4 }}>{correctionQ.text}</p>
            {correctionQ.imageUrl && <img src={correctionQ.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginTop: 8, display: 'block' }} />}
          </Card>

          {/* Answer options / free text answers */}
          {correctionQ.isFreeText ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Player view: show their own submitted answer; points only revealed once locked */}
              {!isQM && correctionQ.myFreeTextAnswer && (
                <Card padding="12px">
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4 }}>{t('quiz.yourAnswer')}</p>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px' }}>{correctionQ.myFreeTextAnswer}</p>
                  {correctionQ.myFreeTextLocked && correctionQ.myFreeTextPoints !== null && (
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--accent-green)', marginTop: 4, fontWeight: 700 }}>
                      {t('quiz.freeTextPointsAwarded', { points: correctionQ.myFreeTextPoints, max: correctionQ.points })}
                    </p>
                  )}
                </Card>
              )}

              {/* QM view: all submitted answers with +/- point controls and per-answer lock */}
              {isQM && (
                <>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    {t('quiz.freeTextAnswers')}
                  </p>
                  {(correctionQ.freeTextAnswers ?? []).length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('quiz.freeTextNoAnswers')}</p>
                  ) : (correctionQ.freeTextAnswers ?? []).map((a: any) => {
                    const label = isTeamComp
                      ? competition.teams.find((x: any) => x.id === a.teamId)?.name ?? a.teamId
                      : competition.players.find((x: any) => x.userId === a.userId)?.user?.displayName ?? a.userId
                    const pts = a.freeTextPoints ?? 0
                    const locked = !!a.freeTextLocked
                    return (
                      <div key={a.id} style={{
                        padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--background)',
                        border: `1.5px solid ${locked ? 'var(--accent-green)' : 'var(--border-light)'}`,
                        transition: 'border-color 200ms',
                      }}>
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', marginBottom: 8 }}>{a.freeTextAnswer}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => !locked && setFreeTextPoints.mutate({ answerId: a.id, points: Math.max(0, pts - 1) })}
                            disabled={pts <= 0 || locked}
                            style={{
                              width: 32, height: 32, borderRadius: '50%', border: '1.5px solid var(--border-light)', background: 'var(--surface)',
                              fontSize: '18px', cursor: (pts <= 0 || locked) ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              opacity: (pts <= 0 || locked) ? 0.3 : 1, fontWeight: 700,
                            }}
                          >−</button>
                          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '16px', minWidth: 48, textAlign: 'center' }}>
                            {pts}
                          </span>
                          <button
                            type="button"
                            onClick={() => !locked && setFreeTextPoints.mutate({ answerId: a.id, points: pts + 1 })}
                            disabled={locked}
                            style={{
                              width: 32, height: 32, borderRadius: '50%', border: '1.5px solid var(--border-light)', background: 'var(--surface)',
                              fontSize: '18px', cursor: locked ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              opacity: locked ? 0.3 : 1, fontWeight: 700,
                            }}
                          >+</button>
                          <button
                            type="button"
                            onClick={() => toggleFreeTextLock.mutate(a.id)}
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
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                    style={{
                      padding: '12px 14px', borderRadius: 'var(--radius)', position: 'relative', overflow: 'hidden',
                      border: `2px solid ${isCorrect ? 'var(--accent-green)' : isMine ? 'var(--accent)' : 'var(--border-light)'}`,
                      background: isCorrect ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)' : 'var(--background)',
                      boxShadow: isCorrect ? '0 0 0 3px color-mix(in srgb, var(--accent-green) 25%, transparent)' : 'none',
                      transition: 'border-color 300ms, box-shadow 300ms',
                    }}
                  >
                    {session.correctAnswerVisible && (
                      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, background: isCorrect ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)' : 'color-mix(in srgb, var(--text-muted) 8%, transparent)', transition: 'width 400ms' }} />
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
                          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>{pct}%</span>
                        )}
                      </div>
                    </div>

                    {session.correctAnswerVisible && isTeamComp && teams.length > 0 && (
                      <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
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
                  const answers = correctionQ.freeTextAnswers ?? []
                  const allLocked = answers.length === 0 || answers.every((a: any) => a.freeTextLocked)
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
      )}

      {/* ── COMPLETED ────────────────────────────────────────────────────── */}
      {session.status === 'COMPLETED' && (() => {
        // Compute quiz scores from answer data
        const scoreMap: Record<string, number> = {}
        for (const q of questions) {
          if (q.isFreeText) {
            for (const a of q.freeTextAnswers ?? []) {
              const pts = a.freeTextPoints ?? 0
              if (pts <= 0) continue
              if (isTeamComp && a.teamId) {
                scoreMap[a.teamId] = (scoreMap[a.teamId] ?? 0) + pts
              } else if (!isTeamComp && a.userId) {
                scoreMap[a.userId] = (scoreMap[a.userId] ?? 0) + pts
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card style={{ textAlign: 'center', padding: '20px 16px', background: 'var(--text-primary)' }}>
            <p style={{ fontSize: '32px', marginBottom: '6px' }}>🏁</p>
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
                  return (
                    <div key={rank} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '22px', lineHeight: 1 }}>{podiumMedal(rank)}</span>
                      {/* Overlapping avatars when multiple entries share a rank */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {entries.map((e: any, i: number) => (
                          <div key={e.id} style={{ marginLeft: i > 0 ? '-10px' : 0, zIndex: entries.length - i }}>
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
                      <div style={{
                        width: '100%', height: h,
                        borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                        background: gold ? 'var(--text-primary)' : 'var(--surface)',
                        border: gold ? '2px solid var(--text-primary)' : '1.5px solid var(--border-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: gold ? '20px' : '16px', color: gold ? '#fff' : 'var(--text-primary)' }}>
                          {entries[0].score}
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
                <div style={{ marginTop: '4px' }}>
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
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px', flex: 1 }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>Q{qi + 1}.</span>{q.text}
                    {q.isFreeText && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>{t('quiz.freeText')}</span>}
                  </p>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}>{t('quiz.points', { count: q.points })}</span>
                </div>
                {q.imageUrl && (
                  <img src={q.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginBottom: 10, display: 'block' }} />
                )}
                {q.isFreeText ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(q.freeTextAnswers ?? []).length === 0 ? (
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('quiz.freeTextNoAnswers')}</p>
                    ) : (q.freeTextAnswers ?? []).map((a: any) => {
                      const isMine = isTeamComp ? a.teamId === myTeamId : a.userId === user?.id
                      const label = isTeamComp
                        ? competition.teams.find((x: any) => x.id === a.teamId)?.name ?? a.teamId
                        : competition.players.find((x: any) => x.userId === a.userId)?.user?.displayName ?? a.userId
                      const pts = a.freeTextPoints ?? 0
                      return (
                        <div key={a.id} style={{
                          padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                          border: `1.5px solid ${isMine ? 'var(--accent)' : 'var(--border-light)'}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontWeight: 700 }}>{label}</p>
                            <span style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', fontWeight: 700, color: pts > 0 ? 'var(--accent-green)' : 'var(--text-muted)', flexShrink: 0 }}>
                              {t('quiz.freeTextPointsAwarded', { points: pts, max: q.points })}
                            </span>
                          </div>
                          <p style={{ fontSize: '14px', fontFamily: 'var(--font-ui)', marginTop: 4 }}>{a.freeTextAnswer}</p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
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
