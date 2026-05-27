import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BottomNav } from './BottomNav'

interface LayoutProps {
  children: ReactNode
  title?: string
  back?: string
  action?: ReactNode
  noPadding?: boolean
}

export function Layout({ children, title, back, action, noPadding }: LayoutProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--background)' }}>
      {/* Top bar */}
      {(title || back || action) && (
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
          {title && (
            <h1 style={{
              fontFamily: 'var(--font-ui)', fontSize: '18px', fontWeight: 700,
              color: 'var(--text-primary)', flex: 1,
            }}>
              {title}
            </h1>
          )}
          {action && <div style={{ marginLeft: 'auto', flexShrink: 0 }}>{action}</div>}
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
