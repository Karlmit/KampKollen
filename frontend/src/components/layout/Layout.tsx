import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomNav } from './BottomNav'
import { Avatar } from '../ui/Avatar'
import { useAuth } from '../../contexts/AuthContext'

interface LayoutProps {
  children: ReactNode
  title?: string
  back?: string
  action?: ReactNode
  noPadding?: boolean
}

export function Layout({ children, title, back, action, noPadding }: LayoutProps) {
  const { user, hasUnopenedTrophies } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  // Persistent "My Profile" entry point in the upper right (hidden on the profile page itself)
  const showProfile = !!user && location.pathname !== '/profile'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--background)' }}>
      {/* Top bar */}
      {(title || back || action || showProfile) && (
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'var(--background)',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px',
          minHeight: '56px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          {back && (
            <Link
              to={back}
              style={{
                color: 'var(--text-muted)', fontSize: '22px', lineHeight: 1,
                textDecoration: 'none', flexShrink: 0,
              }}
            >
              ←
            </Link>
          )}
          {title ? (
            <h1 style={{
              fontFamily: 'var(--font-ui)', fontSize: '18px', fontWeight: 700,
              color: 'var(--text-primary)', flex: 1,
            }}>
              {title}
            </h1>
          ) : (
            <div style={{ flex: 1 }} />
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {action}
            {showProfile && (
              <Link
                to="/profile"
                aria-label={t('profile.myProfile')}
                title={t('profile.myProfile')}
                style={{ position: 'relative', display: 'flex', borderRadius: '50%', textDecoration: 'none', flexShrink: 0 }}
              >
                <Avatar src={user!.profileImageUrl} name={user!.displayName ?? user!.username} size={34} />
                {hasUnopenedTrophies && (
                  <span style={{
                    position: 'absolute', top: -1, right: -1,
                    width: 10, height: 10, borderRadius: '50%',
                    background: 'var(--accent-warm)',
                    border: '2px solid var(--background)',
                    pointerEvents: 'none',
                  }} />
                )}
              </Link>
            )}
          </div>
        </header>
      )}

      {/* Main content */}
      <main
        className="page-enter"
        style={{
          flex: 1,
          padding: noPadding ? 0 : '16px',
          paddingBottom: noPadding ? 'calc(var(--bottom-nav-height) + var(--safe-bottom))' : 'calc(var(--bottom-nav-height) + var(--safe-bottom) + 16px)',
          maxWidth: '600px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
