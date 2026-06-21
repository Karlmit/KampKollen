import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
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
import { CountUp, Confetti, Stage, ScorePill } from '../components/quiz/QuizFx'

// Renders the optional rich-text question description (bold/italic/underline)
// shown beneath the question text. Re-sanitised at render as defence in depth.
function QuestionDescription({ html }: { html?: string | null }) {
  const clean = sanitizeRichText(html)
  if (!clean) return null
  return (
    <div
      className="rte-content"
      style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', lineHeight: 1.55, color: 'var(--text-muted)', marginTop: 8 }}
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

// Running quiz scores from the questions visible so far, keyed by teamId (team
// comp) or userId (individual). Counts both multiple-choice (correct option) and
// free-text (QM-awarded field points), so the scoreboard works for every quiz
// type. The question currently being corrected is included once its result is
// in: free-text the moment any points are locked in, multiple-choice once the
// QM reveals the answer — so the leaderboard ticks up live during a phase.
function runningScoreMap(questions: any[], opts: { isTeamComp: boolean; correctionIndex: number; correctAnswerVisible: boolean }): Record<string, number> {
  const { isTeamComp, correctionIndex, correctAnswerVisible } = opts
  const map: Record<string, number> = {}
  questions.forEach((q: any, idx: number) => {
    if (idx > correctionIndex) return
    const isCurrent = idx === correctionIndex
    if (q.isFreeText) {
      for (const f of q.fields ?? []) {
        for (const a of f.answers ?? []) {
          // Only locked answers count — while the QM is still adjusting points
          // (before locking) they aren't final and mustn't move the leaderboard.
          if (!a.locked) continue
          const pts = a.points ?? 0
          if (pts <= 0) continue
          const id = isTeamComp ? a.teamId : a.userId
          if (id) map[id] = (map[id] ?? 0) + pts
        }
      }
    } else {
      if (isCurrent && !correctAnswerVisible) return // don't spoil the current MC answer
      const correctOpt = (q.options ?? []).find((o: any) => o.isCorrect)
      if (!correctOpt) return
      const entry = (q.answerCounts ?? []).find((ac: any) => ac.optionId === correctOpt.id)
      if (!entry) return
      const ids = isTeamComp ? (entry.teams ?? []) : (entry.users ?? [])
      for (const id of ids) { if (id) map[id] = (map[id] ?? 0) + q.points }
    }
  })
  return map
}

// ── Mini scoreboard / top-3 podium ───────────────────────────────────────────
// Compact horizontal podium of the top three. `scoreMap` is id → points and
// `entities` the candidate rows ({ id, name, imageUrl }) — teams or players.
// When `myId` is given and the viewer sits outside the top three, their own
// row is pinned to the right of the podium so they always see where they stand.
// A button opens the full leaderboard in a modal.
function MiniScoreboard({ scoreMap, entities, myId, isTeamComp }: {
  scoreMap: Record<string, number>
  entities: { id: string; name: string; imageUrl?: string | null }[]
  myId?: string | null
  isTeamComp?: boolean
}) {
  const { t } = useTranslation()
  const [showFull, setShowFull] = useState(false)

  // Full standings with tied ranks (1, 1, 3 style)
  const allEntries = entities
    .map(e => ({ ...e, score: scoreMap[e.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
  const ranked: Array<(typeof allEntries)[number] & { rank: number }> = []
  let currentRank = 1
  for (let i = 0; i < allEntries.length; i++) {
    if (i > 0 && allEntries[i].score !== allEntries[i - 1].score) currentRank = i + 1
    ranked.push({ ...allEntries[i], rank: currentRank })
  }

  const top3 = ranked.filter(e => e.score > 0).slice(0, 3)
  if (top3.length === 0) return null

  const medal = (rank: number) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
  // The viewer's own row — only pinned when scored and outside the visible top 3.
  const mine = myId ? ranked.find(e => e.id === myId) : undefined
  const showMine = !!mine && mine.score > 0 && mine.rank > 3

  return (
    <>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
          {top3.map((e, i) => (
            <div key={e.id} className={i === 0 ? 'qz-gold-pulse' : undefined} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
              borderRadius: 'var(--radius)', background: i === 0 ? 'var(--text-primary)' : 'var(--surface)',
              minWidth: 100, flexShrink: 0, transition: 'background 300ms var(--ease-out)',
            }}>
              <span style={{ fontSize: '14px' }}>{medal(e.rank)}</span>
              <div>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px', color: i === 0 ? '#fff' : undefined }}>{e.name}</p>
                <p style={{ fontSize: '11px', color: i === 0 ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                  <CountUp value={e.score} duration={700} /> pts
                </p>
              </div>
            </div>
          ))}
          {showMine && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
              borderRadius: 'var(--radius)', background: 'color-mix(in srgb, var(--accent) 10%, var(--surface))',
              border: '1.5px solid var(--accent)', minWidth: 100, flexShrink: 0,
            }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '13px', color: 'var(--accent)' }}>#{mine!.rank}</span>
              <div>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px', color: 'var(--accent)' }}>{mine!.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  <CountUp value={mine!.score} duration={700} /> pts
                </p>
              </div>
            </div>
          )}
        </div>
        {ranked.length > 3 && (
          <button
            type="button"
            onClick={() => setShowFull(true)}
            style={{
              display: 'block', width: '100%', marginTop: '8px', padding: '6px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px',
              color: 'var(--accent)', textAlign: 'center',
            }}
          >
            {t('quiz.viewFullLeaderboard')}
          </button>
        )}
      </div>

      <Modal open={showFull} onClose={() => setShowFull(false)} title={t('quiz.fullLeaderboard')}>
        <div className="stagger">
          {ranked.map((e) => (
            <div key={e.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              background: e.id === myId ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : undefined,
            }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', minWidth: '30px', textAlign: 'center', flexShrink: 0 }}>
                {e.rank <= 3 ? medal(e.rank) : `#${e.rank}`}
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
      </Modal>
    </>
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

// "Find the red thread": shows this team's/player's own answers to the earlier
// questions the current question references, so they can spot the common theme.
function PriorAnswersCard({ priorAnswers }: { priorAnswers: any[] }) {
  const { t } = useTranslation()
  if (!priorAnswers?.length) return null
  return (
    <Card padding="14px" style={{ background: 'color-mix(in srgb, var(--accent) 5%, var(--surface))', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: 'var(--accent)', marginBottom: 10 }}>
        🧵 {t('quiz.priorAnswersTitle')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {priorAnswers.map((pa: any, i: number) => {
          const hasAnswer = pa.isFreeText ? (pa.fields ?? []).length > 0 : !!pa.optionText
          return (
            <div key={pa.questionId} style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: i === 0 ? 0 : 10, borderTop: i === 0 ? 'none' : '1px solid var(--border-light)' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>{pa.questionText}</p>
              {!hasAnswer ? (
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('quiz.priorAnswersNone')}</p>
              ) : pa.isFreeText ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {(pa.fields ?? []).map((f: any, fi: number) => (
                    <p key={fi} style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}>
                      {f.label && <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{f.label}:</span>}
                      <span style={{ fontWeight: 700 }}>{f.answer}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 700 }}>{pa.optionText}</p>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// Big "answer key" banner: the editor-set correct answer(s) for a free-text
// question, shown once at the top during correction instead of repeated under
// every team's answer. Only renders when the backend actually sent the expected
// answers (the QM throughout answering/correction; everyone once revealed).
function AnswerKeyBanner({ question }: { question: any }) {
  const { t } = useTranslation()
  if (!question?.isFreeText) return null
  const fields = (question.fields ?? []).filter((f: any) => f.correctAnswer)
  if (fields.length === 0) return null
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 'var(--radius)',
      background: 'color-mix(in srgb, var(--accent-green) 10%, var(--surface))',
      border: '1.5px solid color-mix(in srgb, var(--accent-green) 40%, transparent)',
    }}>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-green)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>🔑</span> {t('quiz.answerKey')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {fields.map((f: any) => (
          <p key={f.id} style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '22px', lineHeight: 1.25, color: 'var(--accent-green)' }}>
            {f.label && <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginRight: 8 }}>{f.label}:</span>}
            {f.correctAnswer}
          </p>
        ))}
      </div>
    </div>
  )
}

// Compact "correct answer" line(s) for the QM's consolidated question card.
// Free-text: the editor-set expected answer per field. Multiple-choice: the
// option flagged correct (only sent to the QM while presenting). Renders nothing
// when there's no answer key to show.
function CorrectAnswerSummary({ question }: { question: any }) {
  const { t } = useTranslation()
  let items: { label?: string | null; value: string }[] = []
  if (question?.isFreeText) {
    items = (question.fields ?? [])
      .filter((f: any) => f.correctAnswer)
      .map((f: any) => ({ label: f.label, value: f.correctAnswer }))
  } else {
    const correct = (question?.options ?? []).find((o: any) => o.isCorrect)
    if (correct) items = [{ value: correct.text }]
  }
  if (items.length === 0) return null
  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-light)', background: 'color-mix(in srgb, var(--accent-green) 7%, transparent)' }}>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-green)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>🔑</span> {t('quiz.answerKey')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((it, i) => (
          <p key={i} style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '16px', lineHeight: 1.3, color: 'var(--accent-green)' }}>
            {it.label && <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginRight: 8 }}>{it.label}:</span>}
            {it.value}
          </p>
        ))}
      </div>
    </div>
  )
}

// One respondent's free-text scoring card (per-field −/+, full-marks lock, lock).
// Shared by the live correction view and the "edit scores" modal so both behave
// identically. Callbacks keep it decoupled from the page's mutations.
function RespondentScorer({ respondent, onSetPoints, onToggleLock, onMaxLock, maxLockBusy }: {
  respondent: { key: string; name: string; entries: { field: any; answer: any }[] }
  onSetPoints: (answerId: string, points: number) => void
  onToggleLock: (answerId: string) => void
  onMaxLock: (answerId: string, maxPoints: number) => void
  maxLockBusy?: boolean
}) {
  const { t } = useTranslation()
  const r = respondent
  const allLocked = r.entries.every(e => e.answer.locked)
  return (
    <div style={{
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
                  onClick={() => !locked && onSetPoints(answer.id, Math.max(0, pts - 1))}
                  disabled={pts <= 0 || locked}
                  style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border-light)', background: 'var(--surface)', fontSize: '18px', cursor: (pts <= 0 || locked) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (pts <= 0 || locked) ? 0.3 : 1, fontWeight: 700 }}
                >−</button>
                <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '15px', minWidth: 54, textAlign: 'center' }}>
                  {pts} / {field.points}
                </span>
                <button
                  type="button"
                  onClick={() => !locked && onSetPoints(answer.id, Math.min(field.points, pts + 1))}
                  disabled={locked || pts >= field.points}
                  style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border-light)', background: 'var(--surface)', fontSize: '18px', cursor: (locked || pts >= field.points) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (locked || pts >= field.points) ? 0.3 : 1, fontWeight: 700 }}
                >+</button>
                <button
                  type="button"
                  title={t('quiz.freeTextMaxLock')}
                  aria-label={t('quiz.freeTextMaxLock')}
                  onClick={() => !locked && onMaxLock(answer.id, field.points)}
                  disabled={locked || maxLockBusy}
                  style={{
                    marginLeft: 'auto', padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                    cursor: locked ? 'not-allowed' : 'pointer',
                    border: `1.5px solid ${locked ? 'var(--border-light)' : 'var(--accent-green)'}`,
                    background: locked ? 'var(--surface)' : 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                    color: locked ? 'var(--text-muted)' : 'var(--accent-green)',
                    fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px',
                    opacity: locked ? 0.3 : 1,
                    transition: 'border-color 150ms, background 150ms, color 150ms',
                  }}
                >{t('quiz.freeTextMaxLockLabel')}</button>
                <button
                  type="button"
                  onClick={() => onToggleLock(answer.id)}
                  style={{
                    padding: '4px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
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
}

// QM tool: jump to ANY free-text question in the quiz and adjust its points —
// e.g. to fix an earlier score without losing your place in the live correction.
// Edits go through the same per-answer endpoints; a quiz that's already finished
// has its saved totals recomputed by the caller on close.
function ScoreEditorModal({ open, onClose, questions, competition, isTeamComp, onSetPoints, onToggleLock, onMaxLock, maxLockBusy, footer }: {
  open: boolean
  onClose: () => void
  questions: any[]
  competition: any
  isTeamComp: boolean
  onSetPoints: (answerId: string, points: number) => void
  onToggleLock: (answerId: string) => void
  onMaxLock: (answerId: string, maxPoints: number) => void
  maxLockBusy?: boolean
  footer?: ReactNode
}) {
  const { t } = useTranslation()
  const freeTextQuestions = (questions ?? []).filter((q: any) => q.isFreeText)
  // Show ONE question (with all its answers) at a time — 8 teams × many questions
  // is far too much to scroll. Default to the LAST free-text question, since that's
  // usually the one that needs a late fix.
  const [selectedId, setSelectedId] = useState<string>(() => freeTextQuestions[freeTextQuestions.length - 1]?.id ?? '')
  useEffect(() => {
    if (open && freeTextQuestions.length) setSelectedId(freeTextQuestions[freeTextQuestions.length - 1].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const selectedQ = freeTextQuestions.find((q: any) => q.id === selectedId) ?? freeTextQuestions[freeTextQuestions.length - 1]

  return (
    <Modal open={open} onClose={onClose} title={t('quiz.editScoresTitle')} footer={footer}>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
        {t('quiz.editScoresHint')}
      </p>
      {freeTextQuestions.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('quiz.noFreeTextToScore')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {freeTextQuestions.length > 1 && (
            <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--background)', paddingBottom: 10 }}>
              <label htmlFor="qz-score-jump" style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                {t('quiz.editScoresJumpTo')}
              </label>
              <select
                id="qz-score-jump"
                value={selectedQ?.id ?? ''}
                onChange={e => setSelectedId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '2px solid var(--border-light)', background: 'var(--surface)', fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                {freeTextQuestions.map((q: any) => {
                  const qi = questions.indexOf(q)
                  const text = q.text ?? ''
                  const short = text.length > 48 ? text.slice(0, 48) + '…' : text
                  return <option key={q.id} value={q.id}>Q{qi + 1}. {short}</option>
                })}
              </select>
            </div>
          )}
          {selectedQ && (() => {
            const respondents = groupFieldAnswers(selectedQ, competition, isTeamComp)
            const qi = questions.indexOf(selectedQ)
            return (
              <div key={selectedQ.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px', lineHeight: 1.35 }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>Q{qi + 1}.</span>{selectedQ.text}
                </p>
                <AnswerKeyBanner question={selectedQ} />
                {respondents.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('quiz.freeTextNoAnswers')}</p>
                ) : respondents.map(r => (
                  <RespondentScorer key={r.key} respondent={r} onSetPoints={onSetPoints} onToggleLock={onToggleLock} onMaxLock={onMaxLock} maxLockBusy={maxLockBusy} />
                ))}
              </div>
            )
          })()}
        </div>
      )}
    </Modal>
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
  const [freeTextInputs, setFreeTextInputs] = useState<Record<string, string>>({})
  const [confirmStart, setConfirmStart] = useState(false)
  const [confirmAdvance, setConfirmAdvance] = useState(false)
  const [countdownSecs, setCountdownSecs] = useState<number | null>(null)
  const [visualSecs, setVisualSecs] = useState<number | null>(null)
  const [nudgeSeconds, setNudgeSeconds] = useState(15)
  const [showFullResults, setShowFullResults] = useState(false)
  const [showScoreEditor, setShowScoreEditor] = useState(false)

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
  const visualCountdownEndsAt: number | null = data?.session?.visualCountdownEndsAt ?? null
  const visualCountdownSeconds: number | null = data?.session?.visualCountdownSeconds ?? null
  useEffect(() => { setSelectedOption(null); setSubmitted(false); setFreeTextInputs({}) }, [currentIdx, sessionStatus])

  // When the QM starts the next-question/correction countdown, auto-submit
  // whatever free text the player currently has typed but hasn't submitted
  // (e.g. after taking back an answer). Re-assigned each render below so it
  // always sees the latest question and inputs.
  const autoSubmitFreeTextRef = useRef<() => void>(() => {})
  const prevCountdownRef = useRef<number | null>(null)
  useEffect(() => {
    if (countdownEndsAt != null && prevCountdownRef.current == null) {
      autoSubmitFreeTextRef.current()
    }
    prevCountdownRef.current = countdownEndsAt
  }, [countdownEndsAt])

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

  // Live tick for the QM's purely-visual nudge countdown. Floors to 0 so the
  // ring can show "0" for the brief moment before the server clears it. Never
  // touches answers — it only drives the on-screen ring.
  useEffect(() => {
    if (!visualCountdownEndsAt) { setVisualSecs(null); return }
    const tick = () => {
      const s = Math.ceil((visualCountdownEndsAt - Date.now()) / 1000)
      setVisualSecs(Math.max(0, s))
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [visualCountdownEndsAt])

  const submitAnswer = useMutation({
    mutationFn: ({ optionId, fields, teamId }: { optionId?: string; fields?: { fieldId: string; answer: string }[]; teamId?: string }) =>
      api.quiz.submitAnswer(ccId!, { questionId: currentQ?.id, optionId, fields, teamId }),
    onSuccess: () => { setSubmitted(true); qc.invalidateQueries({ queryKey: ['quiz', ccId] }) },
  })

  const retractAnswer = useMutation({
    mutationFn: ({ teamId }: { teamId?: string }) =>
      api.quiz.retractAnswer(ccId!, { questionId: currentQ?.id, teamId }),
    // Keep freeTextInputs intact so taken-back free-text answers stay in the
    // fields (handleRetract pre-seeds them from the saved answer). The
    // question-advance effect clears them when the question actually changes.
    onSuccess: () => { setSubmitted(false); setSelectedOption(null); qc.invalidateQueries({ queryKey: ['quiz', ccId] }) },
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

  // One-press scoring: award the field's max points and lock the answer.
  const maxAndLockField = useMutation({
    mutationFn: async ({ answerId, maxPoints }: { answerId: string; maxPoints: number }) => {
      await api.quiz.setFieldPoints(ccId!, answerId, maxPoints)
      await api.quiz.toggleFieldLock(ccId!, answerId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', ccId] }),
  })

  const lockAllFields = useMutation({
    mutationFn: () => api.quiz.lockAllFields(ccId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', ccId] }),
  })

  // Recompute & persist the saved scores from the current points — used after the
  // QM edits points on an already-completed quiz so the leaderboard catches up.
  const recomputeScores = useMutation({
    mutationFn: () => api.quiz.recomputeScores(ccId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', ccId] }),
  })

  // Close the "edit scores" modal; on a finished quiz, push the corrected totals.
  const closeScoreEditor = useCallback(() => {
    setShowScoreEditor(false)
    if (sessionStatus === 'COMPLETED') recomputeScores.mutate()
  }, [sessionStatus, recomputeScores])

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

  const { session, isQM, isTeamComp, phaseCorrection, standings, myTeamId, myIsTeamLeader, myIsScorekeeper, competition, questions, challengeId, challengeLogoUrl } = data

  // Candidate rows for the top-3 podium — teams in a team competition, otherwise
  // the (non-dummy) players. Names/avatars come straight from the competition.
  const podiumEntities: { id: string; name: string; imageUrl?: string | null }[] = isTeamComp
    ? competition.teams.map((tm: any) => ({ id: tm.id, name: tm.name, imageUrl: tm.imageUrl }))
    : competition.players
        .filter((p: any) => !p.user?.isDummy)
        .map((p: any) => ({ id: p.userId, name: p.user?.displayName ?? p.user?.username ?? '', imageUrl: p.user?.profileImageUrl }))

  // The viewer's own id within the standings — their team in a team competition,
  // otherwise their user id. Lets the running podium surface "your" position even
  // when you're outside the top three.
  const myStandingId: string | null = isTeamComp ? (myTeamId ?? null) : (user?.id ?? null)

  // Phase segments (contiguous runs of equal `phase`) — only meaningful when the
  // quiz runs in phase-correction mode. Used for phase-aware QM button labels and
  // the "Phase X / Y" indicators.
  const phaseSegments: { start: number; end: number }[] = []
  {
    let start = 0
    for (let i = 1; i <= questions.length; i++) {
      if (i === questions.length || questions[i].phase !== questions[i - 1].phase) {
        phaseSegments.push({ start, end: i - 1 })
        start = i
      }
    }
  }
  const segOf = (idx: number) => phaseSegments.find(s => idx >= s.start && idx <= s.end) ?? { start: idx, end: idx }
  const phaseNumOf = (idx: number) => phaseSegments.findIndex(s => idx >= s.start && idx <= s.end) + 1
  const isGuest = !user
  // In team mode: leaders, scorekeepers, and non-QM admins can act; individual mode: everyone (guests never act)
  const canAct = !isGuest && (!isTeamComp || myIsTeamLeader || myIsScorekeeper || (isAdmin && !isQM))
  const myTeam = competition.teams.find((t: any) => t.id === myTeamId)
  const currentQ = questions[session.currentQuestionIndex]
  const correctionQ = questions[session.correctionIndex]

  // How many teams/players have answered the current question — drives the QM's
  // "are you sure?" guard before advancing while answers are still outstanding.
  const answeredCount = isTeamComp
    ? competition.teams.filter((t: any) => currentQ?.answeredTeams?.includes(t.id)).length
    : (currentQ?.answeredUserIds?.length ?? 0)
  const totalToAnswer = isTeamComp ? competition.teams.length : competition.players.length
  const everyoneAnswered = totalToAnswer > 0 && answeredCount >= totalToAnswer
  const advanceQuestion = () => qmMutate(() => api.quiz.nextQuestion(ccId!))
  const startVisualCountdown = () => qmMutate(() => api.quiz.startVisualCountdown(ccId!, nudgeSeconds))
  const stopVisualCountdown = () => qmMutate(() => api.quiz.stopVisualCountdown(ccId!))
  const visualCountdownActive = visualSecs !== null

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

  function handleRetract() {
    if (!canAct || session.status !== 'ACTIVE' || currentQ?.locked) return
    // Preserve the submitted free-text in the editable fields so taking back
    // doesn't wipe what was entered. Seed from the saved answer in case the
    // player never typed locally (e.g. after a reload).
    if (currentQ?.isFreeText) {
      const restored: Record<string, string> = {}
      for (const f of currentQ.fields ?? []) {
        if (f.myAnswer != null) restored[f.id] = f.myAnswer
      }
      setFreeTextInputs(prev => ({ ...restored, ...prev }))
    }
    const teamId = isTeamComp ? myTeamId ?? undefined : undefined
    retractAnswer.mutate({ teamId })
  }

  // Keep the auto-submit callback fresh: when the QM starts the countdown, any
  // free text typed but not yet submitted is entered as the answer.
  autoSubmitFreeTextRef.current = () => {
    if (!canAct || !currentQ?.isFreeText || currentQ.locked || session.status !== 'ACTIVE') return
    if (myFreeTextSubmitted) return // already submitted — nothing to enter
    const fields = (currentQ.fields ?? []).map((f: any) => ({ fieldId: f.id, answer: (freeTextInputs[f.id] ?? '').trim() }))
    if (fields.length === 0 || fields.every((f: any) => !f.answer)) return
    const teamId = isTeamComp ? myTeamId ?? undefined : undefined
    submitAnswer.mutate({ fields, teamId })
  }

  // Answers can be taken back until the question is locked or the QM has started
  // the next-question countdown. (canAct/answer-exists checks happen at each button.)
  const canRetract = canAct && session.status === 'ACTIVE' && !currentQ?.locked && countdownSecs === null

  // The question card's body, shared by the answering and correction decks so the
  // single <Stage> can morph one into the other across the ACTIVE→CORRECTING flip.
  const questionFace = (q: any) => (
    <>
      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px', lineHeight: 1.4 }}>{q.text}</p>
      <QuestionDescription html={q.description} />
      {q.imageUrl && (
        <img src={q.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginTop: 10, display: 'block' }} />
      )}
    </>
  )

  // Participant ANSWERING body — prior answers + the answer controls. In a closure
  // so the persistent deck can render it without the JSX living inside a status block.
  const renderActiveAnswers = () => (
    <>
      {!isGuest && (currentQ.priorAnswers?.length ?? 0) > 0 && (
        <PriorAnswersCard priorAnswers={currentQ.priorAnswers} />
      )}
      {isGuest ? (
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
            {canRetract && (
              <Button variant="ghost" size="sm" style={{ marginTop: 12 }} loading={retractAnswer.isPending} onClick={handleRetract}>
                {t('quiz.takeBackAnswer')}
              </Button>
            )}
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
                <textarea
                  value={freeTextInputs[f.id] ?? ''}
                  onChange={e => setFreeTextInputs(prev => ({ ...prev, [f.id]: e.target.value }))}
                  rows={3}
                  placeholder={t('quiz.freeTextPlaceholder')}
                  style={{ width: '100%', minHeight: 84, padding: '10px 12px', borderRadius: 'var(--radius)', border: '2px solid var(--border-light)', fontSize: '15px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box', outline: 'none', resize: 'vertical', lineHeight: 1.4 }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {currentQ.options.map((opt: any) => {
            const picked = (selectedOption ?? mySubmittedOption) === opt.id
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
          {canRetract && mySubmittedOption && (
            <Button variant="ghost" size="sm" style={{ marginTop: 4 }} loading={retractAnswer.isPending} onClick={handleRetract}>
              {t('quiz.takeBackAnswer')}
            </Button>
          )}
        </div>
      )}
    </>
  )

  // Participant CORRECTION body — answer key + the reveal (own free-text answer or
  // the multiple-choice distribution). Shares the deck with the answering view.
  const renderCorrectingAnswers = () => (
    <>
      <AnswerKeyBanner question={correctionQ} />
      {correctionQ.isFreeText ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(correctionQ.fields ?? []).some((f: any) => f.myAnswer != null) && (
            <Card padding="12px">
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: 6 }}>{t('quiz.yourAnswer')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(correctionQ.fields ?? []).map((f: any) => (
                  <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '15px' }}>
                        {f.label && <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '12px', marginRight: 6 }}>{f.label}:</span>}
                        <span style={{ fontWeight: 700 }}>{f.myAnswer}</span>
                      </p>
                      {f.myLocked && f.myPoints !== null && (() => {
                        const gotPoints = (f.myPoints ?? 0) > 0
                        const tone = gotPoints ? 'var(--accent-green)' : 'var(--accent-warm)'
                        return (
                          <span
                            key={`score-${session.correctionIndex}-${f.id}`}
                            className="qz-score-reveal"
                            style={{
                              flexShrink: 0, padding: '4px 11px', borderRadius: '99px',
                              fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 800,
                              color: '#fff', background: tone, whiteSpace: 'nowrap',
                              ['--score-glow' as any]: tone,
                            }}
                          >
                            {t('quiz.freeTextPointsAwarded', { points: f.myPoints, max: f.points })}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
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
                className={isCorrect ? 'qz-correct-burst' : isWrong ? 'qz-wrong-shake' : undefined}
                style={{
                  padding: '12px 14px', borderRadius: 'var(--radius)', position: 'relative', overflow: 'hidden',
                  border: `2px solid ${isCorrect ? 'var(--accent-green)' : isWrong ? 'var(--accent-warm)' : isMine ? 'var(--accent)' : 'var(--border-light)'}`,
                  background: isCorrect ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)' : isWrong ? 'color-mix(in srgb, var(--accent-warm) 8%, transparent)' : 'var(--background)',
                  boxShadow: isCorrect ? '0 0 0 3px color-mix(in srgb, var(--accent-green) 25%, transparent)' : isWrong ? '0 0 0 3px color-mix(in srgb, var(--accent-warm) 25%, transparent)' : 'none',
                  transition: 'border-color 300ms var(--ease-out), box-shadow 300ms var(--ease-out)',
                }}
              >
                {session.correctAnswerVisible && (
                  <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, background: isCorrect ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)' : isWrong ? 'color-mix(in srgb, var(--accent-warm) 12%, transparent)' : 'color-mix(in srgb, var(--text-muted) 8%, transparent)', transition: 'width 650ms var(--ease-out)' }} />
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
                      <CountUp value={pct} suffix="%" duration={650} style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: isCorrect ? 'var(--accent-green)' : isWrong ? 'var(--accent-warm)' : 'var(--text-muted)', flexShrink: 0 }} />
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
                          background: isCorrect ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)' : isWrong ? 'color-mix(in srgb, var(--accent-warm) 20%, transparent)' : 'var(--surface)',
                          color: isCorrect ? 'var(--accent-green)' : isWrong ? 'var(--accent-warm)' : 'var(--text-muted)',
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
    </>
  )

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

      {/* Advance-while-not-everyone-answered confirmation */}
      <Modal
        open={confirmAdvance}
        onClose={() => setConfirmAdvance(false)}
        title={t('quiz.advanceEarlyTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmAdvance(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => { setConfirmAdvance(false); advanceQuestion() }}>
              {t('quiz.advanceEarlyConfirm')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {t('quiz.advanceEarlyDesc', { answered: answeredCount, total: totalToAnswer })}
        </p>
      </Modal>

      {/* QM "edit scores" — revisit any free-text question and adjust its points */}
      {isQM && (
        <ScoreEditorModal
          open={showScoreEditor}
          onClose={closeScoreEditor}
          questions={questions}
          competition={competition}
          isTeamComp={isTeamComp}
          onSetPoints={(answerId, points) => setFieldPoints.mutate({ answerId, points })}
          onToggleLock={(answerId) => toggleFieldLock.mutate(answerId)}
          onMaxLock={(answerId, maxPoints) => maxAndLockField.mutate({ answerId, maxPoints })}
          maxLockBusy={maxAndLockField.isPending}
          footer={<Button onClick={closeScoreEditor}>{t('quiz.editScoresDone')}</Button>}
        />
      )}

      {/* ── PARTICIPANT (answering + correction) ─────────────────────────────
          Players, team leaders, scorekeepers and guests share ONE persistent
          deck across the ACTIVE→CORRECTING flip, so the question card fluidly
          morphs into the countdown, into "Time's up!", and into the correction —
          no static cut. The quiz master keeps the dedicated blocks below. */}
      {!isQM && (session.status === 'ACTIVE' || session.status === 'CORRECTING') && (() => {
        const isCorrecting = session.status === 'CORRECTING'
        const q = isCorrecting ? correctionQ : currentQ
        if (!q) return null

        // Win/lose reveal (correction only) — drives the confetti / red flash.
        const myOpt = isCorrecting ? correctionQ.options?.find((o: any) => o.id === correctionQ.myOptionId) : null
        const iAnswered = isCorrecting && !correctionQ.isFreeText && !!correctionQ.myOptionId
        const iGotItRight = iAnswered && !!myOpt?.isCorrect
        const iGotItWrong = iAnswered && !!myOpt && !myOpt.isCorrect
        const revealed = isCorrecting && session.correctAnswerVisible && !correctionQ.isFreeText
        const myFields = isCorrecting ? (correctionQ.fields ?? []).filter((f: any) => f.myAnswer != null) : []
        const freeTextResolved = isCorrecting && correctionQ.isFreeText && myFields.length > 0 && myFields.every((f: any) => f.myLocked)
        const myFreeTextTotal = myFields.reduce((sum: number, f: any) => sum + (f.myPoints ?? 0), 0)
        const freeTextMax = isCorrecting ? (correctionQ.fields ?? []).reduce((sum: number, f: any) => sum + (f.points ?? 0), 0) : 0
        const freeTextGotMax = freeTextResolved && freeTextMax > 0 && myFreeTextTotal >= freeTextMax
        const freeTextGotZero = freeTextResolved && myFreeTextTotal === 0
        const showHappy = (revealed && (iGotItRight || (isGuest && !iGotItWrong))) || freeTextGotMax
        const showSad = (revealed && iGotItWrong) || freeTextGotZero

        const idx = isCorrecting ? session.correctionIndex : session.currentQuestionIndex
        const scoreMap = isCorrecting
          ? runningScoreMap(questions, { isTeamComp, correctionIndex: session.correctionIndex, correctAnswerVisible: session.correctAnswerVisible })
          : (standings ?? {})

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
            {showHappy && <Confetti key={`win-${idx}`} count={46} emojis={['🎉', '⭐', '🪙']} />}
            {showSad && (
              <>
                <div className="qz-red-flash" key={`flash-${idx}`} aria-hidden />
                <Confetti key={`lose-${idx}`} count={30} durationBase={2000} emojiChance={1} colors={['#d7283d', '#9aa3ab', '#6b7480']} emojis={['❌']} />
              </>
            )}

            {(isCorrecting || phaseCorrection) && (
              <MiniScoreboard scoreMap={scoreMap} entities={podiumEntities} myId={myStandingId} isTeamComp={isTeamComp} />
            )}

            {/* Progress */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                {phaseCorrection && phaseSegments.length > 1 && (
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', padding: '3px 8px', borderRadius: '99px', flexShrink: 0 }}>
                    {t('quiz.phaseProgress', { current: phaseNumOf(idx), total: phaseSegments.length })}
                  </span>
                )}
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                  {isCorrecting
                    ? t('quiz.correcting', { current: session.correctionIndex + 1, total: questions.length })
                    : t('quiz.question', { current: session.currentQuestionIndex + 1, total: questions.length })}
                </p>
              </div>
              <ScorePill points={t('quiz.points', { count: q.points })} seconds={isCorrecting ? null : visualSecs} />
            </div>

            <Stage
              key="participant-deck"
              sceneKey={isCorrecting ? `correcting-${session.correctionIndex}` : `active-${session.currentQuestionIndex}`}
              counting={!isCorrecting && countdownSecs !== null}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
              timesUp={
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '10px 0' }}>
                  <span style={{ fontSize: '34px', lineHeight: 1 }}>⏳</span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '22px', color: 'var(--accent-warm)', letterSpacing: '0.01em' }}>
                    {t('quiz.timesUp')}
                  </span>
                </div>
              }
              countdown={!isCorrecting && countdownSecs !== null ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-warm)' }}>
                    {session.currentQuestionIndex >= questions.length - 1 ? t('quiz.quizCompletesIn') : t('quiz.nextQuestionIn')}
                  </span>
                  <div style={{ position: 'relative', width: 92, height: 92 }}>
                    <svg width={92} height={92} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
                      <circle cx={46} cy={46} r={40} fill="none" strokeWidth={7} stroke="color-mix(in srgb, var(--accent-warm) 16%, transparent)" />
                      <circle cx={46} cy={46} r={40} fill="none" strokeWidth={7} stroke="var(--accent-warm)" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 * (1 - Math.max(0, Math.min(1, (countdownSecs ?? 0) / 3)))}
                        style={{ transition: 'stroke-dashoffset 220ms linear' }} />
                    </svg>
                    <span key={countdownSecs} className="qz-count-num" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '38px', color: 'var(--accent-warm)', lineHeight: 1 }}>
                      {countdownSecs}
                    </span>
                  </div>
                </div>
              ) : null}
              title={questionFace(q)}
            >
              {isCorrecting ? renderCorrectingAnswers() : renderActiveAnswers()}
            </Stage>
          </div>
        )
      })()}

      {/* ── ACTIVE (quiz master) ─────────────────────────────────────────── */}
      {session.status === 'ACTIVE' && currentQ && isQM && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Running top-3 podium — phase mode only, once the first phase has been
              corrected and real points exist (renders nothing while all are 0) */}
          {phaseCorrection && (
            <MiniScoreboard scoreMap={standings ?? {}} entities={podiumEntities} myId={myStandingId} isTeamComp={isTeamComp} />
          )}

          {/* Progress */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {phaseCorrection && phaseSegments.length > 1 && (
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', padding: '3px 8px', borderRadius: '99px', flexShrink: 0 }}>
                  {t('quiz.phaseProgress', { current: phaseNumOf(session.currentQuestionIndex), total: phaseSegments.length })}
                </span>
              )}
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                {t('quiz.question', { current: session.currentQuestionIndex + 1, total: questions.length })}
              </p>
            </div>
            <ScorePill points={t('quiz.points', { count: currentQ.points })} seconds={visualSecs} />
          </div>

          {/* Consolidated QM question card — everything the quiz master needs in
              one place, top to bottom: question, description, correct answer,
              manus, then the QM tools. The incoming answers render below it. */}
          {isQM && (
            <Card
              key={session.currentQuestionIndex}
              className="qz-question-in"
              padding="0"
              style={{ overflow: 'hidden' }}
            >
              {/* Question, its description and image */}
              <div style={{ padding: '14px 16px' }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '17px', lineHeight: 1.4 }}>{currentQ.text}</p>
                <QuestionDescription html={currentQ.description} />
                {currentQ.imageUrl && (
                  <img src={currentQ.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginTop: 10, display: 'block' }} />
                )}
              </div>

              {/* Correct answer (answer key) — renders nothing when unavailable */}
              <CorrectAnswerSummary question={currentQ} />

              {/* QM-only "manus" — the script the quiz master reads aloud */}
              {currentQ.manusText && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-light)', background: 'color-mix(in srgb, var(--accent-warm) 6%, transparent)' }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--accent-warm)', marginBottom: 4, textTransform: 'uppercase' }}>
                    {t('quiz.manus')}
                  </p>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{currentQ.manusText}</p>
                </div>
              )}

              {/* Quiz master tools — advance, who's answered, nudge countdown */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('quiz.quizMaster')}</p>
                {/* Revisit any earlier free-text question and adjust its points */}
                <Button size="sm" variant="ghost" onClick={() => setShowScoreEditor(true)}>{t('quiz.editScores')}</Button>
              </div>

              {/* Answer status per team/player */}
              <div className="qz-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {isTeamComp && competition.teams.map((tm: any) => {
                  const answered = currentQ.answeredTeams?.includes(tm.id)
                  return (
                    <span key={tm.id} style={{
                      padding: '3px 8px', borderRadius: '99px', fontSize: '12px', fontFamily: 'var(--font-ui)', fontWeight: 600,
                      background: answered ? 'color-mix(in srgb, var(--accent-green) 15%, transparent)' : 'var(--background)',
                      color: answered ? 'var(--accent-green)' : 'var(--text-muted)',
                      border: `1px solid ${answered ? 'var(--accent-green)' : 'var(--border-light)'}`,
                    }}>
                      {answered ? '✓ ' : ''}{tm.name}
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
                  onClick={() => everyoneAnswered ? advanceQuestion() : setConfirmAdvance(true)}
                >
                  {countdownSecs !== null
                    ? t('quiz.countdown5s', { count: countdownSecs })
                    : (() => {
                        const atIdx = session.currentQuestionIndex
                        const lastOverall = atIdx >= questions.length - 1
                        if (phaseCorrection && atIdx >= segOf(atIdx).end && !lastOverall) return t('quiz.startPhaseCorrection')
                        return lastOverall ? t('quiz.startCorrection') : t('quiz.nextQuestion')
                      })()}
                </Button>
              </div>

              {/* Visual nudge countdown — purely cosmetic timer the QM starts to
                  hint that they're waiting. Never locks answers or advances. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {visualCountdownActive ? (
                  <>
                    {/* Live count badge — the QM's single countdown readout. Fixed
                        width + tabular figures so it never changes size as the
                        number ticks (which would reflow this in-flow row). The
                        floating ring is hidden for the QM so it isn't shown twice. */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: '72px', padding: '5px 12px', borderRadius: '99px',
                      background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))',
                      color: 'var(--accent)', fontFamily: 'var(--font-ui)', fontWeight: 800,
                      fontSize: '14px', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                    }}>
                      ⏳ {visualSecs}s
                    </span>
                    <Button size="sm" variant="ghost" onClick={stopVisualCountdown}>
                      {t('quiz.stopNudge')}
                    </Button>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-light)', borderRadius: '99px', overflow: 'hidden', background: 'var(--background)' }}>
                      <button
                        type="button"
                        aria-label={t('quiz.nudgeLess')}
                        onClick={() => setNudgeSeconds(s => Math.max(3, s - 5))}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 10px', fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '15px', color: 'var(--text-muted)' }}
                      >−</button>
                      <span style={{ minWidth: '42px', textAlign: 'center', fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '13px' }}>
                        {nudgeSeconds}s
                      </span>
                      <button
                        type="button"
                        aria-label={t('quiz.nudgeMore')}
                        onClick={() => setNudgeSeconds(s => Math.min(600, s + 5))}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 10px', fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '15px', color: 'var(--text-muted)' }}
                      >+</button>
                    </div>
                    <Button size="sm" variant="ghost" onClick={startVisualCountdown}>
                      {t('quiz.startNudge')}
                    </Button>
                  </>
                )}
              </div>
              </div>
            </Card>
          )}

          {/* Per-question timer */}
          {currentQ.timerSeconds > 0 && !currentQ.locked && !countdownSecs && (
            <TimerBar key={session.currentQuestionIndex} seconds={currentQ.timerSeconds} onExpire={() => {}} />
          )}

          {/* Next-question countdown — QM only here; for participants/guests the
              countdown lives inside the deck (the question card morphs into it). */}
          {isQM && countdownSecs !== null && (() => {
            const ringSize = 96
            const ringR = 42
            const circ = 2 * Math.PI * ringR
            const progress = Math.max(0, Math.min(1, countdownSecs / 3))
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

          {/* The QM's visual "hurry up" countdown is shown by morphing the score
              pill (green → red, points → seconds) — see ScorePill in the progress
              rows; no separate floating ring. */}

          {/* Options — QM sees the live answer distribution (participants get the
              persistent morphing deck, rendered in the participant block above). */}
          {isQM && (
            currentQ.isFreeText ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Answer key shown in the consolidated card above — not repeated here */}
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)' }}>
                  {t('quiz.freeTextAnswers')} ({isTeamComp ? currentQ.answeredTeams?.length ?? 0 : currentQ.answeredUserIds?.length ?? 0})
                </p>
                {/* Pre-scoring hint: the QM can score answers as they arrive; the
                    points are saved and stay hidden from teams until correction. */}
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
                  {t('quiz.preScoreHint')}
                </p>
                {(() => {
                  const respondents = groupFieldAnswers(currentQ, competition, isTeamComp)
                  if (respondents.length === 0) return <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('quiz.freeTextNoAnswers')}</p>
                  return respondents.map(r => (
                    <div key={r.key} style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px', color: 'var(--text-muted)' }}>{r.name}</p>
                        {respondentPoints(r.entries) > 0 && (
                          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '12px', color: 'var(--accent)' }}>
                            {t('quiz.points', { count: respondentPoints(r.entries) })}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {r.entries.map(({ field, answer }) => {
                          const pts = answer.points ?? 0
                          return (
                            <div key={answer.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}>
                                {field.label && <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, marginRight: 6 }}>{field.label}:</span>}
                                {answer.answer || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => setFieldPoints.mutate({ answerId: answer.id, points: Math.max(0, pts - 1) })}
                                  disabled={pts <= 0}
                                  style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border-light)', background: 'var(--surface)', fontSize: '18px', cursor: pts <= 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: pts <= 0 ? 0.3 : 1, fontWeight: 700 }}
                                >−</button>
                                <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: '15px', minWidth: 54, textAlign: 'center' }}>
                                  {pts} / {field.points}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setFieldPoints.mutate({ answerId: answer.id, points: Math.min(field.points, pts + 1) })}
                                  disabled={pts >= field.points}
                                  style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border-light)', background: 'var(--surface)', fontSize: '18px', cursor: pts >= field.points ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: pts >= field.points ? 0.3 : 1, fontWeight: 700 }}
                                >+</button>
                                <button
                                  type="button"
                                  onClick={() => setFieldPoints.mutate({ answerId: answer.id, points: field.points })}
                                  disabled={pts >= field.points}
                                  style={{
                                    marginLeft: 'auto', padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                                    cursor: pts >= field.points ? 'not-allowed' : 'pointer',
                                    border: `1.5px solid ${pts >= field.points ? 'var(--border-light)' : 'var(--accent-green)'}`,
                                    background: pts >= field.points ? 'var(--surface)' : 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                                    color: pts >= field.points ? 'var(--text-muted)' : 'var(--accent-green)',
                                    fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '12px',
                                    opacity: pts >= field.points ? 0.3 : 1,
                                    transition: 'border-color 150ms, background 150ms, color 150ms',
                                  }}
                                >{t('quiz.freeTextMaxLabel')}</button>
                              </div>
                            </div>
                          )
                        })}
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
          )}

        </div>
      )}

      {/* ── CORRECTING (quiz master) ─────────────────────────────────────── */}
      {session.status === 'CORRECTING' && correctionQ && isQM && (() => {
        // Did *I* / my team get this one right? Drives a happy vs. sad reveal.
        const myOpt = correctionQ.options?.find((o: any) => o.id === correctionQ.myOptionId)
        const iAnswered = !correctionQ.isFreeText && !!correctionQ.myOptionId
        const iGotItRight = iAnswered && !!myOpt?.isCorrect
        const iGotItWrong = iAnswered && !!myOpt && !myOpt.isCorrect
        const isObserver = isQM || isGuest
        const revealed = session.correctAnswerVisible && !correctionQ.isFreeText

        // Free-text: the QM locking the answer is the reveal moment for the team.
        // Full marks across every field → happy confetti; a flat zero → sad rain.
        const myFields = (correctionQ.fields ?? []).filter((f: any) => f.myAnswer != null)
        // A locked field is fully resolved — unscored counts as 0 (myFreeTextTotal
        // coerces null → 0), so a locked-at-zero answer still triggers the reveal.
        const freeTextResolved = correctionQ.isFreeText && !isObserver && myFields.length > 0
          && myFields.every((f: any) => f.myLocked)
        const myFreeTextTotal = myFields.reduce((sum: number, f: any) => sum + (f.myPoints ?? 0), 0)
        const freeTextMax = (correctionQ.fields ?? []).reduce((sum: number, f: any) => sum + (f.points ?? 0), 0)
        const freeTextGotMax = freeTextResolved && freeTextMax > 0 && myFreeTextTotal >= freeTextMax
        const freeTextGotZero = freeTextResolved && myFreeTextTotal === 0

        const showHappy = (revealed && (iGotItRight || (isObserver && !iGotItWrong))) || freeTextGotMax
        const showSad = (revealed && iGotItWrong) || freeTextGotZero

        // Label for the QM "advance" button. In phase mode the phase's last
        // question hands back to answering the next phase (or finishes the quiz),
        // so the wording changes from "next correction" accordingly.
        const corrIdx = session.correctionIndex
        const lastOverall = corrIdx >= questions.length - 1
        const correctionAdvanceLabel = phaseCorrection
          ? (corrIdx >= segOf(corrIdx).end ? (lastOverall ? t('quiz.completeQuiz') : t('quiz.nextPhase')) : t('quiz.nextCorrection'))
          : (lastOverall ? t('quiz.completeQuiz') : t('quiz.nextCorrection'))
        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
          {/* Win → confetti + coins. Loss → red flash + ❌ rain. */}
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
                emojiChance={1}
                colors={['#d7283d', '#9aa3ab', '#6b7480']}
                emojis={['❌']}
              />
            </>
          )}
          {/* Scoreboard strip — running totals, current question counted once its
              result is in (MC: answer revealed; free-text: points locked) */}
          <MiniScoreboard
            scoreMap={runningScoreMap(questions, { isTeamComp, correctionIndex: session.correctionIndex, correctAnswerVisible: session.correctAnswerVisible })}
            entities={podiumEntities}
            myId={myStandingId}
            isTeamComp={isTeamComp}
          />

          {/* QM controls — pinned to the top so the quiz master always has the
              correction actions (and the "edit scores" jump) in reach without
              scrolling past every team's answer. */}
          {isQM && (
            <div style={{
              position: 'sticky', top: 56, zIndex: 30,
              display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px',
              background: 'var(--surface)', borderRadius: 'var(--radius)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{t('quiz.quizMaster')}</p>
                <Button size="sm" variant="ghost" onClick={() => setShowScoreEditor(true)}>{t('quiz.editScores')}</Button>
              </div>
              {correctionQ.isFreeText ? (() => {
                const allAnswers = (correctionQ.fields ?? []).flatMap((f: any) => f.answers ?? [])
                const hasUnlocked = allAnswers.some((a: any) => !a.locked)
                const allLocked = allFieldAnswersLocked(correctionQ)
                // Any expected answers configured for this question? If so the QM
                // may reveal them to everyone (otherwise there's nothing to show).
                const hasExpectedAnswers = (correctionQ.fields ?? []).some((f: any) => f.correctAnswer)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {hasUnlocked && (
                      <Button size="sm" variant="success" disabled={lockAllFields.isPending} onClick={() => lockAllFields.mutate()}>
                        {t('quiz.freeTextLockAll')}
                      </Button>
                    )}
                    {hasExpectedAnswers && !session.correctAnswerVisible && (
                      <Button size="sm" variant="ghost" onClick={() => qmMutate(() => api.quiz.showAnswer(ccId!))}>
                        {t('quiz.showAnswerToAll')}
                      </Button>
                    )}
                    {hasExpectedAnswers && session.correctAnswerVisible && (
                      <p style={{ fontSize: '11px', color: 'var(--accent-green)', fontFamily: 'var(--font-ui)', fontWeight: 700 }}>{t('quiz.answerShownToAll')}</p>
                    )}
                    <Button size="sm" disabled={!allLocked} onClick={() => qmMutate(() => api.quiz.nextCorrection(ccId!))}>
                      {correctionAdvanceLabel}
                    </Button>
                    {!allLocked && (
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{t('quiz.freeTextLockAllFirst')}</p>
                    )}
                  </div>
                )
              })() : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!session.correctAnswerVisible && (
                    <Button size="sm" onClick={() => qmMutate(() => api.quiz.showAnswer(ccId!))}>
                      {t('quiz.showAnswer')}
                    </Button>
                  )}
                  {session.correctAnswerVisible && (
                    <Button size="sm" onClick={() => qmMutate(() => api.quiz.nextCorrection(ccId!))}>
                      {correctionAdvanceLabel}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {phaseCorrection && phaseSegments.length > 1 && (
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', padding: '3px 8px', borderRadius: '99px', flexShrink: 0 }}>
                  {t('quiz.phaseProgress', { current: phaseNumOf(session.correctionIndex), total: phaseSegments.length })}
                </span>
              )}
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                {t('quiz.correcting', { current: session.correctionIndex + 1, total: questions.length })}
              </p>
            </div>
            <ScorePill points={t('quiz.points', { count: correctionQ.points })} seconds={null} />
          </div>

          <Stage
            sceneKey={`c-${session.correctionIndex}`}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            title={
              /* Question — the deck's face (the deck card wrapper is the Stage's). */
              <>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px', lineHeight: 1.4 }}>{correctionQ.text}</p>
                <QuestionDescription html={correctionQ.description} />
                {correctionQ.imageUrl && <img src={correctionQ.imageUrl} alt="" style={{ width: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)', marginTop: 8, display: 'block' }} />}
              </>
            }
          >

          {/* The expected answer, once, in big green letters — shown to the QM
              throughout correction and to everyone once revealed. */}
          <AnswerKeyBanner question={correctionQ} />

          {/* QM-only "manus" for the correction phase — the script the quiz
              master reads aloud while correcting/scoring this question */}
          {isQM && correctionQ.correctionManusText && (
            <div style={{
              padding: '12px 14px', borderRadius: 'var(--radius)',
              background: 'color-mix(in srgb, var(--accent-warm) 7%, var(--surface))',
              border: '1.5px dashed color-mix(in srgb, var(--accent-warm) 35%, transparent)',
            }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--accent-warm)', marginBottom: 6, textTransform: 'uppercase' }}>
                {t('quiz.correctionManus')}
              </p>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{correctionQ.correctionManusText}</p>
            </div>
          )}

          {/* Answer options / free text answers */}
          {correctionQ.isFreeText ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Player view: their own per-field answers; points revealed once locked */}
              {!isQM && (correctionQ.fields ?? []).some((f: any) => f.myAnswer != null) && (
                <Card padding="12px">
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: 6 }}>{t('quiz.yourAnswer')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(correctionQ.fields ?? []).map((f: any) => (
                      <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '15px' }}>
                            {f.label && <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '12px', marginRight: 6 }}>{f.label}:</span>}
                            <span style={{ fontWeight: 700 }}>{f.myAnswer}</span>
                          </p>
                          {f.myLocked && f.myPoints !== null && (() => {
                            const gotPoints = (f.myPoints ?? 0) > 0
                            const tone = gotPoints ? 'var(--accent-green)' : 'var(--accent-warm)'
                            return (
                              <span
                                key={`score-${session.correctionIndex}-${f.id}`}
                                className="qz-score-reveal"
                                style={{
                                  flexShrink: 0, padding: '4px 11px', borderRadius: '99px',
                                  fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 800,
                                  color: '#fff', background: tone, whiteSpace: 'nowrap',
                                  ['--score-glow' as any]: tone,
                                }}
                              >
                                {t('quiz.freeTextPointsAwarded', { points: f.myPoints, max: f.points })}
                              </span>
                            )
                          })()}
                        </div>
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
                    ) : respondents.map(r => (
                      <RespondentScorer
                        key={r.key}
                        respondent={r}
                        onSetPoints={(answerId, points) => setFieldPoints.mutate({ answerId, points })}
                        onToggleLock={(answerId) => toggleFieldLock.mutate(answerId)}
                        onMaxLock={(answerId, maxPoints) => maxAndLockField.mutate({ answerId, maxPoints })}
                        maxLockBusy={maxAndLockField.isPending}
                      />
                    ))}
                  </>
                )
              })()}
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
                    className={isCorrect ? 'qz-correct-burst' : isWrong ? 'qz-wrong-shake' : undefined}
                    style={{
                      padding: '12px 14px', borderRadius: 'var(--radius)', position: 'relative', overflow: 'hidden',
                      border: `2px solid ${isCorrect ? 'var(--accent-green)' : isWrong ? 'var(--accent-warm)' : isMine ? 'var(--accent)' : 'var(--border-light)'}`,
                      background: isCorrect ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)' : isWrong ? 'color-mix(in srgb, var(--accent-warm) 8%, transparent)' : 'var(--background)',
                      boxShadow: isCorrect ? '0 0 0 3px color-mix(in srgb, var(--accent-green) 25%, transparent)' : isWrong ? '0 0 0 3px color-mix(in srgb, var(--accent-warm) 25%, transparent)' : 'none',
                      transition: 'border-color 300ms var(--ease-out), box-shadow 300ms var(--ease-out)',
                    }}
                  >
                    {session.correctAnswerVisible && (
                      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, background: isCorrect ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)' : isWrong ? 'color-mix(in srgb, var(--accent-warm) 12%, transparent)' : 'color-mix(in srgb, var(--text-muted) 8%, transparent)', transition: 'width 650ms var(--ease-out)' }} />
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
                          <CountUp value={pct} suffix="%" duration={650} style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '13px', color: isCorrect ? 'var(--accent-green)' : isWrong ? 'var(--accent-warm)' : 'var(--text-muted)', flexShrink: 0 }} />
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
                              background: isCorrect ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)' : isWrong ? 'color-mix(in srgb, var(--accent-warm) 20%, transparent)' : 'var(--surface)',
                              color: isCorrect ? 'var(--accent-green)' : isWrong ? 'var(--accent-warm)' : 'var(--text-muted)',
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
          </Stage>

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

          {/* QM: revisit any question's free-text points after the fact. Closing
              the editor recomputes the saved totals so the leaderboard catches up. */}
          {isQM && (
            <Button variant="ghost" fullWidth onClick={() => setShowScoreEditor(true)}>
              {t('quiz.editScores')}
            </Button>
          )}

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
