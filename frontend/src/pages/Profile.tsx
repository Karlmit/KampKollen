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
import { ImageGenerator } from '../components/ImageGenerator'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'

export function Profile() {
  const { id: paramId } = useParams<{ id?: string }>()
  const { user: me, logout, refreshUser, isAdmin } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const userId = paramId ?? me?.id
  const isSelf = userId === me?.id

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ displayName: '', realName: '', password: '' })

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
        <Avatar src={user.profileImageUrl} name={user.displayName ?? user.username} size={96} />
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
          <div style={{ width: '100%' }}>
          <ImageGenerator
            defaultPrompt="A fun random animal avatar. Colorful, playful, simple."
            onGenerate={async (prompt) => {
              const res = await api.users.generateImage(userId!, prompt)
              qc.invalidateQueries({ queryKey: ['user', userId] })
              if (isSelf) refreshUser()
              return res.imageUrl
            }}
            label="Profile Image"
          />
          </div>
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
