import { NavLink, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface NavItem {
  to: string
  icon: string
  label: string
  adminOnly?: boolean
}

function NavItem({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
        padding: '8px 0', flex: 1, textDecoration: 'none',
        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
        fontSize: '10px', fontFamily: 'var(--font-ui)', fontWeight: 700,
        transition: 'color 150ms ease',
        position: 'relative',
      })}
    >
      {({ isActive }) => (
        <>
          <span style={{
            position: 'absolute', top: 0, left: '25%', right: '25%',
            height: '2px', background: 'var(--accent)', borderRadius: '0 0 2px 2px',
            opacity: isActive ? 1 : 0,
            transform: isActive ? 'scaleX(1)' : 'scaleX(0.4)',
            transition: 'opacity 200ms var(--ease-out), transform 200ms var(--ease-out)',
          }} />
          <span style={{
            fontSize: '22px', lineHeight: 1,
            transform: isActive ? 'scale(1.12)' : 'scale(1)',
            transition: 'transform 200ms var(--ease-out)',
            display: 'block',
          }}>
            {icon}
          </span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

export function BottomNav() {
  const { isAdmin } = useAuth()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: `calc(var(--bottom-nav-height) + var(--safe-bottom))`,
      paddingBottom: 'var(--safe-bottom)',
      background: 'var(--background)',
      borderTop: '1px solid var(--border-light)',
      display: 'flex',
      zIndex: 100,
      boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
    }}>
      <NavItem to="/" icon="🏠" label="Home" />
      <NavItem to="/competitions" icon="🏆" label="Compete" />
      <NavItem to="/leaderboard" icon="📊" label="Scores" />
      <NavItem to="/profile" icon="👤" label="Profile" />
      {isAdmin && <NavItem to="/admin" icon="⚙️" label="Admin" />}
    </nav>
  )
}
