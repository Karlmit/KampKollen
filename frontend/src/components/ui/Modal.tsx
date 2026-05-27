import { ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

const CLOSE_MS = 220

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const [rendered, setRendered] = useState(open)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setRendered(true)
      setClosing(false)
    } else if (rendered) {
      setClosing(true)
      const t = setTimeout(() => { setRendered(false); setClosing(false) }, CLOSE_MS)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    document.body.style.overflow = rendered ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [rendered])

  if (!rendered) return null

  return createPortal(
    <div
      className={closing ? 'modal-overlay-exit' : 'modal-overlay-enter'}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'flex-end',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        className={closing ? 'modal-sheet-exit' : 'modal-sheet-enter'}
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
        }}
      >
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
              transition: 'opacity 150ms var(--ease-out)',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.6' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: '12px 20px calc(20px + var(--safe-bottom))', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
