import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { StatusBadge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../api/client'
import { formatDate, formatScore } from '../utils'

export function GlobalLeaderboard() {
  const { data: compsData, isLoading: compsLoading } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.competitions.list(),
  })

  const { data: challengeData, isLoading: challengesLoading } = useQuery({
    queryKey: ['leaderboards', 'challenges-all-time'],
    queryFn: () => api.leaderboards.challengesAllTime(),
  })

  const activeComps = compsData?.competitions?.filter((c: any) => c.status === 'ACTIVE') ?? []
  const completedComps = compsData?.competitions?.filter((c: any) => c.status === 'COMPLETED') ?? []
  const challengeRecords: any[] = challengeData?.challenges ?? []

  return (
    <Layout title="Leaderboards">
      {compsLoading ? (
        <LoadingSpinner />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {activeComps.length > 0 && (
            <section>
              <h2 style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em',
                textTransform: 'uppercase', marginBottom: '10px', color: 'var(--text-muted)',
              }}>
                Live Competitions
              </h2>
              <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeComps.map((c: any) => (
                  <Link to={`/competitions/${c.id}/leaderboard`} key={c.id} style={{ textDecoration: 'none' }}>
                    <Card className="card-interactive">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <span className="live-dot" />
                            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.name}
                            </p>
                          </div>
                          {c.date && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{formatDate(c.date)}</p>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                          <StatusBadge status={c.status} />
                          <span style={{ fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1 }}>›</span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {completedComps.length > 0 && (
            <section>
              <h2 style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em',
                textTransform: 'uppercase', marginBottom: '10px', color: 'var(--text-muted)',
              }}>
                Past Competitions
              </h2>
              <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {completedComps.map((c: any) => (
                  <Link to={`/competitions/${c.id}/leaderboard`} key={c.id} style={{ textDecoration: 'none' }}>
                    <Card className="card-interactive">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700 }}>{c.name}</p>
                          {c.date && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{formatDate(c.date)}</p>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <StatusBadge status={c.status} />
                          <span style={{ fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1 }}>›</span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {activeComps.length === 0 && completedComps.length === 0 && (
            <Card>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                No competitions available yet
              </p>
            </Card>
          )}

          {/* Challenge all-time records */}
          {!challengesLoading && challengeRecords.length > 0 && (
            <section>
              <h2 style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em',
                textTransform: 'uppercase', marginBottom: '10px', color: 'var(--text-muted)',
              }}>
                Challenge Records
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {challengeRecords.map((ch: any) => (
                  <Card key={ch.challengeId} padding="0px">
                    {/* Challenge header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px 16px', borderBottom: '1px solid var(--border-light)',
                    }}>
                      {ch.challengeLogoUrl ? (
                        <img src={ch.challengeLogoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{
                          width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-raised)', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '16px',
                        }}>🏆</div>
                      )}
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px' }}>
                        {ch.challengeName}
                      </p>
                    </div>
                    {/* Top scores */}
                    <div>
                      {ch.topScores.map((s: any, i: number) => (
                        <Link
                          to={`/profile/${s.userId}`}
                          key={s.userId}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                        >
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '9px 16px',
                            borderBottom: i < ch.topScores.length - 1 ? '1px solid var(--border-light)' : 'none',
                          }}>
                            <span style={{
                              fontFamily: 'var(--font-ui)', fontWeight: 700,
                              fontSize: '12px', color: i === 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                              width: '18px', textAlign: 'center', flexShrink: 0,
                            }}>
                              {s.rank}
                            </span>
                            <Avatar src={s.profileImageUrl} name={s.displayName ?? s.username} size={28} />
                            <p style={{ flex: 1, fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '13px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.displayName ?? s.username}
                            </p>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '14px', color: i === 0 ? 'var(--text-primary)' : 'inherit' }}>
                                {formatScore(s.score, ch.scoreType)}
                              </p>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.competitionName}</p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Layout>
  )
}
