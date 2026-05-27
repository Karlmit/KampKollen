import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../api/client'
import { CompetitionLeaderboard, LeaderboardTeam } from '../types'

type View = 'teams' | 'individual'

export function CompetitionLeaderboardPage() {
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<View>('teams')
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', id],
    queryFn: () => api.leaderboards.competition(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  })

  if (isLoading) return <Layout title="Leaderboard" back={`/competitions/${id}`}><LoadingSpinner /></Layout>

  const lb: CompetitionLeaderboard = data
  if (!lb) return <Layout title="Leaderboard"><p>Not found</p></Layout>

  const rankEmoji = (rank: number) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
  const isPlacementMode = lb.competition.scoringMode === 'placement_points'

  const toggleChallenge = (ccId: string) =>
    setExpandedChallenge(prev => prev === ccId ? null : ccId)

  const renderScore = (score: number, placementPoints?: number) => {
    if (isPlacementMode) {
      return (
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>
            {placementPoints != null ? `${placementPoints} pts` : '—'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
            ({score?.toFixed(1) ?? '0'})
          </span>
        </div>
      )
    }
    return (
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>
        {score?.toFixed(1) ?? '0'}
      </span>
    )
  }

  return (
    <Layout title={lb.competition.name} back={`/competitions/${id}`}>
      {/* Scoring mode badge */}
      <div style={{ marginBottom: '16px' }}>
        <span style={{
          display: 'inline-block', padding: '4px 10px', borderRadius: '99px',
          background: 'var(--surface)', border: '1px solid var(--border-light)',
          fontSize: '12px', fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--text-muted)',
        }}>
          {isPlacementMode ? '🏅 Placement points' : '➕ Raw sum'}
        </span>
      </div>

      {/* View toggle */}
      <div style={{
        display: 'flex', background: 'var(--surface)', borderRadius: 'var(--radius)',
        padding: '4px', marginBottom: '20px', gap: '4px',
      }}>
        {(['teams', 'individual'] as View[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: 1, padding: '8px', borderRadius: '10px',
              background: view === v ? 'var(--background)' : 'transparent',
              color: view === v ? 'var(--text-primary)' : 'var(--text-muted)',
              fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px',
              boxShadow: view === v ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer', border: 'none', transition: 'all 150ms ease',
            }}
          >
            {v === 'teams' ? '🛡️ Teams' : '👤 Individual'}
          </button>
        ))}
      </div>

      {/* Teams leaderboard */}
      {view === 'teams' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {lb.teamLeaderboard.map((team: LeaderboardTeam) => (
            <Card key={team.teamId} style={{ border: team.rank === 1 ? '2px solid #ffd700' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px', minWidth: '36px', textAlign: 'center' }}>
                  {rankEmoji(team.rank)}
                </span>
                <Avatar src={team.teamImageUrl} name={team.teamName} size={44} style={{ borderRadius: 'var(--radius-sm)' }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '16px' }}>{team.teamName}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{team.playerCount} players</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '20px' }}>
                    {team.totalPoints.toFixed(0)}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>pts</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Individual leaderboard */}
      {view === 'individual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {lb.individualLeaderboard.map((p: any) => (
            <Card key={p.userId} padding="12px">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px', minWidth: '28px', textAlign: 'center' }}>
                  {rankEmoji(p.rank)}
                </span>
                <Avatar src={p.profileImageUrl} name={p.displayName ?? p.username ?? p.userId} size={36} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>
                    <Link to={`/profile/${p.userId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {p.displayName ?? p.username ?? p.userId}
                    </Link>
                  </p>
                  {p.teamName && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.teamName}</p>}
                </div>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '18px' }}>
                  {p.totalPoints.toFixed(0)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Challenge breakdown — mirrors active tab */}
      {lb.challengeLeaderboards.length > 0 && (
        <section style={{ marginTop: '28px' }}>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', marginBottom: '12px', color: 'var(--text-muted)' }}>
            BY CHALLENGE
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {lb.challengeLeaderboards.map((cl: any) => {
              const isExpanded = expandedChallenge === cl.competitionChallengeId
              const items: any[] = view === 'individual' ? (cl.players ?? []) : (cl.teams ?? [])
              const visibleItems = isExpanded ? items : items.slice(0, 3)

              return (
                <Card
                  key={cl.competitionChallengeId}
                  padding="14px"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleChallenge(cl.competitionChallengeId)}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700 }}>
                      {cl.challengeName}
                      {cl.lowerIsBetter && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                          (lower=better)
                        </span>
                      )}
                    </p>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px', flexShrink: 0 }}>
                      {isExpanded ? '▲' : `▼ ${items.length}`}
                    </span>
                  </div>

                  {/* Rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {visibleItems.map((item: any) => {
                      const isPlayer = view === 'individual'
                      return (
                        <div
                          key={isPlayer ? item.userId : item.teamId}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '13px', flexShrink: 0 }}>{rankEmoji(item.rank)}</span>
                            {isPlayer && (
                              <Avatar
                                src={item.profileImageUrl}
                                name={item.displayName ?? item.username ?? item.userId}
                                size={24}
                              />
                            )}
                            <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isPlayer ? (
                                <Link
                                  to={`/profile/${item.userId}`}
                                  onClick={e => e.stopPropagation()}
                                  style={{ color: 'inherit', textDecoration: 'none' }}
                                >
                                  {item.displayName ?? item.username ?? item.userId}
                                </Link>
                              ) : item.teamName}
                            </span>
                          </div>
                          {renderScore(item.score, item.placementPoints)}
                        </div>
                      )
                    })}

                    {!isExpanded && items.length > 3 && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>
                        +{items.length - 3} more — tap to expand
                      </p>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      )}
    </Layout>
  )
}
