import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Badge, StatusBadge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'
import { Competition } from '../types'
import { formatDate } from '../utils'

export function Home() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.competitions.list(),
  })

  const activeCompetitions = data?.competitions?.filter(
    (c: Competition) => c.status === 'ACTIVE' || c.status === 'REGISTRATION'
  ) ?? []

  return (
    <Layout>
      {/* Hero */}
      <div style={{
        background: 'var(--text-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        marginBottom: '24px',
        color: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: '13px', opacity: 0.7, fontFamily: 'var(--font-ui)', marginBottom: '4px' }}>
            Welcome back
          </p>
          <h1 style={{ fontSize: '26px', fontFamily: 'var(--font-ui)', color: '#fff', marginBottom: '8px' }}>
            {user?.displayName ?? user?.username} 👋
          </h1>
          <p style={{ fontSize: '14px', opacity: 0.8 }}>Ready to compete?</p>
        </div>
        <img
          src="logo.png"
          alt=""
          style={{
            position: 'absolute', right: '-10px', top: '-10px',
            height: '90px', objectFit: 'contain',
            opacity: 0.15, userSelect: 'none', pointerEvents: 'none',
          }}
        />
      </div>

      {/* Active competitions */}
      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', marginBottom: '12px', color: 'var(--text-muted)' }}>
          ACTIVE COMPETITIONS
        </h2>
        {isLoading ? (
          <LoadingSpinner size={24} />
        ) : activeCompetitions.length === 0 ? (
          <Card>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '16px 0' }}>
              No active competitions yet
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeCompetitions.map((comp: Competition) => (
              <Link to={`/competitions/${comp.id}`} key={comp.id} style={{ textDecoration: 'none' }}>
                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>
                        {comp.name}
                      </p>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {comp.date ? formatDate(comp.date) + ' · ' : ''}{comp._count?.players ?? 0} players
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <StatusBadge status={comp.status} />
                      <span style={{ fontSize: '18px' }}>→</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick links */}
      <section>
        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', marginBottom: '12px', color: 'var(--text-muted)' }}>
          QUICK LINKS
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { to: '/competitions', icon: '🏆', label: 'All Competitions' },
            { to: '/leaderboard', icon: '📊', label: 'Leaderboards' },
            { to: '/profile', icon: '👤', label: 'My Profile' },
            { to: '/competitions', icon: '📋', label: 'My Teams' },
          ].map(item => (
            <Link to={item.to} key={item.label} style={{ textDecoration: 'none' }}>
              <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: '28px' }}>{item.icon}</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700 }}>{item.label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  )
}
