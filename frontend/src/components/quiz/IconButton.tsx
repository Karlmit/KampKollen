import { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  /** 'md' = 40px toolbar button, 'sm' = 34px inline (option rows) */
  size?: 'md' | 'sm'
  /** 'neutral' bordered control, or 'danger' destructive */
  tone?: 'neutral' | 'danger'
}

/**
 * Square icon button with consistent sizing, hit area and state feedback.
 * Replaces the bare-emoji <button>s the quiz editors used to scatter inline,
 * which had no padding, no hover/active states and sub-40px tap targets.
 */
export function IconButton({ children, size = 'md', tone = 'neutral', style, disabled, ...props }: IconButtonProps) {
  const dim = size === 'md' ? 40 : 34
  const bordered = size === 'md'
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: dim, height: dim, flexShrink: 0,
        borderRadius: 'var(--radius-sm)',
        background: bordered ? 'var(--background)' : 'transparent',
        border: bordered ? '1px solid var(--border-light)' : '1px solid transparent',
        color: tone === 'danger' ? 'var(--accent-warm)' : 'var(--text-primary)',
        fontSize: size === 'md' ? '18px' : '16px',
        lineHeight: 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background-color 150ms var(--ease-out), border-color 150ms var(--ease-out), transform 120ms var(--ease-out)',
        ...style,
      }}
      onMouseEnter={e => {
        if (disabled) return
        e.currentTarget.style.background = tone === 'danger' ? 'var(--danger)' : 'var(--surface-raised)'
        if (tone === 'danger' && bordered) e.currentTarget.style.borderColor = 'var(--accent-warm)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = bordered ? 'var(--background)' : 'transparent'
        if (tone === 'danger' && bordered) e.currentTarget.style.borderColor = 'var(--border-light)'
      }}
      onPointerDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.94)' }}
      onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
      onPointerCancel={e => { e.currentTarget.style.transform = 'scale(1)' }}
      {...props}
    >
      {children}
    </button>
  )
}
