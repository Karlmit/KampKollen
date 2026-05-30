import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Lottie from 'lottie-react'
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

function TrophyCard({ trophy, isSelf, adminMode, giftAnimData, onOpen, onTakeBack }: {
  trophy: any
  isSelf: boolean
  adminMode: boolean
  giftAnimData: any
  onOpen: () => void
  onTakeBack: () => void
}) {
  const lottieRef = useRef<any>(null)
  const [revealing, setRevealing] = useState(false)
  const [revealed, setRevealed] = useState(trophy.isOpened)

  const handleClick = () => {
    if (!isSelf || revealed || revealing || !giftAnimData) return
    setRevealing(true)
    lottieRef.current?.play()
  }

  const handleComplete = () => {
    setRevealed(true)
    setRevealing(false)
    onOpen()
  }

  const imgUrl = trophy.imageUrl.startsWith('http') ? trophy.imageUrl : `/${trophy.imageUrl}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: 88, position: 'relative' }}>
      {revealed ? (
        <img
          src={imgUrl}
          alt={trophy.title}
          style={{ width: 80, height: 80, borderRadius: 'var(--radius)', objectFit: 'cover' }}
        />
      ) : giftAnimData ? (
        <div
          onClick={handleClick}
          style={{
            width: 80, height: 80, cursor: isSelf && !revealing ? 'pointer' : 'default',
            position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius)',
          }}
        >
          <Lottie
            lottieRef={lottieRef}
            animationData={giftAnimData}
            autoplay={false}
            loop={false}
            onComplete={handleComplete}
            style={{ width: 80, height: 80 }}
          />
          {isSelf && !revealing && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.12)', borderRadius: 'var(--radius)',
              opacity: 0, transition: 'opacity 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
            >
              <span style={{ fontSize: '20px' }}>👆</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          width: 80, height: 80, borderRadius: 'var(--radius)',
          background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px',
        }}>🎁</div>
      )}
      <p style={{
        fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '11px',
        textAlign: 'center', color: 'var(--text-primary)', lineHeight: 1.2,
        maxWidth: 88, wordBreak: 'break-word',
      }}>
        {trophy.title}
      </p>
      {adminMode && (
        <button
          onClick={onTakeBack}
          style={{
            fontSize: '10px', fontFamily: 'var(--font-ui)', fontWeight: 700,
            color: 'var(--accent-warm)', background: 'none', border: 'none',
            cursor: 'pointer', padding: '2px 0',
          }}
        >
          ↩ Take back
        </button>
      )}
    </div>
  )
}

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
  const [adminMode, setAdminMode] = useState(false)
  const [giftAnimData, setGiftAnimData] = useState<any>(null)

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

  const trophies: any[] = data?.user?.trophies ?? []

  const openTrophyMutation = useMutation({
    mutationFn: (id: string) => api.trophies.open(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['user', userId] })
      await refreshUser()
    },
  })

  const takeBackMutation = useMutation({
    mutationFn: (id: string) => api.trophies.takeBack(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', userId] }),
  })

  const generateSendMutation = useMutation({
    mutationFn: () => api.trophies.generateSend(userId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', userId] }),
  })

  useEffect(() => {
    if (trophies.some((t: any) => !t.isOpened)) {
      fetch('/lottie/gift.json').then(r => r.json()).then(setGiftAnimData).catch(() => {})
    }
  }, [trophies.length])

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
          <div className="shimmer" style={{ width: 120, height: 120, borderRadius: '50%', flexShrink: 0 }} />
        ) : (
          <Avatar src={user.profileImageUrl} name={user.displayName ?? user.username} size={120} />
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

      {/* Trophy showcase */}
      {(trophies.length > 0 || (isAdmin && !isSelf)) && (
        <section style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Trophies {trophies.length > 0 ? `(${trophies.length})` : ''}
            </h2>
            {isAdmin && !isSelf && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Button
                  size="sm"
                  onClick={() => generateSendMutation.mutate()}
                  loading={generateSendMutation.isPending}
                  style={{ fontSize: '11px' }}
                >
                  🎁 Generate & Send
                </Button>
                <Button
                  size="sm"
                  variant={adminMode ? 'danger' : 'ghost'}
                  onClick={() => setAdminMode(m => !m)}
                  style={{ fontSize: '11px' }}
                >
                  {adminMode ? 'Admin ON' : 'Admin'}
                </Button>
              </div>
            )}
          </div>

          {trophies.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No trophies yet.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {trophies.map((trophy: any) => (
                <TrophyCard
                  key={trophy.id}
                  trophy={trophy}
                  isSelf={isSelf}
                  adminMode={adminMode}
                  giftAnimData={giftAnimData}
                  onOpen={() => openTrophyMutation.mutate(trophy.id)}
                  onTakeBack={() => takeBackMutation.mutate(trophy.id)}
                />
              ))}
            </div>
          )}
        </section>
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
