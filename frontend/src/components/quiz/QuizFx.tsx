import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from 'react'

// Respect the user's motion preference for JS-driven effects.
const prefersReduced = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

// ── Stage ───────────────────────────────────────────────────────────────────
// Orchestrates the transition between two "scenes" (this question → the next
// one, or a question → its correction view). When `sceneKey` changes the
// outgoing scene plays a quick exit, a short beat of anticipation passes, then
// the new scene mounts and plays its own entrance (qz-question-in / qz-deal) —
// turning what used to be an instant hard cut into a purposeful hand-off. While
// `anticipate` is set (the quiz master's between-questions countdown is running)
// the current scene settles back to build suspense before the swap.
//
// The same scene re-renders pass straight through, so live updates inside a
// question (answer counts ticking, points revealing) are never interrupted.
const STAGE_EXIT_MS = 190
const STAGE_GAP_MS = 80

export function Stage({ sceneKey, anticipate, className, style, children }: {
  sceneKey: string
  anticipate?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const [shown, setShown] = useState<{ key: string; node: ReactNode }>({ key: sceneKey, node: children })
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    // Same scene — keep the displayed node in sync with the latest children.
    if (sceneKey === shown.key) {
      setShown({ key: sceneKey, node: children })
      return
    }
    // Reduced motion (or no JS animation): swap instantly, no exit beat.
    if (prefersReduced()) {
      setShown({ key: sceneKey, node: children })
      setExiting(false)
      return
    }
    // New scene: play the outgoing exit, hold the beat, then swap in the new one
    // (whose changed key remounts it so its entrance animation fires).
    setExiting(true)
    const id = setTimeout(() => {
      setShown({ key: sceneKey, node: children })
      setExiting(false)
    }, STAGE_EXIT_MS + STAGE_GAP_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey, children])

  const cls = [
    'qz-stage',
    exiting ? 'qz-scene-exit' : '',
    anticipate && !exiting ? 'qz-stage-settling' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <div key={shown.key} className={cls} style={style}>
      {shown.node}
    </div>
  )
}

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
