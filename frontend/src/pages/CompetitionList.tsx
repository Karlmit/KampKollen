import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../api/client'
import { Competition } from '../types'
import { formatDate } from '../utils'
import { useTranslation } from 'react-i18next'

export function CompetitionList() {
  const { data, isLoading } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.competitions.list(),
  })
  const { t } = useTranslation()

  const competitions = (data?.competitions ?? []) as Competition[]

  return (
    <Layout title={t('competitionList.title')}>
      {isLoading ? (
        <LoadingSpinner />
      ) : competitions.length === 0 ? (
        <Card>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>{t('competitionList.noCompetitions')}</p>
        </Card>
      ) : (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {competitions.map((comp: Competition) => (
            <Link to={`/competitions/${comp.id}`} key={comp.id} style={{ textDecoration: 'none' }}>
              <Card className="card-interactive">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      {comp.status === 'ACTIVE' && <span className="live-dot" />}
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {comp.name}
                      </p>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {comp.date ? formatDate(comp.date) + ' · ' : ''}
                      {comp.teams?.length ?? 0} {t('common.teams')} · {comp._count?.players ?? 0} {t('common.players')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
                    <StatusBadge status={comp.status} />
                    <span style={{ fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1 }}>›</span>
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
