import { useRef, useState, useLayoutEffect, ReactNode, CSSProperties } from 'react'

export interface TabItem {
  key: string
  label: ReactNode
}

interface TabBarProps {
  tabs: TabItem[]
  active: string
  onChange: (key: string) => void
  style?: CSSProperties
}

export function TabBar({ tabs, active, onChange, style }: TabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [pos, setPos] = useState<{ left: number; width: number; animate: boolean }>({
    left: 0, width: 0, animate: false,
  })
  const mounted = useRef(false)

  useLayoutEffect(() => {
    const container = containerRef.current
    const el = tabRefs.current[active]
    if (!container || !el) return
    const cr = container.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    setPos({
      left: er.left - cr.left + container.scrollLeft,
      width: er.width,
      animate: mounted.current,
    })
    mounted.current = true
  }, [active])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        borderBottom: '1px solid var(--border-light)',
        overflowX: 'auto',
        ...style,
      }}
    >
      {tabs.map(t => (
        <button
          key={t.key}
          ref={el => { tabRefs.current[t.key] = el }}
          onClick={() => onChange(t.key)}
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            fontFamily: 'var(--font-ui)',
            fontWeight: 700,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            color: active === t.key ? 'var(--accent)' : 'var(--text-muted)',
            transition: 'color 180ms var(--ease-out)',
            whiteSpace: 'nowrap',
          }}
        >
          {t.label}
        </button>
      ))}
      <span
        style={{
          position: 'absolute',
          bottom: 0,
          left: pos.left,
          width: pos.width,
          height: '2px',
          background: 'var(--accent)',
          borderRadius: '2px 2px 0 0',
          pointerEvents: 'none',
          transition: pos.animate
            ? 'left 220ms var(--ease-out), width 220ms var(--ease-out)'
            : 'none',
        }}
      />
    </div>
  )
}
