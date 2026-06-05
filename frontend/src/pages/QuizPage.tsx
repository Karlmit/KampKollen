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

// ── Timer bar ─────────────────────────────────────────────────────────────────
function TimerBar({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
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
        <span>Time left</span><span style={{ color: remaining <= 5 ? 'var(--accent-warm)' : undefined }}>{remaining}s</span>
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
  const { user } = useAuth()
  const qc = useQueryClient()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [confirmStart, setConfirmStart] = useState(false)

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
  useEffect(() => { setSelectedOption(null); setSubmitted(false) }, [currentIdx, sessionStatus])

  const submitAnswer = useMutation({
    mutationFn: ({ optionId, teamId }: { optionId: string; teamId?: string }) =>
      api.quiz.submitAnswer(ccId!, { questionId: currentQ?.id, optionId, teamId }),
    onSuccess: () => { setSubmitted(true); qc.invalidateQueries({ queryKey: ['quiz', ccId] }) },
  })

  const readyMutation = useMutation({
    mutationFn: (teamId?: string) => api.quiz.markReady(ccId!, teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', ccId] }),
  })

  const qmMutate = useCallback((action: () => Promise<any>) => {
    action().then(() => qc.invalidateQueries({ queryKey: ['quiz', ccId] }))
  }, [ccId, qc])

  if (isLoading) return <Layout title="Quiz" back={`/competitions/${competitionId}`}><LoadingSpinner /></Layout>
  if (!data) return <Layout title="Quiz" back={`/competitions/${competitionId}`}><p>Not found</p></Layout>

  const { session, isQM, isTeamComp, myTeamId, myIsTeamLeader, myIsScorekeeper, competition, questions, challengeId } = data
  // In team mode only leaders/scorekeepers can act; in individual mode anyone can
  const canAct = !isTeamComp || isQM || myIsTeamLeader || myIsScorekeeper
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

  return (
    <Layout
      title="Quiz"
      back={`/competitions/${competitionId}`}
    >
      {/* ── LOBBY ────────────────────────────────────────────────────────── */}
      {session.status === 'LOBBY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card style={{ textAlign: 'center', padding: '32px 16px' }}>
            <p style={{ fontSize: '40px', marginBottom: '8px' }}>🎯</p>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '20px', marginBottom: '4px' }}>Quiz Lobby</p>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              {questions.length} question{questions.length !== 1 ? 's' : ''} — waiting for the Quiz Master to start.
            </p>
          </Card>

          {/* Ready button — team mode: leaders/SK only; individual mode: everyone */}
          {!isQM && canAct && !amReady && (
            <Button
              fullWidth
              size="lg"
              onClick={() => readyMutation.mutate(isTeamComp ? myTeamId ?? undefined : undefined)}
              loading={readyMutation.isPending}
            >
              ✅ Mark {isTeamComp ? (myTeam?.name ?? 'team') : 'me'} as Ready
            </Button>
          )}
          {!isQM && !canAct && !amReady && (
            <Card padding="12px" style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)' }}>
                Waiting for your team leader or scorekeeper to mark the team ready.
              </p>
            </Card>
          )}
          {amReady && (
            <Card padding="12px" style={{ textAlign: 'center', background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)', border: '1px solid var(--accent-green)' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--accent-green)' }}>✓ Ready!</p>
            </Card>
          )}

          {/* Ready list */}
          <Card>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>
              {isTeamComp ? 'TEAMS READY' : 'PLAYERS READY'} ({readyIds.size}/{isTeamComp ? competition.teams.length : competition.players.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(isTeamComp ? competition.teams : competition.players).map((item: any) => {
                const id = isTeamComp ? item.id : item.userId
                const name = isTeamComp ? item.name : (item.user?.displayName ?? item.user?.username)
                const isReady = readyIds.has(id)
                return (
                  <span key={id} style={{
                    padding: '4px 10px', borderRadius: '99px', fontSize: '13px', fontFamily: 'var(--font-ui)', fontWeight: 600,
                    background: isReady ? 'color-mix(in srgb, var(--accent-green) 15%, transparent)' : 'var(--surface)',
                    color: isReady ? 'var(--accent-green)' : 'var(--text-muted)',
                    border: `1px solid ${isReady ? 'var(--accent-green)' : 'var(--border-light)'}`,
                  }}>
                    {isReady ? '✓ ' : ''}{name}
                  </span>
                )
              })}
            </div>
          </Card>

          {/* QM controls */}
          {isQM && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link to={`/competitions/${competitionId}/quiz/${ccId}/edit`} style={{ textDecoration: 'none' }}>
                <Button fullWidth variant="ghost" size="lg">✏️ Edit Quiz Questions</Button>
              </Link>
              <Button fullWidth size="lg" onClick={() => setConfirmStart(true)}>
                🚀 Start Quiz
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Start quiz confirmation */}
      <Modal
        open={confirmStart}
        onClose={() => setConfirmStart(false)}
        title="Start Quiz?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmStart(false)}>Cancel</Button>
            <Button onClick={() => { setConfirmStart(false); qmMutate(() => api.quiz.start(ccId!)) }}>
              Start Quiz
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Once the quiz starts, <strong>questions can no longer be edited</strong>. Make sure all questions and answer options are correct before continuing.
        </p>
      </Modal>

      {/* ── ACTIVE ───────────────────────────────────────────────────────── */}
      {session.status === 'ACTIVE' && currentQ && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Progress */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              QUESTION {session.currentQuestionIndex + 1} / {questions.length}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{currentQ.points} pt{currentQ.points !== 1 ? 's' : ''}</p>
          </div>

          {/* Timer */}
          {currentQ.timerSeconds > 0 && !currentQ.locked && (
            <TimerBar key={session.currentQuestionIndex} seconds={currentQ.timerSeconds} onExpire={() => {}} />
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

          {/* Options — QM sees live distribution, players see answer buttons */}
          {isQM ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentQ.options.map((opt: any) => {
                const count = currentQ.answerCounts?.find((ac: any) => ac.optionId === opt.id)
                const teams: string[] = count?.teams ?? []
                const answered = isTeamComp ? teams.length : (count?.count ?? 0)
                const total = isTeamComp ? competition.teams.length : competition.players.length
                const pct = total > 0 ? Math.round((answered / total) * 100) : 0
                return (
                  <div key={opt.id} style={{ borderRadius: 'var(--radius)', border: '2px solid var(--border-light)', overflow: 'hidden', background: 'var(--background)', position: 'relative' }}>
                    {/* fill bar */}
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', transition: 'width 300ms' }} />
                    <div style={{ position: 'relative', padding: '12px 14px' }}>
                      {opt.imageUrl && (
                        <img src={opt.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginBottom: 8, display: 'block' }} />
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '15px' }}>{opt.text}</p>
                        <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>{answered}/{total}</span>
                      </div>
                      {isTeamComp && teams.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                          {teams.map((teamId: string) => {
                            const t = competition.teams.find((x: any) => x.id === teamId)
                            return <span key={teamId} style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: 600, background: 'var(--surface)', color: 'var(--text-muted)' }}>{t?.name ?? teamId}</span>
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : currentQ.locked ? (
            <Card padding="14px" style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--text-muted)' }}>
                {mySubmittedOption ? '✓ Answer submitted — waiting for next question' : '⏸ Question locked'}
              </p>
            </Card>
          ) : !canAct ? (
            <Card padding="14px" style={{ textAlign: 'center', background: 'var(--surface)' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)' }}>
                {mySubmittedOption ? '✓ Your team has answered' : 'Waiting for your team leader or scorekeeper to answer…'}
              </p>
            </Card>
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
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '4px' }}>QUIZ MASTER</p>

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
                    {currentQ.answeredUserIds?.length ?? 0} / {competition.players.length} answered
                    {currentQ.answeredUserIds?.length === competition.players.length && (
                      <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}> — All answered! ✓</span>
                    )}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {!session.questionLocked && (
                  <Button size="sm" variant="ghost" onClick={() => qmMutate(() => api.quiz.lockQuestion(ccId!))}>
                    🔒 Lock Answers
                  </Button>
                )}
                <Button size="sm" onClick={() => qmMutate(() => api.quiz.nextQuestion(ccId!))}>
                  {session.currentQuestionIndex >= questions.length - 1 ? '✅ Start Correction' : '→ Next Question'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CORRECTING ───────────────────────────────────────────────────── */}
      {session.status === 'CORRECTING' && correctionQ && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Scoreboard strip */}
          <MiniScoreboard questions={questions.slice(0, session.correctionIndex)} teams={competition.teams} players={competition.players} isTeamComp={isTeamComp} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              CORRECTING {session.correctionIndex + 1} / {questions.length}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{correctionQ.points} pt{correctionQ.points !== 1 ? 's' : ''}</p>
          </div>

          <Card>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px', lineHeight: 1.4 }}>{correctionQ.text}</p>
            {correctionQ.imageUrl && <img src={correctionQ.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginTop: 8, display: 'block' }} />}
          </Card>

          {/* Answer options with distribution + correct reveal */}
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
                  {/* Progress bar background */}
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
                        {isMine && <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 6 }}>(your answer)</span>}
                        {isCorrect && <span style={{ marginLeft: 8 }}>✅</span>}
                        {isWrong && <span style={{ marginLeft: 8 }}>❌</span>}
                      </p>
                      {session.correctAnswerVisible && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>{pct}%</span>
                      )}
                    </div>
                  </div>

                  {/* Team badges */}
                  {session.correctAnswerVisible && isTeamComp && teams.length > 0 && (
                    <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                      {teams.map((teamId: string) => {
                        const t = competition.teams.find((x: any) => x.id === teamId)
                        return (
                          <span key={teamId} style={{
                            padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: 600,
                            background: isCorrect ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)' : 'var(--surface)',
                            color: isCorrect ? 'var(--accent-green)' : 'var(--text-muted)',
                          }}>
                            {t?.name ?? teamId}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* QM controls */}
          {isQM && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius)' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '4px' }}>QUIZ MASTER</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!session.correctAnswerVisible && (
                  <Button size="sm" onClick={() => qmMutate(() => api.quiz.showAnswer(ccId!))}>
                    🟢 Show Correct Answer
                  </Button>
                )}
                {session.correctAnswerVisible && (
                  <Button size="sm" onClick={() => qmMutate(() => api.quiz.nextCorrection(ccId!))}>
                    {session.correctionIndex >= questions.length - 1 ? '🏁 Complete Quiz' : '→ Next Correction'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── COMPLETED ────────────────────────────────────────────────────── */}
      {session.status === 'COMPLETED' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--text-primary)' }}>
            <p style={{ fontSize: '36px', marginBottom: '8px' }}>🏁</p>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '20px', color: '#fff', marginBottom: '4px' }}>Quiz Complete!</p>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>Scores have been submitted to the competition leaderboard.</p>
          </Card>

          {/* Full answer matrix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {questions.map((q: any, qi: number) => (
              <Card key={q.id} padding="14px">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px', flex: 1 }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>Q{qi + 1}.</span>{q.text}
                  </p>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                </div>
                {q.imageUrl && (
                  <img src={q.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginBottom: 10, display: 'block' }} />
                )}
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
                          {isMine && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>your answer</span>}
                          {count?.count > 0 && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{count.count}</span>
                          )}
                        </div>
                        {isTeamComp && teams.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px', paddingLeft: '21px' }}>
                            {teams.map((teamId: string) => {
                              const t = competition.teams.find((x: any) => x.id === teamId)
                              return <span key={teamId} style={{ padding: '1px 6px', borderRadius: '99px', fontSize: '10px', background: 'var(--surface)', color: 'var(--text-muted)' }}>{t?.name ?? teamId}</span>
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </Layout>
  )
}
