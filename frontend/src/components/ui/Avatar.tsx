import { CSSProperties } from 'react'

interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: number
  style?: CSSProperties
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function getColor(name?: string | null): string {
  const colors = ['#0c4433', '#d7283d', '#000b5e', '#280c61', '#00752f', '#fd9c54', '#4f002f']
  if (!name) return colors[0]
  const idx = name.charCodeAt(0) % colors.length
  return colors[idx]
}

function resolveUrl(src: string): string {
  // Strip leading slash so the URL is relative and works through a path-prefix proxy
  if (src.startsWith('/uploads/')) return src.slice(1)
  return src
}

export function Avatar({ src, name, size = 40, style }: AvatarProps) {
  const dim = size
  const resolvedSrc = src ? resolveUrl(src) : undefined
  return (
    <div
      style={{
        width: dim,
        height: dim,
        borderRadius: '50%',
        overflow: 'hidden',
        background: resolvedSrc ? 'transparent' : getColor(name),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: '2px solid var(--border-light)',
        ...style,
      }}
    >
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={name ?? 'avatar'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <span style={{
          color: '#fff',
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          fontSize: size * 0.38,
          userSelect: 'none',
        }}>
          {getInitials(name)}
        </span>
      )}
    </div>
  )
}
