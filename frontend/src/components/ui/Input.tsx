import { InputHTMLAttributes, forwardRef, CSSProperties } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  containerStyle?: CSSProperties
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, containerStyle, style, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...containerStyle }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          style={{
            background: '#ffffff',
            border: `1px solid ${error ? 'var(--accent-warm)' : 'var(--border-light)'}`,
            borderRadius: 'var(--radius)',
            padding: '10px 12px',
            color: 'var(--text-primary)',
            fontSize: '16px',
            outline: 'none',
            width: '100%',
            transition: 'border-color 150ms ease',
            ...style,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
          onBlur={e => { e.currentTarget.style.borderColor = error ? 'var(--accent-warm)' : 'var(--border-light)' }}
          {...props}
        />
        {error && (
          <span style={{ fontSize: '12px', color: 'var(--accent-warm)', fontFamily: 'var(--font-ui)' }}>
            {error}
          </span>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
