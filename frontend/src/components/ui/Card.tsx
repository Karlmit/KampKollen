import { CSSProperties, ReactNode, MouseEvent } from 'react'

interface CardProps {
  children: ReactNode
  style?: CSSProperties
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  padding?: string
  className?: string
}

export function Card({ children, style, onClick, padding = '16px', className }: CardProps) {
  const classes = [onClick ? 'card-interactive' : '', className].filter(Boolean).join(' ')
  return (
    <div
      className={classes || undefined}
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius)',
        padding,
        boxShadow: 'var(--shadow)',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
