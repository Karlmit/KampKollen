import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Avatar'
import { Modal } from '../components/ui/Modal'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'
import { ScoreType } from '../types'
import { useTranslation } from 'react-i18next'

// ── Time Walk (least_time_difference) helpers ────────────────────────────────
// Each walk's time is held as a raw digit string and read positionally as a
// duration: the last two digits are seconds, the next two minutes, the next two
// hours. Typing therefore needs no field-switching — digits just flow in from
// the right (e.g. 4·3·2 → 4:32), which is the fewest possible presses.
function digitsToMs(d: string): number | null {
  if (!d) return null
  const ss = parseInt(d.slice(-2) || '0', 10)
  const mm = parseInt(d.slice(-4, -2) || '0', 10)
  const hh = parseInt(d.slice(-6, -4) || '0', 10)
  return ((hh * 3600) + (mm * 60) + ss) * 1000
}
function msToDigits(ms: number | null | undefined): string {
  if (ms == null) return ''
  const total = Math.round(ms / 1000)
  const ss = total % 60, mm = Math.floor(total / 60) % 60, hh = Math.floor(total / 3600)
  if (hh > 0) return `${hh}${String(mm).padStart(2, '0')}${String(ss).padStart(2, '0')}`
  if (mm > 0) return `${mm}${String(ss).padStart(2, '0')}`
  return ss === 0 ? '' : String(ss)
}
function formatWalkDigits(d: string): string {
  const ss = d.slice(-2), mm = d.slice(-4, -2), hh = d.slice(-6, -4)
  if (hh) return `${parseInt(hh, 10)}:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}`
  if (mm) return `${parseInt(mm, 10)}:${ss.padStart(2, '0')}`
  return `0:${(ss || '0').padStart(2, '0')}`
}
function formatClock(ms: number | null | undefined): string {
  if (ms == null) return '–'
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}
function formatDiffSeconds(sec: number): string {
  return Number.isInteger(sec) ? String(sec) : sec.toFixed(1)
}

function TimeWalkModal({ open, onClose, teamName, time1Ms, time2Ms, onSave, onDelete }: {
  open: boolean
  onClose: () => void
  teamName: string
  time1Ms: number | null
  time2Ms: number | null
  onSave: (t1: number | null, t2: number | null) => void
  onDelete?: () => void
}) {
  const { t } = useTranslation()
  const [d1, setD1] = useState('')
  const [d2, setD2] = useState('')
  const [active, setActive] = useState<'a' | 'b'>('a')

  useEffect(() => {
    if (open) { setD1(msToDigits(time1Ms)); setD2(msToDigits(time2Ms)); setActive('a') }
  }, [open, time1Ms, time2Ms])

  const ms1 = digitsToMs(d1)
  const ms2 = digitsToMs(d2)
  const diffSec = ms1 != null && ms2 != null ? Math.abs(ms1 - ms2) / 1000 : null
  const perfect = diffSec === 0

  const setActiveDigits = (fn: (d: string) => string) =>
    active === 'a' ? setD1(d => fn(d)) : setD2(d => fn(d))
  const pressDigit = (n: string) => setActiveDigits(d => (d.length >= 6 ? d : (d + n).replace(/^0+(?=\d)/, '')))
  const pressBack = () => setActiveDigits(d => d.slice(0, -1))
  const pressClear = () => setActiveDigits(() => '')

  const walkRow = (key: 'a' | 'b', label: string, digits: string) => {
    const isActive = active === key
    return (
      <button
        type="button"
        onClick={() => setActive(key)}
        aria-pressed={isActive}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          width: '100%', textAlign: 'left', cursor: 'pointer',
          padding: '14px 16px', borderRadius: 'var(--radius)',
          border: isActive ? '2px solid var(--accent)' : '1.5px solid var(--border-light)',
          background: isActive ? 'var(--surface)' : 'var(--background)',
          transition: 'border-color 160ms var(--ease-out), background 160ms var(--ease-out)',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: isActive ? 'var(--accent)' : 'var(--text-muted)',
        }}>
          {label}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <span
            key={digits}
            style={{
              fontFamily: 'var(--font-ui)', fontWeight: 700, lineHeight: 1,
              fontSize: isActive ? '34px' : '26px',
              fontVariantNumeric: 'tabular-nums',
              color: digits ? 'var(--text-primary)' : 'var(--border-light)',
              animation: isActive && digits ? 'numpadDigitPop 130ms cubic-bezier(0.25, 1, 0.5, 1) both' : undefined,
            }}
          >
            {formatWalkDigits(digits)}
          </span>
          {isActive && (
            <span aria-hidden="true" style={{
              width: '3px', height: '30px', marginLeft: '5px', borderRadius: '2px',
              background: 'var(--accent)', animation: 'twCaret 1.05s steps(1) infinite',
            }} />
          )}
        </span>
      </button>
    )
  }

  const verdict = (() => {
    if (diffSec == null) {
      return <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontWeight: 700 }}>{t('scorekeeper.timeWalkEnterBoth')}</span>
    }
    const bg = perfect ? 'var(--accent-green)' : 'var(--accent)'
    return (
      <span
        key={diffSec}
        style={{
          display: 'inline-flex', alignItems: 'baseline', gap: '6px',
          padding: '8px 16px', borderRadius: 'var(--radius-full)', background: bg, color: '#fff',
          fontFamily: 'var(--font-ui)', fontWeight: 700,
          animation: 'twVerdictPop 220ms var(--ease-out) both',
        }}
      >
        {perfect ? (
          <span style={{ fontSize: '15px' }}>◇ {t('scorekeeper.timeWalkPerfect')}</span>
        ) : (
          <>
            <span style={{ fontSize: '22px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{formatDiffSeconds(diffSec)}s</span>
            <span style={{ fontSize: '12px', opacity: 0.85 }}>{t('scorekeeper.timeWalkApart')}</span>
          </>
        )}
      </span>
    )
  })()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={teamName}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          {onDelete && (
            <Button variant="ghost" onClick={() => { onDelete(); onClose() }} style={{ color: 'var(--accent-warm)' }}>
              {t('scorekeeper.timeWalkRemove')}
            </Button>
          )}
          <Button onClick={() => { onSave(ms1, ms2); onClose() }} disabled={ms1 == null && ms2 == null}>
            {t('scorekeeper.save')}
          </Button>
        </>
      }
    >
      {/* Two walks share one keypad; the gap between them is the verdict. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '6px' }}>
        {walkRow('a', t('scorekeeper.timeWalkWalk', { n: 1 }), d1)}
        <div style={{ display: 'flex', justifyContent: 'center', minHeight: '40px', alignItems: 'center' }}>
          {verdict}
        </div>
        {walkRow('b', t('scorekeeper.timeWalkWalk', { n: 2 }), d2)}
      </div>

      <p style={{
        textAlign: 'center', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontWeight: 700, margin: '14px 0 10px',
      }}>
        {t('scorekeeper.timeWalkUnitHint')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
          <button key={n} type="button" className="numpad-btn" onClick={() => pressDigit(n)}>{n}</button>
        ))}
        <button type="button" className="numpad-btn numpad-btn--action" onClick={pressBack} style={{ color: 'var(--accent-warm)' }}>⌫</button>
        <button type="button" className="numpad-btn" onClick={() => pressDigit('0')}>0</button>
        <button type="button" className="numpad-btn numpad-btn--action" onClick={pressClear} style={{ color: 'var(--accent-warm)', fontSize: '15px' }}>{t('scorekeeper.clear')}</button>
      </div>
    </Modal>
  )
}

function NumpadModal({ open, onClose, playerName, currentValue, scoreLabel, onSave, onDelete }: {
  open: boolean
  onClose: () => void
  playerName: string
  currentValue: string
  scoreLabel: string
  onSave: (val: string) => void
  onDelete?: () => void
}) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [saved, setSaved] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)

  useEffect(() => {
    if (open) { setInput(currentValue || ''); setSaved(false) }
  }, [open, currentValue])

  const push = (d: string) => {
    if (d === '.' && input.includes('.')) return
    setInput(s => s + d)
  }

  const handleClear = () => {
    setShakeKey(k => k + 1)
    setInput('')
    setTimeout(() => { onDelete!(); onClose() }, 300)
  }

  const handleSave = () => {
    if (!input.trim()) return
    setSaved(true)
    onSave(input)
    setTimeout(onClose, 210)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={playerName}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          {onDelete && (
            <Button
              variant="ghost"
              onClick={handleClear}
              style={{ color: 'var(--accent-warm)' }}
            >
              {t('scorekeeper.clear')}
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!input.trim() || saved}
            style={saved ? {
              background: 'var(--accent-green)',
              borderColor: 'var(--accent-green)',
              transition: 'background 180ms var(--ease-out), border-color 180ms var(--ease-out)',
              animation: 'scoreSaved 200ms var(--ease-out) both',
            } : {}}
          >
            {saved ? '✓' : t('scorekeeper.save')}
          </Button>
        </>
      }
    >
      {/* Score display — key triggers shake animation on clear */}
      <div
        key={shakeKey}
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          marginBottom: '6px',
          textAlign: 'center',
          minHeight: '76px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: shakeKey > 0 ? 'numpadDisplayShake 300ms var(--ease-out) both' : undefined,
        }}
      >
        {input ? (
          /* key={input} remounts on every change, replaying the pop animation */
          <span
            key={input}
            style={{
              fontSize: '52px', fontFamily: 'var(--font-ui)', fontWeight: 700,
              lineHeight: 1, letterSpacing: '-1px', color: 'var(--text-primary)',
              animation: 'numpadDigitPop 130ms cubic-bezier(0.25, 1, 0.5, 1) both',
              display: 'block',
            }}
          >
            {input}
          </span>
        ) : (
          <span style={{
            fontSize: '28px', fontFamily: 'var(--font-ui)', fontWeight: 700,
            color: 'var(--border-light)', letterSpacing: '4px',
          }}>
            — — —
          </span>
        )}
      </div>
      <p style={{
        fontSize: '12px', color: 'var(--text-muted)',
        textAlign: 'center', marginBottom: '16px',
      }}>
        {scoreLabel}
      </p>

      {/* Numpad grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(d => (
          <button key={d} className="numpad-btn" onClick={() => push(d)}>{d}</button>
        ))}
        <button className="numpad-btn numpad-btn--action" onClick={() => push('.')}>.</button>
        <button className="numpad-btn" onClick={() => push('0')}>0</button>
        <button
          className="numpad-btn numpad-btn--action"
          onClick={() => setInput(s => s.slice(0, -1))}
          style={{ color: 'var(--accent-warm)' }}
        >
          ⌫
        </button>
      </div>
    </Modal>
  )
}

function ShotModal({ open, onClose, playerName, currentValue, maxScore, allowDecimals = false, unit, onSave, onDelete }: {
  open: boolean
  onClose: () => void
  playerName: string
  currentValue: number | null
  maxScore: number
  allowDecimals?: boolean
  unit?: string
  onSave: (val: number) => void
  onDelete?: () => void
}) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')

  useEffect(() => {
    if (open) setInput(currentValue !== null ? String(currentValue) : '')
  }, [open, currentValue])

  // maxScore 0 = no per-attempt cap. Decimal entry always uses the numpad (the
  // button grid can't express e.g. 3.1).
  const noCap = maxScore <= 0
  const useButtons = !allowDecimals && !noCap && maxScore <= 10
  const num = input === '' ? NaN : (allowDecimals ? parseFloat(input) : parseInt(input))
  const valid = !isNaN(num) && num >= 0 && (noCap || num <= maxScore)

  const commit = (val: number) => { onSave(val); onClose() }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={playerName}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          {onDelete && (
            <Button variant="ghost" onClick={() => { onDelete(); onClose() }} style={{ color: 'var(--accent-warm)' }}>
              {t('scorekeeper.clear')}
            </Button>
          )}
          {!useButtons && (
            <Button onClick={() => valid && commit(num)} disabled={!valid}>{t('scorekeeper.save')}</Button>
          )}
        </>
      }
    >
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '14px' }}>
        {noCap
          ? t('scorekeeper.attemptValue', { unit: unit ?? '' })
          : t('scorekeeper.shotValue', { max: maxScore })}
      </p>
      {useButtons ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {Array.from({ length: maxScore + 1 }, (_, i) => i).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => commit(v)}
              className="numpad-btn"
              style={currentValue === v ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
            >
              {v}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px 20px',
            marginBottom: '12px', textAlign: 'center', minHeight: '64px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '44px', fontFamily: 'var(--font-ui)', fontWeight: 700, lineHeight: 1 }}>
              {input || '—'}
            </span>
            {unit && input && (
              <span style={{ fontSize: '18px', fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--text-muted)', marginLeft: '8px', alignSelf: 'flex-end', marginBottom: '6px' }}>{unit}</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(d => (
              <button key={d} className="numpad-btn" onClick={() => setInput(s => s + d)}>{d}</button>
            ))}
            {allowDecimals ? (
              <button className="numpad-btn" onClick={() => setInput(s => s.includes('.') ? s : (s === '' ? '0.' : s + '.'))}>.</button>
            ) : (
              <button className="numpad-btn numpad-btn--action" onClick={() => setInput('')} style={{ color: 'var(--accent-warm)' }}>C</button>
            )}
            <button className="numpad-btn" onClick={() => setInput(s => s + '0')}>0</button>
            <button className="numpad-btn numpad-btn--action" onClick={() => setInput(s => s.slice(0, -1))} style={{ color: 'var(--accent-warm)' }}>⌫</button>
          </div>
        </>
      )}
    </Modal>
  )
}

export function ScorekeeperPage() {
  const { id: competitionId } = useParams<{ id: string }>()
  const { user, isAdmin } = useAuth()
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [selectedCcId, setSelectedCcId] = useState<string | null>(null)
  const [editingPlayer, setEditingPlayer] = useState<any>(null)
  const [shotModal, setShotModal] = useState<{ player: any; shot: any | null } | null>(null)
  const [timeWalkTeam, setTimeWalkTeam] = useState<{ id: string; name: string; ts: any | null } | null>(null)
  const [adminAllTeams, setAdminAllTeams] = useState(false)

  const { data: compData, isLoading } = useQuery({
    queryKey: ['competition', competitionId],
    queryFn: () => api.competitions.get(competitionId!),
    enabled: !!competitionId,
  })

  const { data: scoresData } = useQuery({
    queryKey: ['scores', competitionId, selectedCcId],
    queryFn: () => api.scores.forChallenge(competitionId!, selectedCcId!),
    enabled: !!competitionId && !!selectedCcId,
  })

  const selectedCcEarly = compData?.competition?.challenges?.find((c: any) => c.id === selectedCcId)
  const isShootingSel = (selectedCcEarly?.scoreTypeOverride ?? selectedCcEarly?.challenge?.scoreType) === 'shooting'

  const { data: shotsData } = useQuery({
    queryKey: ['shots', competitionId, selectedCcId],
    queryFn: () => api.shots.forChallenge(competitionId!, selectedCcId!),
    enabled: !!competitionId && !!selectedCcId && isShootingSel,
  })

  const isTimeDiffSel = (selectedCcEarly?.scoreTypeOverride ?? selectedCcEarly?.challenge?.scoreType) === 'least_time_difference'

  const { data: teamScoresData } = useQuery({
    queryKey: ['teamScores', competitionId, selectedCcId],
    queryFn: () => api.scores.teamForChallenge(competitionId!, selectedCcId!),
    enabled: !!competitionId && !!selectedCcId && isTimeDiffSel,
  })

  const deleteMutation = useMutation({
    mutationFn: (scoreId: string) => api.scores.delete(scoreId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scores', competitionId, selectedCcId] })
      qc.invalidateQueries({ queryKey: ['leaderboard', competitionId] })
    },
  })

  const upsertMutation = useMutation({
    mutationFn: async ({ userId, val }: { userId: string; val: string }) => {
      if (!selectedCcId) return
      const num = parseFloat(val)
      if (isNaN(num)) return
      const cc = comp?.challenges.find((c: any) => c.id === selectedCcId)
      const scoreType: ScoreType = cc?.scoreTypeOverride ?? cc?.challenge.scoreType
      const data: any = { userId }
      if (scoreType === 'time_fastest_wins') data.timeMs = Math.round(num * 1000)
      else if (scoreType === 'placement_lowest_wins') data.placement = num
      else if (scoreType === 'manual_points') data.calculatedPoints = num
      else data.rawScore = num
      return api.scores.upsert(competitionId!, selectedCcId!, data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scores', competitionId, selectedCcId] })
      qc.invalidateQueries({ queryKey: ['leaderboard', competitionId] })
    },
  })

  const invalidateShots = () => {
    qc.invalidateQueries({ queryKey: ['shots', competitionId, selectedCcId] })
    qc.invalidateQueries({ queryKey: ['leaderboard', competitionId] })
  }

  const addShotMutation = useMutation({
    mutationFn: ({ userId, value }: { userId: string; value: number }) =>
      api.shots.add(competitionId!, selectedCcId!, { userId, value }),
    onSuccess: invalidateShots,
    onError: invalidateShots, // resync counts if a concurrent add hit the team cap
  })
  const updateShotMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) => api.shots.update(id, { value }),
    onSuccess: invalidateShots,
  })
  const deleteShotMutation = useMutation({
    mutationFn: (id: string) => api.shots.delete(id),
    onSuccess: invalidateShots,
  })

  const invalidateTeamScores = () => {
    qc.invalidateQueries({ queryKey: ['teamScores', competitionId, selectedCcId] })
    qc.invalidateQueries({ queryKey: ['leaderboard', competitionId] })
  }
  const upsertTeamScoreMutation = useMutation({
    mutationFn: ({ teamId, time1Ms, time2Ms }: { teamId: string; time1Ms: number | null; time2Ms: number | null }) =>
      api.scores.upsertTeam(competitionId!, selectedCcId!, { teamId, time1Ms, time2Ms }),
    onSuccess: invalidateTeamScores,
  })
  const deleteTeamScoreMutation = useMutation({
    mutationFn: (id: string) => api.scores.deleteTeam(id),
    onSuccess: invalidateTeamScores,
  })

  if (isLoading) return <Layout title={t('scorekeeper.enterScores')} back={`/competitions/${competitionId}`}><LoadingSpinner /></Layout>

  const comp = compData?.competition
  if (!comp) return <Layout title={t('scorekeeper.enterScores')}><p>{t('scorekeeper.notFound')}</p></Layout>

  const myPlayer = comp.players?.find((p: any) => p.userId === user?.id)
  const canEnterScores = isAdmin || myPlayer?.isTeamLeader || myPlayer?.isScorekeeper

  if (!canEnterScores) {
    return (
      <Layout title={t('scorekeeper.enterScores')} back={`/competitions/${competitionId}`}>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px 0', fontSize: '15px' }}>
          {t('scorekeeper.noPermission')}
        </p>
      </Layout>
    )
  }

  // Quizzes are auto-scored from the quiz flow, so they don't belong in manual
  // score entry — showing them here only confuses scorekeepers.
  const scorableChallenges: any[] = (comp.challenges ?? []).filter((cc: any) => !cc.challenge.isQuiz)
  const selectedCc = comp.challenges?.find((c: any) => c.id === selectedCcId)
  const scoreType: ScoreType = selectedCc?.scoreTypeOverride ?? selectedCc?.challenge.scoreType
  const isShooting = scoreType === 'shooting'
  const isTimeDiff = scoreType === 'least_time_difference'
  const teamScoreByTeam: Record<string, any> = {}
  for (const ts of (teamScoresData?.teamScores ?? [])) teamScoreByTeam[ts.teamId] = ts
  const existingScores = scoresData?.scores ?? []
  const shotConfig = shotsData?.config ?? {
    maxScorePerShot: selectedCc?.challenge?.maxScorePerShot ?? 10,
    minShotsPerPlayer: selectedCc?.challenge?.minShotsPerPlayer ?? 3,
    shotsPerTeam: selectedCc?.challenge?.shotsPerTeam ?? 20,
    lowerIsBetter: selectedCc?.challenge?.shootingLowerIsBetter ?? false,
    valueUnit: selectedCc?.challenge?.valueUnit ?? 'pts',
    allowDecimals: selectedCc?.challenge?.allowDecimals ?? false,
    attemptsPerPlayer: selectedCc?.challenge?.attemptsPerPlayer ?? null,
    sumAllAttempts: selectedCc?.challenge?.sumAllAttempts ?? false,
    useTeamScoreMode: selectedCc?.challenge?.useTeamScoreMode ?? false,
  }
  const shotUnit: string = (shotConfig as any).valueUnit ?? 'pts'
  const attemptsCap: number | null = (shotConfig as any).attemptsPerPlayer ?? null
  // Round away float noise (e.g. 3.1 + 4.0 + 2.7) when showing sums of decimal values.
  const fmtNum = (n: number) => String(Math.round(n * 100) / 100)
  const shotsByPlayer: Record<string, any[]> = {}
  for (const s of (shotsData?.shots ?? [])) (shotsByPlayer[s.userId] ??= []).push(s)
  // Team-level shot totals/counts across ALL players on a team (the API returns
  // every team's shots, so these stay correct even when viewing one team).
  const teamShotTotals: Record<string, number> = shotsData?.teamTotals ?? {}
  const teamShotCounts: Record<string, number> = shotsData?.teamShotCounts ?? {}
  // A player's individual score: the sum of all their attempts when `sumAllAttempts`
  // is set (Spike-style), otherwise the sum of their best `minShotsPerPlayer` shots
  // (classic shooting). Matches the individual leaderboard.
  const playerIndividualScore = (shots: any[]) =>
    (shotConfig as any).sumAllAttempts
      ? shots.reduce((a, s) => a + s.value, 0)
      : [...shots]
          .sort((a, b) => (shotConfig.lowerIsBetter ? a.value - b.value : b.value - a.value))
          .slice(0, Math.max(0, shotConfig.minShotsPerPlayer))
          .reduce((a, s) => a + s.value, 0)

  const getExistingScore = (userId: string) => {
    const s = existingScores.find((s: any) => s.userId === userId)
    if (!s) return ''
    if (scoreType === 'time_fastest_wins' && s.timeMs) return String(s.timeMs / 1000)
    if (scoreType === 'placement_lowest_wins' && s.placement !== null) return String(s.placement)
    if (scoreType === 'manual_points' && s.calculatedPoints !== null) return String(s.calculatedPoints)
    return s.rawScore !== null ? String(s.rawScore) : ''
  }

  const scoreLabel = (() => {
    if (!scoreType) return ''
    if (scoreType === 'time_fastest_wins') return t('scorekeeper.timeInSeconds')
    return t(`scoreTypes.${scoreType}` as any)
  })()

  // Determine which players to show and group by team
  const allPlayers: any[] = comp.players ?? []
  const showAllTeams = isAdmin && adminAllTeams
  const playersToShow = showAllTeams
    ? allPlayers
    : allPlayers.filter((p: any) => p.teamId === myPlayer?.teamId)

  // Group by team
  const teamMap: Record<string, { id: string; name: string; players: any[] }> = {}
  const poolPlayers: any[] = []
  for (const p of playersToShow) {
    if (p.team) {
      if (!teamMap[p.teamId]) teamMap[p.teamId] = { id: p.teamId, name: p.team.name, players: [] }
      teamMap[p.teamId].players.push(p)
    } else {
      poolPlayers.push(p)
    }
  }
  const groupedTeams = [
    ...Object.values(teamMap),
    ...(poolPlayers.length > 0 ? [{ id: null as any, name: t('scorekeeper.playerPool'), players: poolPlayers }] : []),
  ]
  const showTeamHeaders = showAllTeams || groupedTeams.length > 1

  return (
    <Layout title={t('scorekeeper.enterScores')} back={`/competitions/${competitionId}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{comp.name}</p>
        {isAdmin && (
          <button
            onClick={() => setAdminAllTeams(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 10px', borderRadius: 'var(--radius)',
              border: `1.5px solid ${adminAllTeams ? 'var(--accent)' : 'var(--border-light)'}`,
              background: adminAllTeams ? 'var(--accent)' : 'var(--surface)',
              color: adminAllTeams ? '#fff' : 'var(--text-muted)',
              fontSize: '12px', fontFamily: 'var(--font-ui)', fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 180ms var(--ease-out), border-color 180ms var(--ease-out), color 180ms var(--ease-out)',
            }}
          >
            {adminAllTeams ? t('scorekeeper.allTeams') : t('scorekeeper.myTeam')}
          </button>
        )}
      </div>

      {/* Challenge selector */}
      <section style={{ marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          {t('scorekeeper.selectChallenge')}
        </h2>
        {scorableChallenges.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', padding: '8px 0' }}>
            {t('scorekeeper.noChallenges')}
          </p>
        ) : (
          <div className="challenge-grid">
            {scorableChallenges.map((cc: any) => (
              <button
                key={cc.id}
                type="button"
                onClick={() => setSelectedCcId(cc.id)}
                aria-pressed={selectedCcId === cc.id}
                className={`challenge-chip${selectedCcId === cc.id ? ' is-active' : ''}`}
              >
                {cc.challenge.logoUrl ? (
                  <img src={cc.challenge.logoUrl} alt="" className="challenge-chip__logo" />
                ) : (
                  <span className="challenge-chip__logo challenge-chip__logo--placeholder" aria-hidden="true">🏅</span>
                )}
                <span className="challenge-chip__name">{cc.challenge.name}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedCc && isShooting && (
        <div style={{
          display: 'flex', gap: '10px', alignItems: 'flex-start',
          background: 'var(--surface)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: '16px',
        }}>
          <span aria-hidden="true" style={{
            flexShrink: 0, width: '20px', height: '20px', borderRadius: '6px',
            background: 'var(--accent)', marginTop: '1px',
          }} />
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
            {(shotConfig as any).useTeamScoreMode
              ? t('scorekeeper.attemptsInfo', { unit: shotUnit })
              : t('scorekeeper.shootingInfo', { shots: shotConfig.shotsPerTeam, min: shotConfig.minShotsPerPlayer })}
          </p>
        </div>
      )}

      {selectedCc && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
            {groupedTeams.map(team => (
              <div key={team.id ?? 'pool'}>
                {(showTeamHeaders || (isShooting && team.id) || (isTimeDiff && team.id)) && (
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                    <h3 style={{
                      fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700,
                      color: 'var(--text-muted)', letterSpacing: '0.05em',
                    }}>
                      {team.name?.toUpperCase() ?? t('scorekeeper.playerPool')}
                    </h3>
                    {isShooting && team.id && (() => {
                      const used = teamShotCounts[team.id] ?? 0
                      const total = teamShotTotals[team.id] ?? 0
                      // Spike-style (player totals): no team-shot cap; show the team
                      // score (e.g. average) with its unit.
                      if ((shotConfig as any).useTeamScoreMode) {
                        return (
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                            {t('scorekeeper.teamScoreLabel', { score: fmtNum(total), unit: shotUnit })}
                          </span>
                        )
                      }
                      const atCap = used >= shotConfig.shotsPerTeam
                      return (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'var(--text-primary)' }}>
                            {t('scorekeeper.teamTotal', { total: fmtNum(total), max: shotConfig.shotsPerTeam * shotConfig.maxScorePerShot })}
                          </span>
                          <span style={{ color: atCap ? 'var(--accent-green)' : 'var(--text-muted)', marginLeft: '8px' }}>
                            {t('scorekeeper.shotsUsed', { used, max: shotConfig.shotsPerTeam })}
                          </span>
                        </span>
                      )
                    })()}
                  </div>
                )}
                {isTimeDiff ? (team.id && (() => {
                  const ts = teamScoreByTeam[team.id]
                  const hasTimes = ts && (ts.time1Ms != null || ts.time2Ms != null)
                  const diffSec = ts && ts.time1Ms != null && ts.time2Ms != null
                    ? Math.abs(ts.time1Ms - ts.time2Ms) / 1000
                    : null
                  return (
                    <Card
                      padding="16px"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setTimeWalkTeam({ id: team.id, name: team.name, ts: ts ?? null })}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ minWidth: 0 }}>
                          {hasTimes ? (
                            <p style={{ fontSize: '14px', fontFamily: 'var(--font-ui)', fontWeight: 700 }}>
                              {formatClock(ts.time1Ms)} · {formatClock(ts.time2Ms)}
                            </p>
                          ) : (
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('scorekeeper.timeWalkAwaiting')}</p>
                          )}
                          <p style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 700, marginTop: '4px' }}>
                            {t('scorekeeper.timeWalkSetTimes')}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {diffSec != null ? (
                            <>
                              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '28px', lineHeight: 1, color: diffSec === 0 ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                                {t('scorekeeper.timeWalkDiffSeconds', { seconds: formatDiffSeconds(diffSec) })}
                              </p>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('scorekeeper.timeWalkDiff')}</p>
                            </>
                          ) : (
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('scorekeeper.tap')}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })()) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {team.players.map((p: any) => {
                    if (isShooting) {
                      const playerShots = shotsByPlayer[p.userId] ?? []
                      const playerTotal = playerIndividualScore(playerShots)
                      const belowMin = !(shotConfig as any).sumAllAttempts && playerShots.length < shotConfig.minShotsPerPlayer
                      const capReached = attemptsCap != null && playerShots.length >= attemptsCap
                      return (
                        <Card key={p.userId} padding="14px 16px">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={40} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '16px' }}>
                                {p.user.displayName ?? p.user.username}
                              </p>
                              {belowMin && (
                                <p style={{ fontSize: '12px', color: 'var(--accent-warm)', fontWeight: 700 }}>
                                  {t('scorekeeper.belowMinShots', { min: shotConfig.minShotsPerPlayer })}
                                </p>
                              )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '22px', lineHeight: 1 }}>
                                {fmtNum(playerTotal)} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{shotUnit}</span>
                              </p>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {attemptsCap != null
                                  ? t('scorekeeper.attemptCount', { count: playerShots.length, max: attemptsCap })
                                  : t('scorekeeper.shotCount', { count: playerShots.length })}
                              </p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                            {playerShots.map((sh: any) => (
                              <button
                                key={sh.id}
                                type="button"
                                onClick={() => setShotModal({ player: p, shot: sh })}
                                className="shot-chip"
                                title={sh.counted ? t('scorekeeper.shotCounted') : t('scorekeeper.shotNotCounted')}
                                style={{
                                  minWidth: '44px', minHeight: '44px', padding: '0 10px',
                                  borderRadius: 'var(--radius)', cursor: 'pointer',
                                  fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px',
                                  border: sh.counted ? '2px solid var(--accent)' : '1.5px solid var(--border-light)',
                                  background: sh.counted ? 'var(--accent)' : 'var(--surface)',
                                  color: sh.counted ? '#fff' : 'var(--text-muted)',
                                  transition: 'background 160ms var(--ease-out), border-color 160ms var(--ease-out), color 160ms var(--ease-out)',
                                }}
                              >
                                {fmtNum(sh.value)}
                              </button>
                            ))}
                            {!capReached && (
                              <button
                                type="button"
                                onClick={() => setShotModal({ player: p, shot: null })}
                                aria-label={t('scorekeeper.addShot')}
                                title={t('scorekeeper.addShot')}
                                style={{
                                  minWidth: '44px', minHeight: '44px',
                                  borderRadius: 'var(--radius)', cursor: 'pointer',
                                  fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '22px',
                                  border: '1.5px dashed var(--accent)', background: 'var(--surface)',
                                  color: 'var(--accent)', lineHeight: 1,
                                }}
                              >
                                +
                              </button>
                            )}
                          </div>
                        </Card>
                      )
                    }
                    const existing = getExistingScore(p.userId)
                    const isSaving = upsertMutation.isPending && editingPlayer?.userId === p.userId
                    return (
                      <Card
                        key={p.userId}
                        padding="16px 16px"
                        style={{ cursor: 'pointer', opacity: isSaving ? 0.6 : 1 }}
                        onClick={() => setEditingPlayer(p)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={44} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '16px' }}>
                              {p.user.displayName ?? p.user.username}
                            </p>
                            {p.team && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.team.name}</p>}
                          </div>
                          <div style={{ textAlign: 'right', minWidth: '48px' }}>
                            {existing ? (
                              <p
                                key={existing}
                                style={{
                                  fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '28px',
                                  animation: 'scoreFlash 500ms var(--ease-out) both',
                                }}
                              >
                                {existing}
                              </p>
                            ) : (
                              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('scorekeeper.tap')}</p>
                            )}
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
                )}
              </div>
            ))}
          </div>

        </>
      )}

      <NumpadModal
        open={!!editingPlayer}
        onClose={() => setEditingPlayer(null)}
        playerName={editingPlayer?.user?.displayName ?? editingPlayer?.user?.username ?? ''}
        currentValue={editingPlayer ? getExistingScore(editingPlayer.userId) : ''}
        scoreLabel={scoreLabel}
        onSave={(val) => {
          if (editingPlayer && val.trim()) {
            upsertMutation.mutate({ userId: editingPlayer.userId, val })
          }
        }}
        onDelete={editingPlayer ? (() => {
          const existing = existingScores.find((s: any) => s.userId === editingPlayer.userId)
          if (existing) deleteMutation.mutate(existing.id)
        }) : undefined}
      />

      <ShotModal
        open={!!shotModal}
        onClose={() => setShotModal(null)}
        playerName={shotModal?.player?.user?.displayName ?? shotModal?.player?.user?.username ?? ''}
        currentValue={shotModal?.shot ? shotModal.shot.value : null}
        maxScore={shotConfig.maxScorePerShot}
        allowDecimals={(shotConfig as any).allowDecimals ?? false}
        unit={shotUnit}
        onSave={(val) => {
          if (!shotModal) return
          if (shotModal.shot) updateShotMutation.mutate({ id: shotModal.shot.id, value: val })
          else addShotMutation.mutate({ userId: shotModal.player.userId, value: val })
        }}
        onDelete={shotModal?.shot ? (() => deleteShotMutation.mutate(shotModal.shot.id)) : undefined}
      />

      <TimeWalkModal
        open={!!timeWalkTeam}
        onClose={() => setTimeWalkTeam(null)}
        teamName={timeWalkTeam?.name ?? ''}
        time1Ms={timeWalkTeam?.ts?.time1Ms ?? null}
        time2Ms={timeWalkTeam?.ts?.time2Ms ?? null}
        onSave={(t1, t2) => {
          if (timeWalkTeam) upsertTeamScoreMutation.mutate({ teamId: timeWalkTeam.id, time1Ms: t1, time2Ms: t2 })
        }}
        onDelete={timeWalkTeam?.ts ? (() => deleteTeamScoreMutation.mutate(timeWalkTeam.ts.id)) : undefined}
      />
    </Layout>
  )
}
