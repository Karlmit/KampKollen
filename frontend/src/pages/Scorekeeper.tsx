import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Avatar } from '../components/ui/Avatar'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'
import { ScoreType, SCORE_TYPE_LABELS } from '../types'

export function ScorekeeperPage() {
  const { id: competitionId } = useParams<{ id: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [selectedCcId, setSelectedCcId] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, string>>({})

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
            {scoreType === 'time_fastest_wins' && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enter time in seconds</p>}
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {comp.players?.map((p: any) => {
              const existing = getExistingScore(p.userId)
              return (
                <Card key={p.userId} padding="12px">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={36} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>
                        {p.user.displayName ?? p.user.username}
                      </p>
                      {p.team && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.team.name}</p>}
                    </div>
                    <Input
                      type="number"
                      placeholder={existing || '—'}
                      value={scores[p.userId] ?? ''}
                      onChange={e => setScores(s => ({ ...s, [p.userId]: e.target.value }))}
                      style={{ width: '80px', textAlign: 'right', padding: '6px 8px' }}
                    />
                  </div>
                </Card>
              )
            })}
          </div>

          <Button
            fullWidth
            onClick={() => submitMutation.mutate()}
            loading={submitMutation.isPending}
            disabled={Object.keys(scores).length === 0}
          >
            Save Scores
          </Button>
        </>
      )}
    </Layout>
  )
}
