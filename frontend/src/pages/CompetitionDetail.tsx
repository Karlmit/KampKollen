import { useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge, StatusBadge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { Modal } from '../components/ui/Modal'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { formatDate } from '../utils'
import { TabBar } from '../components/ui/TabBar'
import { api } from '../api/client'
import { Competition, CompetitionPlayer, Team, SCORE_TYPE_LABELS, LeaderboardTeam, CompetitionLeaderboard } from '../types'
import { GuestCompetitionView } from './GuestCompetitionView'
import { CompetitionLeaderboardContent } from '../components/CompetitionLeaderboardContent'

type Tab = 'leaderboard' | 'teams' | 'challenges' | 'pool'

export function CompetitionDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, isAdmin } = useAuth()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as Tab) ?? 'leaderboard'
  const setTab = (key: Tab) => setSearchParams({ tab: key }, { replace: true })

  const { data, isLoading } = useQuery({
    queryKey: ['competition', id],
    queryFn: () => api.competitions.get(id!),
    enabled: !!id,
  })

  const { data: lbDataRaw } = useQuery({
    queryKey: ['leaderboard', id],
    queryFn: () => api.leaderboards.competition(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  })

  const joinMutation = useMutation({
    mutationFn: () => api.competitions.join(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', id] }),
  })

  const removeFromPoolMutation = useMutation({
    mutationFn: (userId: string) => api.competitions.removePlayer(id!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', id] }),
  })

  const [assigningPlayer, setAssigningPlayer] = useState<any>(null)
  const [assignTargetTeamId, setAssignTargetTeamId] = useState('')

  const assignToTeamMutation = useMutation({
    mutationFn: ({ userId, teamId }: { userId: string; teamId: string }) =>
      api.competitions.updatePlayer(id!, userId, { teamId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competition', id] })
      setAssigningPlayer(null)
    },
  })

  if (isLoading) return <Layout title="Competition"><LoadingSpinner /></Layout>
  const comp: Competition = data?.competition
  if (!comp) return <Layout title="Competition"><p>Not found</p></Layout>

  // Guests get a purpose-built read-only spectator view
  if (!user) return <GuestCompetitionView id={id!} />

  const myPlayer = comp.players?.find((p: CompetitionPlayer) => p.userId === user?.id)
  const isJoined = !!myPlayer
  const isTeamComp = comp.isTeamCompetition !== false
  const myTeam = comp.teams?.find((t: Team) => t.id === myPlayer?.teamId)
  const playerPool = comp.players?.filter((p: CompetitionPlayer) => !p.teamId) ?? []

  const lbData: CompetitionLeaderboard | undefined = (lbDataRaw as any)

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'leaderboard', label: '📊 Leaderboard' },
    ...(isTeamComp ? [{ key: 'teams' as Tab, label: 'Teams', count: comp.teams?.length }] : []),
    { key: 'challenges', label: 'Challenges', count: comp.challenges?.length },
    { key: 'pool', label: isTeamComp ? 'Player Pool' : 'Players', count: comp.players?.length },
  ]

  return (
    <Layout
      title={comp.name}
      back="/competitions"
    >
      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        {comp.date && <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{formatDate(comp.date)}</span>}
        <StatusBadge status={comp.status} />
        {isJoined && <Badge variant="success">✓ Joined</Badge>}
      </div>

      {/* Join CTA */}
      {!isJoined && ['REGISTRATION', 'ACTIVE'].includes(comp.status) && (
        <Button
          fullWidth
          size="lg"
          onClick={() => joinMutation.mutate()}
          loading={joinMutation.isPending}
          style={{ marginBottom: '16px' }}
        >
          Join Competition
        </Button>
      )}

      {/* Waiting for team notice — only for team competitions */}
      {isTeamComp && isJoined && !myTeam && (
        <Card style={{ marginBottom: '16px', background: 'var(--surface-raised)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px', flexShrink: 0 }}>⏳</span>
            <div>
              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>You're in the player pool</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                A Team Leader or Admin will assign you to a team. Hang tight!
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* My team banner */}
      {myTeam && (
        <Link to={`/competitions/${id}/team/${myTeam.id}`} style={{ textDecoration: 'none', display: 'block', marginBottom: '16px' }}>
          <Card style={{ background: 'var(--text-primary)', color: '#fff', borderColor: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '2px' }}>YOUR TEAM</p>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '18px' }}>{myTeam.name}</p>
              </div>
              {myTeam.imageUrl && (
                <img src={myTeam.imageUrl} alt={myTeam.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              )}
            </div>
          </Card>
        </Link>
      )}

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

      {/* Leaderboard tab */}
      {tab === 'leaderboard' && (
        lbData
          ? <CompetitionLeaderboardContent lb={lbData} id={id!} userId={user?.id} />
          : <LoadingSpinner />
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
                    style={{ borderRadius: '50%' }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px' }}>{team.name}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {team.players?.length ?? 0} players
                      {team.leader ? ` · Leader: ${team.leader.displayName ?? team.leader.username}` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1 }}>›</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {tab === 'challenges' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {comp.challenges?.map((cc: any, i: number) => (
            <Card key={cc.id} padding="0" style={{ overflow: 'hidden' }}>
              {/* overflow:hidden on this div contains the float */}
              <div style={{ padding: '14px 16px', overflow: 'hidden' }}>
                {/* Image floated right — must precede text in DOM for float to work */}
                {cc.challenge.logoUrl ? (
                  <img
                    src={cc.challenge.logoUrl}
                    alt={cc.challenge.name}
                    style={{
                      float: 'right', display: 'block',
                      width: 132, height: 132,
                      objectFit: 'cover',
                      borderRadius: 'var(--radius)',
                      marginLeft: 12, marginBottom: 6,
                    }}
                  />
                ) : (
                  <div style={{
                    float: 'right',
                    width: 132, height: 132,
                    borderRadius: 'var(--radius)',
                    marginLeft: 12, marginBottom: 6,
                    background: 'var(--surface-raised)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '36px', color: 'var(--border-light)' }}>
                      {i + 1}
                    </span>
                  </div>
                )}
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px' }}>
                  {cc.challenge.name}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {SCORE_TYPE_LABELS[cc.challenge.scoreType as keyof typeof SCORE_TYPE_LABELS]}
                </p>
                {cc.challenge.description && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
                    {cc.challenge.description}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'pool' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Individual competition: flat player list */}
          {!isTeamComp && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(comp.players ?? []).map((p: CompetitionPlayer) => (
                <Card key={p.userId} padding="12px">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Link to={`/profile/${p.userId}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
                      <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={36} />
                      <div>
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700 }}>{p.user.displayName ?? p.user.username}</p>
                        {(p.isTeamLeader || p.isScorekeeper) && (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {[p.isTeamLeader && 'Leader', p.isScorekeeper && 'Scorekeeper'].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </Link>
                    {isAdmin && (
                      <Button size="sm" variant="danger" style={{ fontSize: '11px', padding: '4px 8px' }}
                        loading={removeFromPoolMutation.isPending}
                        onClick={() => removeFromPoolMutation.mutate(p.userId)}>
                        ×
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Team competition: unassigned players */}
          {isTeamComp && <div>
            <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Unassigned ({playerPool.length})
            </h3>
            {playerPool.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Everyone is assigned to a team</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {playerPool.map((p: CompetitionPlayer) => (
                  <Card key={p.userId} padding="12px">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Link to={`/profile/${p.userId}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
                        <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={36} />
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700 }}>
                          {p.user.displayName ?? p.user.username}
                        </p>
                      </Link>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <Button size="sm" variant="ghost" style={{ fontSize: '12px', padding: '4px 10px' }}
                            onClick={() => { setAssigningPlayer(p); setAssignTargetTeamId('') }}>
                            Assign
                          </Button>
                          <Button size="sm" variant="danger" style={{ fontSize: '11px', padding: '4px 8px' }}
                            loading={removeFromPoolMutation.isPending}
                            onClick={() => removeFromPoolMutation.mutate(p.userId)}>
                            ×
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>}

          {/* Players by team — team competitions only */}
          {isTeamComp && comp.teams?.map((team: Team) => {
            const teamPlayers = (comp.players?.filter((p: CompetitionPlayer) => p.teamId === team.id) ?? [])
              .sort((a: CompetitionPlayer, b: CompetitionPlayer) => (b.isTeamLeader ? 1 : 0) - (a.isTeamLeader ? 1 : 0))
            return (
              <div key={team.id}>
                <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {team.name} ({teamPlayers.length})
                </h3>
                {teamPlayers.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No players yet</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {teamPlayers.map((p: CompetitionPlayer) => isAdmin ? (
                      <Card key={p.userId} padding="12px">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Link to={`/profile/${p.userId}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
                            <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={36} />
                            <div>
                              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700 }}>{p.user.displayName ?? p.user.username}</p>
                              {p.isTeamLeader && <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Leader</p>}
                            </div>
                          </Link>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <Button size="sm" variant="ghost" style={{ fontSize: '12px', padding: '4px 10px' }}
                              onClick={() => { setAssigningPlayer(p); setAssignTargetTeamId('') }}>
                              Move
                            </Button>
                            <Button size="sm" variant="danger" style={{ fontSize: '11px', padding: '4px 8px' }}
                              loading={removeFromPoolMutation.isPending}
                              onClick={() => removeFromPoolMutation.mutate(p.userId)}>
                              ×
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ) : (
                      <Link key={p.userId} to={`/profile/${p.userId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <Card padding="12px" className="card-interactive">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={36} />
                            <div style={{ flex: 1 }}>
                              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700 }}>
                                {p.user.displayName ?? p.user.username}
                              </p>
                              {p.isTeamLeader && <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Leader</p>}
                            </div>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={!!assigningPlayer}
        onClose={() => setAssigningPlayer(null)}
        title={`${assigningPlayer?.teamId ? 'Move' : 'Assign'} ${assigningPlayer?.user?.displayName ?? assigningPlayer?.user?.username ?? ''} to team`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssigningPlayer(null)}>Cancel</Button>
            <Button
              onClick={() => assignToTeamMutation.mutate({ userId: assigningPlayer.userId, teamId: assignTargetTeamId })}
              disabled={!assignTargetTeamId}
              loading={assignToTeamMutation.isPending}
            >
              {assigningPlayer?.teamId ? 'Move' : 'Assign'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {comp.teams?.map((team: Team) => (
            <button
              key={team.id}
              onClick={() => setAssignTargetTeamId(team.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
                border: assignTargetTeamId === team.id ? '2px solid var(--accent)' : '1.5px solid var(--border-light)',
                background: assignTargetTeamId === team.id ? 'var(--surface)' : 'var(--background)',
                width: '100%',
              }}
            >
              <Avatar src={team.imageUrl} name={team.name} size={36} style={{ borderRadius: '50%' }} />
              <div>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>{team.name}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {comp.players?.filter((pl: CompetitionPlayer) => pl.teamId === team.id).length ?? 0} players
                </p>
              </div>
              {assignTargetTeamId === team.id && (
                <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 700 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      </Modal>
    </Layout>
  )
}
