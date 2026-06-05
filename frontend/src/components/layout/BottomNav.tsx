import { useRef, useState, useLayoutEffect, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'

const NAV_ITEMS = [
  { to: '/',            icon: '🏠', label: 'Home' },
  { to: '/competitions', icon: '🏆', label: 'Compete' },
  { to: '/leaderboard', icon: '📊', label: 'Scores' },
  { to: '/profile',     icon: '👤', label: 'Profile' },
]
const ADMIN_ITEM = { to: '/admin', icon: '⚙️', label: 'Admin' }
const GUEST_NAV_ITEMS = [
  { to: '/competitions', icon: '🏆', label: 'Compete' },
  { to: '/leaderboard', icon: '📊', label: 'Scores' },
  { to: '/login',       icon: '👤', label: 'Sign In' },
]

function matchItem(to: string, pathname: string) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(to + '/')
}

export function BottomNav() {
  const { user, isAdmin, isScorekeeper, hasUnopenedTrophies } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()

  function handleScoreNav() {
    const cached = qc.getQueryData<{ competitions: any[] }>(['competitions'])
    const active = (cached?.competitions ?? []).filter(
      (c: any) => c.status === 'ACTIVE' || c.status === 'REGISTRATION'
    )
    if (active.length === 1) {
      navigate(`/competitions/${active[0].id}/scores`)
    } else {
      navigate('/competitions')
    }
  }

  // Show FAB for global admins/scorekeepers, or if user is a team leader/scorekeeper in any active competition.
  // Uses myPlayer from the competitions list (always fresh) so the button survives page refreshes.
  const showScoreFab = !!user && (() => {
    if (isAdmin || isScorekeeper) return true
    const cached = qc.getQueryData<{ competitions: any[] }>(['competitions'])
    return (cached?.competitions ?? []).some((c: any) =>
      (c.status === 'ACTIVE' || c.status === 'REGISTRATION') &&
      (c.myPlayer?.isTeamLeader || c.myPlayer?.isScorekeeper)
    )
  })()
  const navRef = useRef<HTMLElement>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [ind, setInd] = useState({ left: 0, width: 0, animate: false })
  const mounted = useRef(false)

  const items = !user ? GUEST_NAV_ITEMS : isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS
  const activeItem = items.find(item => matchItem(item.to, location.pathname))

  // Snap to initial position before first paint — no transition, no flash
  useLayoutEffect(() => {
    if (mounted.current) return
    const nav = navRef.current
    const el = activeItem ? itemRefs.current[activeItem.to] : null
    if (!nav || !el) return
    const nr = nav.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    setInd({ left: er.left - nr.left, width: er.width, animate: false })
    mounted.current = true
  }, [activeItem?.to])

  // Animate on subsequent tab changes — runs after paint so CSS transition fires
  useEffect(() => {
    if (!mounted.current) return
    const nav = navRef.current
    const el = activeItem ? itemRefs.current[activeItem.to] : null
    if (!nav || !el) return
    const nr = nav.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    setInd({ left: er.left - nr.left, width: er.width, animate: true })
  }, [activeItem?.to])

  return (
    <nav
      ref={navRef}
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: `calc(var(--bottom-nav-height) + var(--safe-bottom))`,
        paddingBottom: 'var(--safe-bottom)',
        background: 'var(--background)',
        borderTop: '1px solid var(--border-light)',
        display: 'flex',
        zIndex: 100,
        boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
      }}
    >
      {/* Single sliding indicator */}
      <span style={{
        position: 'absolute',
        top: 0,
        left: ind.left,
        width: ind.width,
        height: '2px',
        background: 'var(--accent)',
        borderRadius: '0 0 2px 2px',
        pointerEvents: 'none',
        transition: ind.animate
          ? 'left 260ms var(--ease-out), width 260ms var(--ease-out)'
          : 'none',
      }} />

      {(() => {
        const mid = Math.floor(items.length / 2)
        const leftItems = showScoreFab ? items.slice(0, mid) : items
        const rightItems = showScoreFab ? items.slice(mid) : []

        const renderItem = (item: typeof items[0]) => (
          <div
            key={item.to}
            ref={el => { itemRefs.current[item.to] = el }}
            style={{ flex: 1, display: 'flex' }}
          >
            <NavLink
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                padding: '8px 0', flex: 1, textDecoration: 'none',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '10px', fontFamily: 'var(--font-ui)', fontWeight: 700,
                transition: 'color 180ms var(--ease-out)',
              })}
            >
              {({ isActive }) => (
                <>
                  <span style={{ position: 'relative', display: 'inline-block' }}>
                    <span style={{
                      fontSize: '22px', lineHeight: 1, display: 'block',
                      transform: isActive ? 'scale(1.12)' : 'scale(1)',
                      transition: 'transform 220ms var(--ease-out)',
                    }}>
                      {item.icon}
                    </span>
                    {item.to === '/profile' && hasUnopenedTrophies && (
                      <span style={{
                        position: 'absolute', top: 0, right: -2,
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--accent-warm)',
                        border: '2px solid var(--background)',
                        pointerEvents: 'none',
                      }} />
                    )}
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          </div>
        )

        return (
          <>
            {leftItems.map(renderItem)}
            {showScoreFab && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button
                  onClick={handleScoreNav}
                  style={{
                    width: 54, height: 54,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px',
                    boxShadow: '0 4px 18px rgba(12,68,51,0.5)',
                    transform: 'translateY(-10px)',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: '20px', lineHeight: 1 }}>✏️</span>
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-ui)', fontWeight: 700, letterSpacing: '0.05em' }}>SCORE</span>
                </button>
              </div>
            )}
            {rightItems.map(renderItem)}
          </>
        )
      })()}
    </nav>
  )
}
