import { CSSProperties, ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

// Respect the user's motion preference for JS-driven effects.
const prefersReduced = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

// ── Stage (the deck) ──────────────────────────────────────────────────────────
// One persistent card sits at the top of the participant view and is BOTH the
// question card and, between questions, the warm "next question" countdown. It
// never pops in or out — it morphs in place:
//
//   • countdown begins → the deck flips to the warm countdown face (with an
//     entrance pop), then every card below shuffles UP into it and hides;
//   • while counting, the deck holds the ticking number (the cards are "in the
//     deck");
//   • countdown ends → the deck's background melts from warm back to the question
//     surface and its face crossfades to the next question (slow + deliberate);
//   • then the cards fan back DOWN out of the deck into place.
//
// Without a countdown (e.g. stepping through corrections) it still gathers the
// old cards up, crossfades the question, and fans the new ones down. The deck
// body's height is animated in JS so the warm-ring height and the question-text
// height morph into one another instead of jumping.
const ENTER_DELAY_MS = 160  // let the red deck land before the cards rush in
const GATHER_MS = 460       // cards shuffle up into the deck (slow + deliberate)
const FACE_FADE_MS = 380    // deck face crossfade / leaving fade-out
const REVEAL_MS = 760       // warm → surface morph before the cards fan out
const DEAL_TAIL_MS = 780    // longest fan-down child before settling to idle

type DeckSlot = { key: string; title: ReactNode; below: ReactNode }
type BelowPhase = 'idle' | 'gather' | 'hidden' | 'deal'

export function Stage({ sceneKey, title, countdown, counting = false, className, style, children }: {
  sceneKey: string
  title?: ReactNode
  countdown?: ReactNode
  counting?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const [shown, setShown] = useState<DeckSlot>({ key: sceneKey, title, below: children })
  const [mode, setMode] = useState<'title' | 'counting'>(counting ? 'counting' : 'title')
  const [leaving, setLeaving] = useState<ReactNode>(null)
  const [belowPhase, setBelowPhase] = useState<BelowPhase>(counting ? 'hidden' : 'deal')

  const shownRef = useRef(shown); shownRef.current = shown
  const lastCountdown = useRef<ReactNode>(countdown)
  if (countdown != null) lastCountdown.current = countdown
  // True while a countdown is in flight — held until the NEXT scene actually
  // arrives (sceneKey changes), so a countdown that hits 0 a tick before the
  // server advances never flashes the old question.
  const countingActive = useRef(counting)
  const prevKey = useRef(sceneKey)
  const timers = useRef<number[]>([])
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  const after = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))

  // Animate the deck body height whenever the face that defines it changes, so
  // the countdown ring and the question text morph in size rather than jump.
  const bodyRef = useRef<HTMLDivElement>(null)
  const prevH = useRef<number | null>(null)
  const heightTimer = useRef<number>()
  const activeKey = `${mode}:${shown.key}`
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el || prefersReduced()) return
    if (heightTimer.current) clearTimeout(heightTimer.current)
    el.style.height = 'auto'
    const next = el.offsetHeight
    const prev = prevH.current
    prevH.current = next
    if (prev == null || prev === next) return
    el.style.height = `${prev}px`
    void el.offsetHeight // reflow so the change transitions
    el.style.height = `${next}px`
    // Release back to auto once settled so late content (e.g. images) can grow.
    heightTimer.current = window.setTimeout(() => { if (bodyRef.current) bodyRef.current.style.height = 'auto' }, REVEAL_MS)
  }, [activeKey])

  // First-mount entrance: fan the opening scene in, then rest.
  useEffect(() => {
    if (counting) return // mounted mid-countdown: keep the below hidden until reveal
    if (prefersReduced()) { setBelowPhase('idle'); return }
    after(DEAL_TAIL_MS, () => setBelowPhase('idle'))
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const wasKey = prevKey.current
    prevKey.current = sceneKey
    const keyChanged = sceneKey !== wasKey

    if (prefersReduced()) {
      setShown({ key: sceneKey, title, below: children })
      setMode(counting ? 'counting' : 'title')
      setLeaving(null)
      setBelowPhase(counting ? 'hidden' : 'idle')
      countingActive.current = counting
      return
    }

    // Reveal: the next scene has arrived after a countdown. Melt warm → surface,
    // crossfade the deck to the next question, then fan the cards back out.
    if (countingActive.current && keyChanged) {
      countingActive.current = false
      clearTimers()
      setLeaving(lastCountdown.current)
      setShown({ key: sceneKey, title, below: children })
      setMode('title')
      setBelowPhase('hidden')
      after(FACE_FADE_MS, () => setLeaving(null))
      after(REVEAL_MS, () => setBelowPhase('deal'))
      after(REVEAL_MS + DEAL_TAIL_MS, () => setBelowPhase('idle'))
      return
    }

    // Countdown begins: the deck lands as the warm countdown, then cards rush up.
    if (counting && !countingActive.current) {
      countingActive.current = true
      clearTimers()
      setLeaving(shownRef.current.title) // old question crossfades out behind the count
      setMode('counting')
      after(FACE_FADE_MS, () => setLeaving(null))
      after(ENTER_DELAY_MS, () => setBelowPhase('gather'))
      after(ENTER_DELAY_MS + GATHER_MS, () => setBelowPhase('hidden'))
      return
    }

    // Mid-countdown: hold the warm face (its number ticks via lastCountdown) until
    // the scene actually changes.
    if (countingActive.current) return

    // Transition without a countdown (e.g. correction step): gather → crossfade → fan.
    if (keyChanged) {
      clearTimers()
      setBelowPhase('gather')
      after(GATHER_MS, () => {
        setLeaving(shownRef.current.title)
        setShown({ key: sceneKey, title, below: children })
        setBelowPhase('deal')
        after(FACE_FADE_MS, () => setLeaving(null))
        after(DEAL_TAIL_MS, () => setBelowPhase('idle'))
      })
      return
    }

    // Same scene, not counting: keep the latest title/below (live updates).
    setShown({ key: sceneKey, title, below: children })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counting, sceneKey, title, countdown, children])

  const activeNode = mode === 'counting' ? (countdown ?? lastCountdown.current) : shown.title
  const hasDeck = title != null || countdown != null

  return (
    <div className={['qz-stage', className ?? ''].filter(Boolean).join(' ')} style={style}>
      {hasDeck && (
        <div className="qz-deck-card" data-mode={mode}>
          <div ref={bodyRef} className="qz-deck-body">
            {leaving != null && (
              <div key="leaving" className="qz-deck-face qz-deck-face--leaving" aria-hidden>{leaving}</div>
            )}
            <div key={activeKey} className="qz-deck-face qz-deck-face--active">{activeNode}</div>
          </div>
        </div>
      )}
      <div key={`${shown.key}-below`} className="qz-deck-below" data-phase={belowPhase}>
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
