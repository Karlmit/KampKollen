import { ReactNode, useEffect } from 'react'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'flex-end',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--background)',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          width: '100%',
          maxWidth: '600px',
          margin: '0 auto',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 200ms ease',
        }}
      >
        <style>{`@keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 0',
        }}>
          <h2 style={{ fontSize: '18px', fontFamily: 'var(--font-ui)' }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              fontSize: '22px', color: 'var(--text-muted)', cursor: 'pointer',
              lineHeight: 1, padding: '4px', background: 'none', border: 'none',
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: '12px 20px 20px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
