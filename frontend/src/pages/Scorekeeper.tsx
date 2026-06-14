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

export function ScorekeeperPage() {
  const { id: competitionId } = useParams<{ id: string }>()
  const { user, isAdmin } = useAuth()
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [selectedCcId, setSelectedCcId] = useState<string | null>(null)
  const [editingPlayer, setEditingPlayer] = useState<any>(null)
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
  const existingScores = scoresData?.scores ?? []

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

      {selectedCc && (
        <>
          <Card style={{ marginBottom: '16px', background: 'var(--surface-raised)' }} padding="12px">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {selectedCc.challenge.logoUrl && (
                <img
                  src={selectedCc.challenge.logoUrl}
                  alt=""
                  style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              <div>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>
                  {selectedCc.challenge.name}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {t('scorekeeper.scoreTypeLabel')}<strong>{t(`scoreTypes.${scoreType}` as any)}</strong>
                </p>
              </div>
            </div>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
            {groupedTeams.map(team => (
              <div key={team.id ?? 'pool'}>
                {showTeamHeaders && (
                  <h3 style={{
                    fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700,
                    color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em',
                  }}>
                    {team.name?.toUpperCase() ?? t('scorekeeper.playerPool')}
                  </h3>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {team.players.map((p: any) => {
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
    </Layout>
  )
}
