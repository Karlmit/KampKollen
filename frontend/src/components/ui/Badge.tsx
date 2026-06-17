import { ReactNode, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const map: Record<string, { key: string; variant: BadgeProps['variant'] }> = {
    ADMIN: { key: 'badges.admin', variant: 'admin' },
    PLAYER: { key: 'badges.player', variant: 'default' },
  }
  const entry = map[role]
  const label = entry ? t(entry.key) : role
  const variant = entry?.variant ?? 'default'
  return <Badge variant={variant}>{label}</Badge>
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const map: Record<string, { key: string; variant: BadgeProps['variant'] }> = {
    DRAFT: { key: 'badges.draft', variant: 'default' },
    ACTIVE: { key: 'badges.active', variant: 'success' },
    REGISTRATION: { key: 'badges.registration', variant: 'info' },
    COMPLETED: { key: 'badges.completed', variant: 'warning' },
    ARCHIVED: { key: 'badges.archived', variant: 'default' },
    TEMPLATE: { key: 'badges.template', variant: 'default' },
  }
  const entry = map[status]
  const label = entry ? t(entry.key) : status
  const variant = entry?.variant ?? 'default'
  return <Badge variant={variant}>{label}</Badge>
}
