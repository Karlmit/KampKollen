import { useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Avatar'
import { Modal } from '../components/ui/Modal'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { formatDate } from '../utils'
import { TabBar } from '../components/ui/TabBar'
import { api } from '../api/client'
import { Competition, CompetitionPlayer, Team, LeaderboardTeam, CompetitionLeaderboard } from '../types'
import { GuestCompetitionView } from './GuestCompetitionView'
import { CompetitionLeaderboardContent } from '../components/CompetitionLeaderboardContent'
import { useTranslation } from 'react-i18next'

type Tab = 'leaderboard' | 'teams' | 'challenges' | 'pool'

export function CompetitionDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, isAdmin } = useAuth()
  const qc = useQueryClient()
  const { t } = useTranslation()
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

  const removeFromPoolMutation = useMutation({
    mutationFn: (userId: string) => api.competitions.removePlayer(id!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competition', id] }),
  })

  // Individual competitions require an explicit join (team competitions auto-enroll group members)
  const joinMutation = useMutation({
    mutationFn: () => api.competitions.join(id!),
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

  if (isLoading) return <Layout title=""><LoadingSpinner /></Layout>
  const comp: Competition = data?.competition
  if (!comp) return <Layout title=""><p>{t('competition.notFound')}</p></Layout>

  // Guests get a purpose-built read-only spectator view
  if (!user) return <GuestCompetitionView id={id!} />

  const myPlayer = comp.players?.find((p: CompetitionPlayer) => p.userId === user?.id)
  const isJoined = !!myPlayer
  const isTeamComp = comp.isTeamCompetition !== false
  const myTeam = comp.teams?.find((t: Team) => t.id === myPlayer?.teamId)
  const playerPool = comp.players?.filter((p: CompetitionPlayer) => !p.teamId) ?? []

  const lbData: CompetitionLeaderboard | undefined = (lbDataRaw as any)

  // The team-competition player pool (unassigned players) is only relevant to the
  // people who manage assignments. Non-team competitions show the full roster to everyone.
  const showPool = !isTeamComp || isAdmin || !!myPlayer?.isTeamLeader

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'leaderboard', label: t('competition.leaderboard') },
    ...(isTeamComp ? [{ key: 'teams' as Tab, label: t('competition.teams'), count: comp.teams?.length }] : []),
    { key: 'challenges', label: t('competition.challenges'), count: comp.challenges?.length },
    ...(showPool ? [{ key: 'pool' as Tab, label: isTeamComp ? t('competition.playerPool') : t('competition.players'), count: comp.players?.length }] : []),
  ]

  // Guard against landing on a hidden tab via a stale ?tab=pool URL
  const activeTab: Tab = (tab === 'pool' && !showPool) ? 'leaderboard' : tab

  return (
    <Layout
      title={comp.name}
      back="/competitions"
    >
      {/* Date */}
      {comp.date && (
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{formatDate(comp.date)}</span>
        </div>
      )}

      {/* Join CTA — individual competitions only (team competitions auto-enroll) */}
      {!isTeamComp && !isJoined && ['REGISTRATION', 'ACTIVE'].includes(comp.status) && (
        <button
          onClick={() => joinMutation.mutate()}
          disabled={joinMutation.isPending}
          style={{
            width: '100%', marginBottom: '16px', padding: '18px 24px',
            borderRadius: 'var(--radius-lg)', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
            color: '#fff', fontFamily: 'var(--font-ui)', fontWeight: 800,
            fontSize: '18px', letterSpacing: '0.02em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            boxShadow: '0 4px 20px rgba(249,115,22,0.45)',
            animation: 'joinPulse 2s ease-in-out infinite',
            opacity: joinMutation.isPending ? 0.7 : 1,
            transition: 'opacity 150ms',
          }}
        >
          {joinMutation.isPending ? (
            <span style={{ fontSize: '16px' }}>{t('competition.joining')}</span>
          ) : (
            <>
              <span style={{ fontSize: '22px', lineHeight: 1 }}>🏁</span>
              {t('competition.joinCompetition')}
              <span style={{ fontSize: '20px', lineHeight: 1 }}>→</span>
            </>
          )}
        </button>
      )}

      {/* Waiting for team notice — only for team competitions */}
      {isTeamComp && isJoined && !myTeam && (
        <Card style={{ marginBottom: '16px', background: 'var(--surface-raised)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px', flexShrink: 0 }}>⏳</span>
            <div>
              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>{t('competition.inPlayerPool')}</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {t('competition.teamLeaderAssign')}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
                  <p style={{ fontSize: '12px', opacity: 0.7 }}>{t('competition.yourTeam')}</p>
                  {comp.status === 'ACTIVE' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span className="live-dot" />
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.08em', color: '#ff6b6b' }}>{t('leaderboard.live')}</span>
                    </span>
                  )}
                </div>
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
        active={activeTab}
        onChange={key => setTab(key as Tab)}
        style={{ marginBottom: '16px' }}
      />

      {/* Leaderboard tab */}
      {activeTab === 'leaderboard' && (
        lbData
          ? <CompetitionLeaderboardContent lb={lbData} id={id!} userId={user?.id} />
          : <LoadingSpinner />
      )}


      {activeTab === 'teams' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {comp.teams?.map((team: Team) => {
            const isMine = !!myPlayer?.teamId && team.id === myPlayer.teamId
            return (
              <Link to={`/competitions/${id}/team/${team.id}`} key={team.id} style={{ textDecoration: 'none' }}>
                <Card style={isMine ? { background: 'var(--text-primary)', borderColor: 'var(--text-primary)', color: '#fff' } : undefined}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Avatar
                      src={team.imageUrl}
                      name={team.name}
                      size={44}
                      style={{ borderRadius: '50%' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px' }}>{team.name}</p>
                        {isMine && (
                          <span style={{
                            fontSize: '9px', fontFamily: 'var(--font-ui)', fontWeight: 800,
                            letterSpacing: '0.08em', padding: '2px 8px', borderRadius: '99px',
                            background: 'rgba(255,255,255,0.18)', color: '#fff', flexShrink: 0,
                          }}>
                            {t('competition.yourTeam')}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '13px', color: isMine ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                        {team.players?.length ?? 0} {t('common.players')}
                        {team.leader ? ` · ${t('competition.leaderPrefix', { name: team.leader.displayName ?? team.leader.username })}` : ''}
                      </p>
                    </div>
                    <span style={{ fontSize: '18px', color: isMine ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', lineHeight: 1 }}>›</span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {activeTab === 'challenges' && (
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
                  {cc.challenge.isQuiz && <span style={{ fontSize: '14px', marginRight: 6 }}>🎯</span>}
                  {cc.challenge.name}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {cc.challenge.isQuiz
                    ? `Quiz${cc.quizSession ? ` · ${cc.quizSession.status}` : ` · ${t('competition.notStarted')}`}`
                    : t(`scoreTypes.${cc.challenge.scoreType as string}` as any)}
                </p>
                {cc.challenge.description && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
                    {cc.challenge.description}
                  </p>
                )}
                {cc.challenge.isQuiz && (
                  <Link to={`/competitions/${id}/quiz/${cc.id}`} style={{ textDecoration: 'none', display: 'inline-block', marginTop: '10px' }}>
                    <Button size="sm" variant={cc.quizSession?.status === 'ACTIVE' || cc.quizSession?.status === 'CORRECTING' ? 'primary' : 'ghost'} style={{ fontSize: '13px' }}>
                      {cc.quizSession?.status === 'LOBBY' ? t('competition.joinLobby') :
                       cc.quizSession?.status === 'ACTIVE' ? t('competition.quizLive') :
                       cc.quizSession?.status === 'CORRECTING' ? t('competition.correction') :
                       cc.quizSession?.status === 'COMPLETED' ? t('competition.viewResults') :
                       t('competition.openQuiz')}
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'pool' && (
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
                            {[p.isTeamLeader && t('competition.leaderboard'), p.isScorekeeper && t('badges.scorekeeper')].filter(Boolean).join(' · ')}
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
              {t('competition.unassigned')} ({playerPool.length})
            </h3>
            {playerPool.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('competition.everyoneAssigned')}</p>
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
                            {t('competition.assign')}
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
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('competition.noPlayers')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {teamPlayers.map((p: CompetitionPlayer) => isAdmin ? (
                      <Card key={p.userId} padding="12px">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Link to={`/profile/${p.userId}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
                            <Avatar src={p.user.profileImageUrl} name={p.user.displayName ?? p.user.username} size={36} />
                            <div>
                              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700 }}>{p.user.displayName ?? p.user.username}</p>
                              {p.isTeamLeader && <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('badges.leader')}</p>}
                            </div>
                          </Link>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <Button size="sm" variant="ghost" style={{ fontSize: '12px', padding: '4px 10px' }}
                              onClick={() => { setAssigningPlayer(p); setAssignTargetTeamId('') }}>
                              {t('competition.move')}
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
                              {p.isTeamLeader && <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('badges.leader')}</p>}
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
        title={`${assigningPlayer?.teamId ? t('competition.move') : t('competition.assign')} ${assigningPlayer?.user?.displayName ?? assigningPlayer?.user?.username ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssigningPlayer(null)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => assignToTeamMutation.mutate({ userId: assigningPlayer.userId, teamId: assignTargetTeamId })}
              disabled={!assignTargetTeamId}
              loading={assignToTeamMutation.isPending}
            >
              {assigningPlayer?.teamId ? t('competition.move') : t('competition.assign')}
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
                  {comp.players?.filter((pl: CompetitionPlayer) => pl.teamId === team.id).length ?? 0} {t('common.players')}
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
