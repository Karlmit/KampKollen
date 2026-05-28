import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  children,
  fullWidth,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'var(--font-ui)',
    fontWeight: 700,
    borderRadius: 'var(--radius)',
    border: '1px solid transparent',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    transition: 'opacity 150ms var(--ease-out), transform 120ms var(--ease-out)',
    whiteSpace: 'nowrap',
    width: fullWidth ? '100%' : undefined,
    flexShrink: 0,
  }

  const sizes = {
    sm: { padding: '6px 12px', fontSize: '13px' },
    md: { padding: '10px 20px', fontSize: '15px' },
    lg: { padding: '14px 28px', fontSize: '17px' },
  }

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--text-primary)',
      color: '#ffffff',
      borderColor: 'var(--text-primary)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-primary)',
      borderColor: 'var(--border)',
    },
    danger: {
      background: 'var(--accent-warm)',
      color: '#ffffff',
      borderColor: 'var(--accent-warm)',
    },
    success: {
      background: 'var(--accent-green)',
      color: '#ffffff',
      borderColor: 'var(--accent-green)',
    },
  }

  return (
    <button
      disabled={disabled || loading}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
      onMouseEnter={e => { if (!disabled && !loading) e.currentTarget.style.opacity = '0.85' }}
      onMouseLeave={e => { if (!disabled && !loading) e.currentTarget.style.opacity = '1' }}
      onPointerDown={e => { if (!disabled && !loading) e.currentTarget.style.transform = 'scale(0.97)' }}
      onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
      onPointerCancel={e => { e.currentTarget.style.transform = 'scale(1)' }}
      {...props}
    >
      {loading ? (
        <span className="loading-dots">
          <span /><span /><span />
        </span>
      ) : children}
    </button>
  )
}
