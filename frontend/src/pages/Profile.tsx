import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Avatar } from '../components/ui/Avatar'
import { Badge, RoleBadge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { ProfileImageGenerator } from '../components/ProfileImageGenerator'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'
import { formatScore, extractScoreValue } from '../utils'

export function Profile() {
  const { id: paramId } = useParams<{ id?: string }>()
  const { user: me, logout, refreshUser, isAdmin } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const userId = paramId ?? me?.id
  const isSelf = userId === me?.id

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ displayName: '', realName: '', password: '' })
  const [isGenerating, setIsGenerating] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.users.get(userId!),
    enabled: !!userId,
  })

  const updateMutation = useMutation({
    mutationFn: () => api.users.update(userId!, {
      displayName: form.displayName || undefined,
      realName: form.realName || undefined,
      password: form.password || undefined,
    }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['user', userId] })
      if (isSelf) await refreshUser()
      setEditing(false)
      setForm({ displayName: '', realName: '', password: '' })
    },
  })

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  if (isLoading) return <Layout title="Profile"><LoadingSpinner /></Layout>
  const user = data?.user
  if (!user) return <Layout title="Profile"><p>User not found</p></Layout>

  return (
    <Layout
      title={isSelf ? 'My Profile' : (user.displayName ?? user.username)}
      action={isSelf ? <Button variant="ghost" size="sm" onClick={handleLogout}>Log out</Button> : null}
    >
      {/* Profile header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        {isGenerating ? (
          <div className="shimmer" style={{ width: 96, height: 96, borderRadius: '50%', flexShrink: 0 }} />
        ) : (
          <Avatar src={user.profileImageUrl} name={user.displayName ?? user.username} size={96} />
        )}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '22px' }}>
            {user.displayName ?? user.username}
          </h2>
          {user.realName && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{user.realName}</p>}
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>@{user.username}</p>
          <div style={{ marginTop: '8px' }}>
            <RoleBadge role={user.globalRole} />
          </div>
        </div>

        {(isSelf || isAdmin) && (
          <ProfileImageGenerator
            onGenerate={async (prompt) => {
              setIsGenerating(true)
              try {
                const res = await api.users.generateImage(userId!, prompt)
                await qc.invalidateQueries({ queryKey: ['user', userId] })
                if (isSelf) await refreshUser()
                return res.imageUrl
              } finally {
                setIsGenerating(false)
              }
            }}
          />
        )}
      </div>

      {/* Edit form */}
      {(isSelf || isAdmin) && (
        <Card style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: '15px' }}>Account settings</h3>
            <Button size="sm" variant="ghost" onClick={() => {
              setEditing(!editing)
              setForm({ displayName: user.displayName ?? '', realName: user.realName ?? '', password: '' })
            }}>
              {editing ? 'Cancel' : 'Edit'}
            </Button>
          </div>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Input label="Display name" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
              <Input label="Real name" value={form.realName} onChange={e => setForm(f => ({ ...f, realName: e.target.value }))} />
              <Input label="New password (leave blank to keep current)" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              <Button onClick={() => updateMutation.mutate()} loading={updateMutation.isPending} fullWidth>
                Save changes
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Display name</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}>{user.displayName ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Real name</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}>{user.realName ?? '—'}</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Personal bests per challenge */}
      {user.scores?.length > 0 && (() => {
        // Group by challenge, keep best score per challenge
        const bestByChallenge: Record<string, any> = {}
        for (const s of user.scores) {
          const cc = s.competitionChallenge
          if (!cc) continue
          const challenge = cc.challenge
          const effectiveSt = cc.scoreTypeOverride ?? challenge.scoreType
          const val = extractScoreValue(s, effectiveSt)
          if (val === null) continue
          const existing = bestByChallenge[challenge.id]
          const lowerBetter = effectiveSt === 'time_fastest_wins' || effectiveSt === 'number_lowest_wins' || effectiveSt === 'placement_lowest_wins'
          if (!existing || (lowerBetter ? val < existing.score : val > existing.score)) {
            bestByChallenge[challenge.id] = {
              challenge,
              score: val,
              competitionName: cc.competition?.name ?? '',
              effectiveSt,
            }
          }
        }
        const bests = Object.values(bestByChallenge)
        if (bests.length === 0) return null
        return (
          <section style={{ marginBottom: '16px' }}>
            <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', color: 'var(--text-muted)' }}>
              Personal Bests
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bests.map((b: any) => (
                <Card key={b.challenge.id} padding="12px">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {b.challenge.logoUrl ? (
                      <img src={b.challenge.logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🏅</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{b.challenge.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{b.competitionName}</p>
                    </div>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px', flexShrink: 0 }}>
                      {formatScore(b.score, b.challenge.scoreType)}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )
      })()}

      {/* Competition history */}
      {user.competitionPlayers?.length > 0 && (
        <section>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', color: 'var(--text-muted)' }}>
            Competitions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {user.competitionPlayers.map((cp: any) => (
              <Card key={cp.id} padding="12px">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{cp.competition.name}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {cp.team ? cp.team.name : 'Player Pool'}
                    </p>
                  </div>
                  {cp.isTeamLeader && <Badge variant="info">Leader</Badge>}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </Layout>
  )
}
