# Product

## Register

product

## Users

Organizers, scorekeepers, team leaders, players, and spectators of office "5-kamp"
multi-event contests (Liseberg-style). Primary context is **mobile, in the moment,
mid-event** — a scorekeeper standing at a station tapping in results between rounds,
a player checking standings on their phone, an admin setting up competitions
beforehand. Swedish-first audience (sv is the default language; en is secondary).

## Product Purpose

KampKollen runs the full lifecycle of a multi-event competition: create competitions
and challenges, build teams, enter scores live, and surface team/individual
leaderboards in real time. It also includes a live quiz mode and AI-generated
imagery for profiles/teams/challenges. Success = a scorekeeper can record a result
in seconds without confusion, and anyone can read the current standings at a glance.

## Brand Personality

Friendly, energetic, celebratory — a competition should feel fun, not like
enterprise software. Three words: **playful, clear, fast.** Built on the *liseberg*
design system (see DESIGN.md): light theme, LL Brown type, deep-green ink
(`#0c4433`), expressive motion. Emoji are used deliberately as functional iconography.

## Anti-references

- Dense enterprise admin panels / data-grid tools.
- Anything that buries the primary action (entering or reading a score) behind chrome.
- Tiny tap targets and cramped controls — the app is used one-handed on a phone,
  often quickly, so touch targets must be comfortably large.

## Design Principles

1. **The score is the product.** Entering and reading scores is the hot path; keep it
   one or two taps and visually dominant.
2. **Thumb-first.** Mobile, one-handed, at-a-glance. Tap targets generous, type legible
   at arm's length.
3. **Don't make them choose what they shouldn't.** Surface only what's relevant to the
   task; hide modes (e.g. quizzes) from flows where they only cause confusion.
4. **Celebrate, don't clutter.** Motion and emoji add delight where they reinforce the
   moment, never as decoration that slows the task.
5. **Bilingual by construction.** Every string ships in sv + en via i18next; no
   hardcoded UI text.

## Accessibility & Inclusion

Mobile-first PWA, installable on iOS/Android. Comfortable touch targets (≥44px on the
hot path). Body text must meet WCAG AA (≥4.5:1) against the light surfaces. Respect
`prefers-reduced-motion` for the system's expressive animations.
