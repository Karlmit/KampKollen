import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Avatar'
import { Modal } from '../components/ui/Modal'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'
import { ScoreType, SCORE_TYPE_LABELS } from '../types'

const numpadBtnStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: 'var(--radius)',
  border: '1.5px solid var(--border-light)',
  background: 'var(--surface)',
  fontSize: '20px',
  fontFamily: 'var(--font-ui)',
  fontWeight: 700,
  cursor: 'pointer',
  color: 'var(--text-primary)',
}

function NumpadModal({ open, onClose, playerName, currentValue, scoreLabel, onSave }: {
  open: boolean
  onClose: () => void
  playerName: string
  currentValue: string
  scoreLabel: string
  onSave: (val: string) => void
}) {
  const [input, setInput] = useState('')

  useEffect(() => {
    if (open) setInput(currentValue || '')
  }, [open, currentValue])

  const push = (d: string) => {
    if (d === '.' && input.includes('.')) return
    setInput(s => s + d)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={playerName}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(input); onClose() }}>Save</Button>
        </>
      }
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius)',
        padding: '12px 16px', marginBottom: '8px', textAlign: 'center',
        fontSize: '32px', fontFamily: 'var(--font-ui)', fontWeight: 700,
        minHeight: '56px', letterSpacing: '2px',
      }}>
        {input || <span style={{ color: 'var(--text-muted)', fontSize: '24px' }}>—</span>}
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '14px' }}>
        {scoreLabel}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(d => (
          <button key={d} onClick={() => push(d)} style={numpadBtnStyle}>{d}</button>
        ))}
        <button onClick={() => push('.')} style={numpadBtnStyle}>.</button>
        <button onClick={() => push('0')} style={numpadBtnStyle}>0</button>
        <button
          onClick={() => setInput(s => s.slice(0, -1))}
          style={{ ...numpadBtnStyle, color: 'var(--accent-warm)' }}
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
  const [selectedCcId, setSelectedCcId] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [editingPlayer, setEditingPlayer] = useState<any>(null)

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

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCcId) return
      const cc = comp?.challenges.find((c: any) => c.id === selectedCcId)
      const scoreType: ScoreType = cc?.scoreTypeOverride ?? cc?.challenge.scoreType

      const entries = Object.entries(scores).filter(([, v]) => v !== '')
      for (const [userId, val] of entries) {
        const num = parseFloat(val)
        if (isNaN(num)) continue
        const data: any = { userId }
        if (scoreType === 'time_fastest_wins') data.timeMs = Math.round(num * 1000)
        else if (scoreType === 'placement_lowest_wins') data.placement = num
        else if (scoreType === 'manual_points') data.calculatedPoints = num
        else data.rawScore = num
        await api.scores.upsert(competitionId!, selectedCcId!, data)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scores', competitionId, selectedCcId] })
      setScores({})
    },
  })

  if (isLoading) return <Layout title="Enter Scores" back={`/competitions/${competitionId}`}><LoadingSpinner /></Layout>

  const comp = compData?.competition
  if (!comp) return <Layout title="Enter Scores"><p>Not found</p></Layout>

  const myPlayer = comp.players?.find((p: any) => p.userId === user?.id)
  const canEnterScores = isAdmin || myPlayer?.isTeamLeader || myPlayer?.isScorekeeper

  if (!canEnterScores) {
    return (
      <Layout title="Enter Scores" back={`/competitions/${competitionId}`}>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px 0', fontSize: '15px' }}>
          You don't have permission to enter scores for this competition.
        </p>
      </Layout>
    )
  }

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
    if (scoreType === 'time_fastest_wins') return 'Time in seconds'
    return SCORE_TYPE_LABELS[scoreType] ?? scoreType
  })()

  // Determine which players to show and group by team
  const allPlayers: any[] = comp.players ?? []
  const playersToShow = isAdmin
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
    ...(poolPlayers.length > 0 ? [{ id: null as any, name: 'Player Pool', players: poolPlayers }] : []),
  ]
  const showTeamHeaders = isAdmin || groupedTeams.length > 1

  const pendingCount = Object.keys(scores).length

  return (
    <Layout title="Enter Scores" back={`/competitions/${competitionId}`}>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>{comp.name}</p>

      {/* Challenge selector */}
      <section style={{ marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          SELECT CHALLENGE
        </h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {comp.challenges?.map((cc: any) => (
            <button
              key={cc.id}
              onClick={() => { setSelectedCcId(cc.id); setScores({}) }}
              style={{
                padding: '8px 14px', borderRadius: 'var(--radius)',
                background: selectedCcId === cc.id ? 'var(--text-primary)' : 'var(--surface)',
                color: selectedCcId === cc.id ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {cc.challenge.name}
            </button>
          ))}
        </div>
      </section>

      {selectedCc && (
        <>
          <Card style={{ marginBottom: '16px', background: 'var(--surface-raised)' }} padding="12px">
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Score type: <strong>{SCORE_TYPE_LABELS[scoreType]}</strong>
            </p>
            {scoreType === 'time_fastest_wins' && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enter time in seconds</p>
            )}
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
            {groupedTeams.map(team => (
              <div key={team.id ?? 'pool'}>
                {showTeamHeaders && (
                  <h3 style={{
                    fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 700,
                    color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em',
                  }}>
                    {team.name?.toUpperCase() ?? 'PLAYER POOL'}
                  </h3>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {team.players.map((p: any) => {
                    const existing = getExistingScore(p.userId)
                    const staged = scores[p.userId]
                    const hasValue = staged !== undefined || existing
                    return (
                      <Card
                        key={p.userId}
                        padding="12px"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setEditingPlayer(p)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={36} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>
                              <Link
                                to={`/profile/${p.userId}`}
                                onClick={e => e.stopPropagation()}
                                style={{ color: 'inherit', textDecoration: 'none' }}
                              >
                                {p.user.displayName ?? p.user.username}
                              </Link>
                            </p>
                            {p.team && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.team.name}</p>}
                          </div>
                          <div style={{ textAlign: 'right', minWidth: '48px' }}>
                            {staged !== undefined ? (
                              <p style={{
                                fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px',
                                color: 'var(--accent)',
                              }}>
                                {staged || '—'}
                              </p>
                            ) : existing ? (
                              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', color: 'var(--text-muted)' }}>
                                {existing}
                              </p>
                            ) : (
                              <p style={{ fontSize: '13px', color: 'var(--border-light)' }}>tap</p>
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

          <Button
            fullWidth
            onClick={() => submitMutation.mutate()}
            loading={submitMutation.isPending}
            disabled={pendingCount === 0}
          >
            {pendingCount > 0 ? `Save ${pendingCount} score${pendingCount > 1 ? 's' : ''}` : 'Save Scores'}
          </Button>
        </>
      )}

      <NumpadModal
        open={!!editingPlayer}
        onClose={() => setEditingPlayer(null)}
        playerName={editingPlayer?.user?.displayName ?? editingPlayer?.user?.username ?? ''}
        currentValue={editingPlayer ? (scores[editingPlayer.userId] ?? getExistingScore(editingPlayer.userId)) : ''}
        scoreLabel={scoreLabel}
        onSave={(val) => {
          if (editingPlayer) setScores(s => ({ ...s, [editingPlayer.userId]: val }))
        }}
      />
    </Layout>
  )
}
