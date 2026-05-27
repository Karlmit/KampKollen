import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../api/client'
import { formatDate } from '../utils'

export function GlobalLeaderboard() {
  const { data: compsData, isLoading: compsLoading } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.competitions.list(),
  })

  const activeComps = compsData?.competitions?.filter((c: any) => c.status === 'ACTIVE') ?? []
  const completedComps = compsData?.competitions?.filter((c: any) => c.status === 'COMPLETED') ?? []

  return (
    <Layout title="Leaderboards">
      {compsLoading ? (
        <LoadingSpinner />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {activeComps.length > 0 && (
            <section>
              <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                Live Competitions
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeComps.map((c: any) => (
                  <Link to={`/competitions/${c.id}/leaderboard`} key={c.id} style={{ textDecoration: 'none' }}>
                    <Card>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700 }}>{c.name}</p>
                          {c.date && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{formatDate(c.date)}</p>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <StatusBadge status={c.status} />
                          <span>→</span>
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
              <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                Past Competitions
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {completedComps.map((c: any) => (
                  <Link to={`/competitions/${c.id}/leaderboard`} key={c.id} style={{ textDecoration: 'none' }}>
                    <Card>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700 }}>{c.name}</p>
                          {c.date && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{formatDate(c.date)}</p>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <StatusBadge status={c.status} />
                          <span>→</span>
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
        </div>
      )}
    </Layout>
  )
}
