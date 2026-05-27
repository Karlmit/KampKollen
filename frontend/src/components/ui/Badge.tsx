import { ReactNode, CSSProperties } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'admin' | 'gold' | 'silver' | 'bronze'
  style?: CSSProperties
}

const variants: Record<string, CSSProperties> = {
  default: { background: 'var(--surface-raised)', color: 'var(--text-muted)' },
  success: { background: 'var(--success)', color: 'var(--success-text)' },
  warning: { background: 'var(--warning)', color: 'var(--warning-text)' },
  danger: { background: 'var(--danger)', color: 'var(--danger-text)' },
  info: { background: '#e1f5f5', color: 'var(--accent-blue)' },
  admin: { background: 'var(--accent-purple)', color: '#ffffff' },
  gold: { background: '#ffd700', color: '#5a4000' },
  silver: { background: '#c0c0c0', color: '#3a3a3a' },
  bronze: { background: '#cd7f32', color: '#ffffff' },
}

export function Badge({ children, variant = 'default', style }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 'var(--radius-full)',
        fontSize: '12px',
        fontFamily: 'var(--font-ui)',
        fontWeight: 700,
        lineHeight: 1.4,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </span>
  )
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    ADMIN: { label: 'Admin', variant: 'admin' },
    SCOREKEEPER: { label: 'Scorekeeper', variant: 'info' },
    PLAYER: { label: 'Player', variant: 'default' },
  }
  const { label, variant } = map[role] ?? { label: role, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    DRAFT: { label: 'Draft', variant: 'default' },
    ACTIVE: { label: 'Active', variant: 'success' },
    REGISTRATION: { label: 'Registration', variant: 'info' },
    COMPLETED: { label: 'Completed', variant: 'warning' },
    ARCHIVED: { label: 'Archived', variant: 'default' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}
