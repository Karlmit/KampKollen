import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge, StatusBadge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { formatDate } from '../utils'
import { TabBar } from '../components/ui/TabBar'
import { api } from '../api/client'
import { Competition, CompetitionPlayer, Team, SCORE_TYPE_LABELS } from '../types'
import { GuestCompetitionView } from './GuestCompetitionView'

type Tab = 'overview' | 'teams' | 'challenges' | 'pool'

export function CompetitionDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, isAdmin } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')

  const { data, isLoading } = useQuery({
    queryKey: ['competition', id],
    queryFn: () => api.competitions.get(id!),
    enabled: !!id,
  })

  const joinMutation = useMutation({
    mutationFn: () => api.competitions.join(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', id] }),
  })

  if (isLoading) return <Layout title="Competition"><LoadingSpinner /></Layout>
  const comp: Competition = data?.competition
  if (!comp) return <Layout title="Competition"><p>Not found</p></Layout>

  // Guests get a purpose-built read-only spectator view
  if (!user) return <GuestCompetitionView id={id!} />

  const myPlayer = comp.players?.find((p: CompetitionPlayer) => p.userId === user?.id)
  const isJoined = !!myPlayer
  const myTeam = comp.teams?.find((t: Team) => t.id === myPlayer?.teamId)
  const playerPool = comp.players?.filter((p: CompetitionPlayer) => !p.teamId) ?? []

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'teams', label: 'Teams', count: comp.teams?.length },
    { key: 'challenges', label: 'Challenges', count: comp.challenges?.length },
    { key: 'pool', label: 'Player Pool', count: playerPool.length },
  ]

  return (
    <Layout
      title={comp.name}
      back="/competitions"
      action={
        !isJoined && ['REGISTRATION', 'ACTIVE'].includes(comp.status) ? (
          <Button size="sm" onClick={() => joinMutation.mutate()} loading={joinMutation.isPending}>
            Join
          </Button>
        ) : null
      }
    >
      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        {comp.date && <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{formatDate(comp.date)}</span>}
        <StatusBadge status={comp.status} />
        {isJoined && <Badge variant="success">✓ Joined</Badge>}
      </div>

      {/* My team banner */}
      {myTeam && (
        <Link to={`/competitions/${id}/team/${myTeam.id}`} style={{ textDecoration: 'none', display: 'block', marginBottom: '16px' }}>
          <Card style={{ background: 'var(--text-primary)', color: '#fff', borderColor: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '2px' }}>YOUR TEAM</p>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '18px' }}>{myTeam.name}</p>
              </div>
              <span style={{ fontSize: '24px' }}>🛡️</span>
            </div>
          </Card>
        </Link>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <Link to={`/competitions/${id}/leaderboard`}>
          <Button variant="ghost" size="sm">📊 Leaderboard</Button>
        </Link>
        {(isAdmin || myPlayer?.isTeamLeader || myPlayer?.isScorekeeper) && (
          <Link to={`/competitions/${id}/scores`}>
            <Button variant="ghost" size="sm">✏️ Enter Scores</Button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <TabBar
        tabs={tabs.map(t => ({
          key: t.key,
          label: t.count !== undefined ? `${t.label} (${t.count})` : t.label,
        }))}
        active={tab}
        onChange={key => setTab(key as Tab)}
        style={{ marginBottom: '16px' }}
      />

      {/* Tab content */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { label: 'Teams', value: comp.teams?.length ?? 0 },
                { label: 'Players', value: comp.players?.length ?? 0 },
                { label: 'Challenges', value: comp.challenges?.length ?? 0 },
                { label: 'In pool', value: playerPool.length },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 700 }}>{s.value}</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'teams' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {comp.teams?.map((team: Team) => (
            <Link to={`/competitions/${id}/team/${team.id}`} key={team.id} style={{ textDecoration: 'none' }}>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Avatar
                    src={team.imageUrl}
                    name={team.name}
                    size={44}
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px' }}>{team.name}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {team.players?.length ?? 0} players
                      {team.leader ? ` · Leader: ${team.leader.displayName ?? team.leader.username}` : ''}
                    </p>
                  </div>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {tab === 'challenges' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {comp.challenges?.map((cc: any, i: number) => (
            <Card key={cc.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-raised)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontFamily: 'var(--font-ui)', fontWeight: 700,
                  fontSize: '14px', color: 'var(--text-muted)', flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px' }}>{cc.challenge.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {SCORE_TYPE_LABELS[cc.challenge.scoreType as keyof typeof SCORE_TYPE_LABELS]}
                  </p>
                </div>
              </div>
              {cc.challenge.description && (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  {cc.challenge.description}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === 'pool' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {playerPool.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
              No players in the pool
            </p>
          ) : (
            playerPool.map((p: CompetitionPlayer) => (
              <Card key={p.userId} padding="12px">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={36} />
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700 }}>
                    {p.user.displayName ?? p.user.username}
                  </p>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </Layout>
  )
}
