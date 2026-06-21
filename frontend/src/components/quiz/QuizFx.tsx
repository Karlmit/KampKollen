import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from 'react'

// Respect the user's motion preference for JS-driven effects.
const prefersReduced = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

// ── Stage ───────────────────────────────────────────────────────────────────
// Choreographs the transition between two "scenes" (this question → the next,
// or a question → its correction view) like a deck of cards. The `title` (the
// question card) is the deck; everything passed as children sits below it.
//
// When `sceneKey` changes:
//   1. GATHER — every element below the title eases up and tucks into the title,
//      fading as it stacks (the hand "shuffles the cards into the deck").
//   2. SWITCH — the old title crossfades into the new one (the deck is re-dealt).
//   3. DEAL   — the new elements bounce back down out of the title into place,
//      lightly staggered so the stack riffles open.
//
// Same-scene re-renders pass straight through, so live updates inside a question
// (answer counts ticking, points revealing) are never interrupted. While
// `anticipate` is set (the quiz master's between-questions countdown is running)
// the whole stage settles back to build suspense before the shuffle.
const GATHER_MS = 275 // elements up into the deck (gather 220ms + 50ms stagger)
const DEAL_TAIL_MS = 660 // longest deal-down child (460ms + 175ms stagger) before idle

type StageSlot = { key: string; title: ReactNode; below: ReactNode }

export function Stage({ sceneKey, title, anticipate, className, style, children }: {
  sceneKey: string
  title?: ReactNode
  anticipate?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const [shown, setShown] = useState<StageSlot>({ key: sceneKey, title, below: children })
  const [leavingTitle, setLeavingTitle] = useState<ReactNode>(null)
  const [phase, setPhase] = useState<'idle' | 'gather' | 'deal'>('deal')
  const shownRef = useRef(shown)
  shownRef.current = shown
  const timers = useRef<number[]>([])
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  // First-mount entrance: deal the opening scene in, then rest at idle.
  useEffect(() => {
    if (prefersReduced()) { setPhase('idle'); return }
    const t = window.setTimeout(() => setPhase('idle'), DEAL_TAIL_MS)
    timers.current.push(t)
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Same scene — keep the displayed nodes in sync with the latest props.
    if (sceneKey === shown.key) {
      setShown({ key: sceneKey, title, below: children })
      return
    }
    // Reduced motion: swap instantly, no shuffle.
    if (prefersReduced()) {
      setShown({ key: sceneKey, title, below: children })
      setLeavingTitle(null)
      setPhase('idle')
      return
    }
    // 1. Gather the current below-elements up into the deck.
    clearTimers()
    const prevTitle = shownRef.current.title
    setPhase('gather')
    const swap = window.setTimeout(() => {
      // 2. Swap the deck (old title crossfades out, new in) and 3. deal down.
      setLeavingTitle(prevTitle)
      setShown({ key: sceneKey, title, below: children })
      setPhase('deal')
      timers.current.push(window.setTimeout(() => setLeavingTitle(null), 260))
      timers.current.push(window.setTimeout(() => setPhase('idle'), DEAL_TAIL_MS))
    }, GATHER_MS)
    timers.current.push(swap)
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey, title, children])

  const wrapperCls = [
    'qz-stage',
    anticipate && phase === 'idle' ? 'qz-stage-settling' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <div className={wrapperCls} style={style}>
      {title != null && (
        <div className="qz-deck-title">
          {leavingTitle != null && (
            <div key="leaving" className="qz-deck-title-out" aria-hidden>{leavingTitle}</div>
          )}
          <div key={shown.key} className={phase === 'deal' ? 'qz-deck-title-in' : undefined}>
            {shown.title}
          </div>
        </div>
      )}
      <div key={`${shown.key}-below`} className="qz-deck-below" data-phase={phase}>
        {shown.below}
      </div>
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
