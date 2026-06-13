import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'
import { Competition } from '../types'
import { formatDate } from '../utils'
import { useTranslation } from 'react-i18next'

export function Home() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.competitions.list(),
  })

  const allComps: Competition[] = data?.competitions ?? []
  const activeCompetitions = allComps.filter(
    (c: Competition) => c.status === 'ACTIVE' || c.status === 'REGISTRATION'
  )
  const primaryComp = activeCompetitions[0]

  return (
    <Layout>
      {/* Hero */}
      <div style={{
        background: 'var(--text-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px 24px 24px',
        marginBottom: '24px',
        color: '#ffffff',
        overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ height: '80px' }} />
        ) : primaryComp ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
              {primaryComp.status === 'ACTIVE' ? (
                <>
                  <span className="live-dot" />
                  <span style={{
                    fontSize: '11px', fontFamily: 'var(--font-ui)',
                    fontWeight: 700, letterSpacing: '0.1em', opacity: 0.9,
                  }}>{t('home.liveNow')}</span>
                </>
              ) : (
                <span style={{
                  fontSize: '11px', fontFamily: 'var(--font-ui)',
                  fontWeight: 700, letterSpacing: '0.1em', opacity: 0.6,
                }}>{t('home.registrationOpen')}</span>
              )}
            </div>
            <h1 style={{
              fontSize: '26px', fontFamily: 'var(--font-ui)',
              color: '#fff', marginBottom: '8px', lineHeight: 1.15,
            }}>
              {primaryComp.name}
            </h1>
            <p style={{ fontSize: '14px', opacity: 0.65 }}>
              {(primaryComp as any).teams?.length ?? 0} {t('common.teams')} · {primaryComp._count?.players ?? 0} {t('common.players')}
            </p>
          </>
        ) : (
          <>
            <p style={{
              fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: 700,
              letterSpacing: '0.1em', opacity: 0.55, marginBottom: '10px',
            }}>{t('home.welcomeBack')}</p>
            <h1 style={{
              fontSize: '28px', fontFamily: 'var(--font-ui)',
              color: '#fff', marginBottom: '8px', lineHeight: 1.15,
            }}>
              {user?.displayName ?? user?.username}
            </h1>
            <p style={{ fontSize: '14px', opacity: 0.65 }}>{t('home.noActiveCompetitions')}</p>
          </>
        )}
      </div>

      {/* Active competitions */}
      {isLoading ? (
        <LoadingSpinner size={24} />
      ) : activeCompetitions.length > 0 ? (
        <section style={{ marginBottom: '24px' }}>
          <h2 style={{
            fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: '10px', color: 'var(--text-muted)',
          }}>
            {t('home.activeCompetitions')}
          </h2>
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeCompetitions.map((comp: Competition) => (
              <Link to={`/competitions/${comp.id}`} key={comp.id} style={{ textDecoration: 'none' }}>
                <Card className="card-interactive">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        {comp.status === 'ACTIVE' && <span className="live-dot" />}
                        <p style={{
                          fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '16px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {comp.name}
                        </p>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {comp.date ? formatDate(comp.date) + ' · ' : ''}{comp._count?.players ?? 0} {t('common.players')}
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
        </section>
      ) : (
        <Link to="/competitions" style={{ textDecoration: 'none' }}>
          <Card className="card-interactive" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
              {t('home.browseCompetitions')}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {t('home.viewAllEvents')}
            </p>
          </Card>
        </Link>
      )}
    </Layout>
  )
}
