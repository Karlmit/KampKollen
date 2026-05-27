import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../api/client'
import { Competition } from '../types'
import { formatDate } from '../utils'

export function CompetitionList() {
  const { data, isLoading } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.competitions.list(),
  })

  const competitions = (data?.competitions ?? []) as Competition[]

  return (
    <Layout title="Competitions">
      {isLoading ? (
        <LoadingSpinner />
      ) : competitions.length === 0 ? (
        <Card>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>No competitions yet</p>
        </Card>
      ) : (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {competitions.map((comp: Competition) => (
            <Link to={`/competitions/${comp.id}`} key={comp.id} style={{ textDecoration: 'none' }}>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>
                      {comp.name}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {comp.date ? formatDate(comp.date) + ' · ' : ''}
                      {comp.teams?.length ?? 0} teams · {comp._count?.players ?? 0} players
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <StatusBadge status={comp.status} />
                    <span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>→</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  )
}
