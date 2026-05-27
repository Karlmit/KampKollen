import { CSSProperties, ReactNode, MouseEvent } from 'react'

interface CardProps {
  children: ReactNode
  style?: CSSProperties
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  padding?: string
  className?: string
}

export function Card({ children, style, onClick, padding = '16px', className }: CardProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius)',
        padding,
        boxShadow: 'var(--shadow)',
        cursor: onClick ? 'pointer' : undefined,
        transition: onClick ? 'transform 150ms ease, box-shadow 150ms ease' : undefined,
        ...style,
      }}
      onMouseEnter={onClick ? (e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
      } : undefined}
      onMouseLeave={onClick ? (e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'var(--shadow)'
      } : undefined}
    >
      {children}
    </div>
  )
}
