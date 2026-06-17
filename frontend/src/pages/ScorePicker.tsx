import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'
import { Competition } from '../types'
import { formatDate, scorableCompetitions } from '../utils'
import { useTranslation } from 'react-i18next'

export function ScorePicker() {
  const navigate = useNavigate()
  const { isAdmin, isReferee } = useAuth()
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.competitions.list(),
  })

  const competitions = (data?.competitions ?? []) as Competition[]
  const scorable = scorableCompetitions(competitions, { isAdmin, isReferee })

  return (
    <Layout title={t('scorePicker.title')}>
      {isLoading ? (
        <LoadingSpinner />
      ) : scorable.length === 0 ? (
        <Card>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
            {t('scorePicker.empty')}
          </p>
        </Card>
      ) : (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0 0 12px' }}>
            {t('scorePicker.subtitle')}
          </p>
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {scorable.map((comp: Competition) => (
              <button
                key={comp.id}
                onClick={() => navigate(`/competitions/${comp.id}/scores`)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                }}
              >
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
                      <span style={{ fontSize: '18px', color: 'var(--accent)', lineHeight: 1 }}>✏️</span>
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </>
      )}
    </Layout>
  )
}
