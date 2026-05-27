import { ReactNode } from 'react'
import { NavLink, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { BottomNav } from '../../components/layout/BottomNav'

const sections = [
  { to: '/admin/competitions', icon: '🏆', label: 'Competitions' },
  { to: '/admin/challenges', icon: '⚔️', label: 'Challenges' },
  { to: '/admin/users', icon: '👥', label: 'Users' },
  { to: '/admin/settings', icon: '🔧', label: 'Settings' },
]

export function AdminLayout({ children, title }: { children: ReactNode; title: string }) {
  const { isAdmin, loading } = useAuth()
  if (!loading && !isAdmin) return <Navigate to="/" replace />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {/* Admin header */}
      <header style={{
        background: 'var(--text-primary)', color: '#fff',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <NavLink to="/" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '20px', textDecoration: 'none' }}>←</NavLink>
        <span style={{ fontSize: '20px' }}>⚙️</span>
        <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', color: '#fff' }}>{title}</h1>
      </header>

      {/* Admin nav */}
      <nav style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border-light)',
        display: 'flex', overflowX: 'auto', padding: '0 16px',
        gap: '0',
      }}>
        {sections.map(s => (
          <NavLink
            key={s.to}
            to={s.to}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 14px', textDecoration: 'none', whiteSpace: 'nowrap',
              fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700,
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            })}
          >
            <span>{s.icon}</span> {s.label}
          </NavLink>
        ))}
      </nav>

      <main style={{
        flex: 1, padding: '16px',
        maxWidth: '600px', margin: '0 auto', width: '100%',
        paddingBottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + 16px)',
      }}>
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
