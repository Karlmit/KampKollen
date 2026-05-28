import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { StatusBadge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../api/client'
import { Competition, CompetitionPlayer, CompetitionLeaderboard, LeaderboardTeam } from '../types'
import { formatDate } from '../utils'

const rankEmoji = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`

export function GuestCompetitionView({ id }: { id: string }) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null)

  const { data: compData, isLoading: compLoading } = useQuery({
    queryKey: ['competition', id],
    queryFn: () => api.competitions.get(id),
    enabled: !!id,
  })

  const { data: lbData, isLoading: lbLoading } = useQuery({
    queryKey: ['leaderboard', id],
    queryFn: () => api.leaderboards.competition(id),
    enabled: !!id,
    refetchInterval: 30_000,
  })

  if (compLoading || lbLoading) {
    return (
      <Layout back="/competitions">
        <LoadingSpinner />
      </Layout>
    )
  }

  const comp: Competition = compData?.competition
  const lb: CompetitionLeaderboard = lbData

  if (!comp) {
    return <Layout title="Competition" back="/competitions"><p>Not found</p></Layout>
  }

  // Build roster map from competition data (comp.players has teamId)
  const teamRosters: Record<string, CompetitionPlayer[]> = {}
  for (const team of (comp.teams ?? [])) {
    teamRosters[team.id] = (comp.players ?? []).filter((p: CompetitionPlayer) => p.teamId === team.id)
  }

  const isPlacementMode = lb?.competition?.scoringMode === 'placement_points'

  return (
    <Layout back="/competitions">
      {/* ── Hero ─────────────────────────────────────── */}
      <div style={{
        margin: '-16px -16px 0',
        background: 'var(--text-primary)',
        padding: '20px 20px 28px',
        color: '#fff',
      }}>
        <div style={{ marginBottom: '10px' }}>
          <StatusBadge status={comp.status} />
        </div>
        <h1 style={{
          fontFamily: 'var(--font-ui)', fontSize: '26px', fontWeight: 700,
          color: '#fff', marginBottom: '4px', lineHeight: 1.15,
        }}>
          {comp.name}
        </h1>
        {comp.date && (
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
            {formatDate(comp.date)}
          </p>
        )}
        <div style={{ display: 'flex', gap: '20px' }}>
          {[
            { val: comp.teams?.length ?? 0, label: 'teams' },
            { val: comp.players?.length ?? 0, label: 'players' },
            { val: comp.challenges?.length ?? 0, label: 'challenges' },
          ].map(s => (
            <div key={s.label}>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '20px', color: '#fff' }}>{s.val}</span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginLeft: '4px' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sign in strip ────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface)', borderRadius: '0 0 var(--radius) var(--radius)',
        padding: '12px 16px', marginBottom: '28px',
        border: '1px solid var(--border-light)', borderTop: 'none',
      }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          Want to participate?
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/login" style={{
            fontSize: '13px', fontFamily: 'var(--font-ui)', fontWeight: 700,
            color: 'var(--accent)', textDecoration: 'none',
          }}>
            Sign in
          </Link>
          <span style={{ color: 'var(--border-light)' }}>·</span>
          <Link to="/register" style={{
            fontSize: '13px', fontFamily: 'var(--font-ui)', fontWeight: 700,
            color: 'var(--accent)', textDecoration: 'none',
          }}>
            Create account
          </Link>
        </div>
      </div>

      {/* ── Standings ────────────────────────────────── */}
      {lb?.teamLeaderboard && lb.teamLeaderboard.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: '10px',
          }}>
            Standings
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lb.teamLeaderboard.map((team: LeaderboardTeam) => {
              const isExpanded = expandedTeam === team.teamId
              const roster = teamRosters[team.teamId] ?? []
              const isFirst = team.rank === 1

              return (
                <div
                  key={team.teamId}
                  style={{
                    borderRadius: 'var(--radius)',
                    border: `1.5px solid ${isFirst ? '#e8c93a' : 'var(--border-light)'}`,
                    background: isFirst ? '#fffdf0' : 'var(--background)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedTeam(isExpanded ? null : team.teamId)}
                >
                  {/* Team row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
                    <span style={{ fontSize: '22px', minWidth: '30px', textAlign: 'center' }}>
                      {rankEmoji(team.rank)}
                    </span>
                    <Avatar
                      src={team.teamImageUrl}
                      name={team.teamName}
                      size={40}
                      style={{ borderRadius: '50%', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '16px' }}>
                        {team.teamName}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {roster.length} player{roster.length !== 1 ? 's' : ''}
                        {' · '}
                        <span style={{ color: isExpanded ? 'var(--accent)' : 'var(--text-muted)' }}>
                          {isExpanded ? 'hide roster ▲' : 'see roster ▼'}
                        </span>
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '22px', lineHeight: 1, color: isFirst ? '#8a6800' : 'var(--text-primary)' }}>
                        {team.totalPoints.toFixed(0)}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>pts</p>
                    </div>
                  </div>

                  {/* Expanded roster */}
                  {isExpanded && (
                    <div style={{
                      borderTop: `1px solid ${isFirst ? '#e8c93a40' : 'var(--border-light)'}`,
                      padding: '12px 16px 16px',
                      background: isFirst ? '#fffbdb' : 'var(--surface)',
                    }}>
                      {roster.length === 0 ? (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                          No players assigned yet
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {roster.map((p: CompetitionPlayer) => {
                            const indEntry = lb.individualLeaderboard.find(e => e.userId === p.userId)
                            return (
                              <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Avatar
                                  src={p.user.profileImageUrl}
                                  name={p.user.displayName ?? p.user.username}
                                  size={30}
                                />
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: '14px', fontFamily: 'var(--font-ui)', fontWeight: 600 }}>
                                    {p.user.displayName ?? p.user.username}
                                    {p.user?.isDummy && (
                                      <span style={{
                                        fontSize: '10px', fontWeight: 400,
                                        color: 'var(--text-muted)', marginLeft: '6px',
                                        background: 'var(--border-light)',
                                        padding: '1px 5px', borderRadius: '99px',
                                      }}>
                                        guest
                                      </span>
                                    )}
                                  </p>
                                  {p.isTeamLeader && (
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Leader</p>
                                  )}
                                </div>
                                {indEntry && indEntry.totalPoints > 0 && (
                                  <span style={{ fontSize: '13px', fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--text-muted)' }}>
                                    {indEntry.totalPoints.toFixed(0)}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── No scores yet ────────────────────────────── */}
      {(!lb?.teamLeaderboard || lb.teamLeaderboard.every((t: LeaderboardTeam) => t.totalPoints === 0)) &&
        lb?.teamLeaderboard?.length > 0 && (
        <Card style={{ marginBottom: '28px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', padding: '8px 0', fontFamily: 'var(--font-ui)' }}>
            No scores recorded yet
          </p>
        </Card>
      )}

      {/* ── Challenge breakdown ───────────────────────── */}
      {lb?.challengeLeaderboards && lb.challengeLeaderboards.length > 0 && (
        <section style={{ marginBottom: '24px' }}>
          <h2 style={{
            fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: '10px',
          }}>
            By Challenge
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lb.challengeLeaderboards.map((cl: any) => {
              const isExpanded = expandedChallenge === cl.competitionChallengeId
              const items: any[] = cl.teams ?? []
              const visible = isExpanded ? items : items.slice(0, 3)

              return (
                <Card
                  key={cl.competitionChallengeId}
                  padding="14px"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setExpandedChallenge(isExpanded ? null : cl.competitionChallengeId)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: visible.length > 0 ? '10px' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      {cl.challengeLogoUrl && (
                        <img
                          src={cl.challengeLogoUrl}
                          alt=""
                          style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }}
                        />
                      )}
                      <div>
                        <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>
                          {cl.challengeName}
                        </p>
                        {cl.lowerIsBetter && (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>lower is better</p>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '8px' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  {visible.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {visible.map((team: any) => (
                        <div
                          key={team.teamId}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', minWidth: '26px', flexShrink: 0 }}>{rankEmoji(team.rank)}</span>
                            <span style={{ fontSize: '13px' }}>{team.teamName}</span>
                          </div>
                          <span style={{ fontSize: '13px', fontFamily: 'var(--font-ui)', fontWeight: 700, flexShrink: 0 }}>
                            {isPlacementMode && team.placementPoints != null
                              ? `${team.placementPoints} pts`
                              : (team.score != null ? team.score.toFixed(1) : '—')}
                          </span>
                        </div>
                      ))}
                      {!isExpanded && items.length > 3 && (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2px' }}>
                          +{items.length - 3} more
                        </p>
                      )}
                    </div>
                  )}

                  {visible.length === 0 && (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No scores yet</p>
                  )}
                </Card>
              )
            })}
          </div>
        </section>
      )}
    </Layout>
  )
}
