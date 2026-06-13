import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'

// Respect the user's motion preference for JS-driven effects.
const prefersReduced = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

// ── CountUp ───────────────────────────────────────────────────────────────────
// Rolls a number up to its target with an ease-out curve. On first mount it
// counts from 0; afterwards it animates from the previous value, so live updates
// (e.g. percentages climbing during a reveal) feel like an odometer ticking over.
export function CountUp({
  value,
  duration = 850,
  suffix = '',
  className,
  style,
}: {
  value: number
  duration?: number
  suffix?: string
  className?: string
  style?: CSSProperties
}) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(0)
  const seen = useRef(false)
  const raf = useRef<number>()

  useEffect(() => {
    const from = seen.current ? fromRef.current : 0
    seen.current = true
    if (prefersReduced() || from === value) {
      setDisplay(value)
      fromRef.current = value
      return
    }
    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3) // ease-out cubic
      setDisplay(Math.round(from + (value - from) * eased))
      if (p < 1) {
        raf.current = requestAnimationFrame(step)
      } else {
        fromRef.current = value
      }
    }
    raf.current = requestAnimationFrame(step)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [value, duration])

  return (
    <span className={className} style={style}>
      {display}
      {suffix}
    </span>
  )
}

// ── Confetti ──────────────────────────────────────────────────────────────────
// A self-contained burst of falling shards (plus the occasional emoji/coin).
// Mounts once at a payoff moment (answer reveal, podium) and plays a single time.
// Position the nearest ancestor `relative`; the layer fills it.
const CONFETTI_COLORS = ['#ffd700', '#d7283d', '#00752f', '#fd9c54', '#280c61', '#3b82f6']

export function Confetti({
  count = 42,
  emojis,
  emojiChance = 0.26,
  colors = CONFETTI_COLORS,
  durationBase = 1500,
  style,
}: {
  count?: number
  emojis?: string[]
  emojiChance?: number
  colors?: string[]
  durationBase?: number
  style?: CSSProperties
}) {
  const pieces = useMemo(() => {
    if (prefersReduced()) return []
    return Array.from({ length: count }, (_, i) => {
      const useEmoji = emojis && emojis.length > 0 && Math.random() < emojiChance
      return {
        i,
        left: Math.random() * 100,
        dx: (Math.random() - 0.5) * 170,
        dy: 260 + Math.random() * 340,
        rot: (Math.random() - 0.5) * 1080,
        delay: Math.random() * 380,
        dur: durationBase + Math.random() * 900,
        color: colors[i % colors.length],
        size: 7 + Math.random() * 7,
        emoji: useEmoji ? emojis![Math.floor(Math.random() * emojis!.length)] : null,
      }
    })
  }, [count, durationBase, emojis, emojiChance, colors])

  if (pieces.length === 0) return null

  return (
    <div className="qz-confetti-layer" style={style} aria-hidden>
      {pieces.map(p => (
        <span
          key={p.i}
          className="qz-confetti-piece"
          style={
            {
              left: `${p.left}%`,
              background: p.emoji ? 'transparent' : p.color,
              width: p.emoji ? 'auto' : `${p.size}px`,
              height: p.emoji ? 'auto' : `${p.size * 1.4}px`,
              fontSize: p.emoji ? `${14 + p.size}px` : undefined,
              lineHeight: 1,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rot}deg`,
              '--dur': `${p.dur}ms`,
              '--delay': `${p.delay}ms`,
            } as CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}
    </div>
  )
}
