import { ReactNode, CSSProperties } from 'react'

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
  return (
    <div className="tabbar" role="tablist" style={style}>
      {tabs.map(t => {
        const isActive = active === t.key
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={isActive ? 'tabbar__item is-active' : 'tabbar__item'}
            onClick={() => onChange(t.key)}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
