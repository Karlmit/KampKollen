# liseberg Design System

This project uses the **liseberg** design system extracted by skillui.

## How to use

Read `SKILL.md` in this directory for the full design system reference before writing any UI code.

Key files:
- `SKILL.md` — master design reference (read this first)
- `references/DESIGN.md` — extended tokens and component specs
- `references/ANIMATIONS.md` — motion and keyframe specs
- `references/LAYOUT.md` — grid and layout containers
- `references/COMPONENTS.md` — DOM component patterns
- `screens/scroll/` — scroll journey screenshots (study before implementing)

When building any UI, always read SKILL.md first and match colors, fonts, spacing, and motion exactly.

## Multi-language (i18n)

KampKollen uses **i18next** + **react-i18next**. Swedish (`sv`) is the default language; English (`en`) is the second language. **Every new feature must be fully translated — no hardcoded UI strings.**

### Rules

1. Import and call the hook in every component that renders text:
   ```tsx
   import { useTranslation } from 'react-i18next'
   const { t } = useTranslation()
   ```
2. Add keys to **both** translation files before using them:
   - `frontend/src/i18n/sv.ts` — Swedish (primary)
   - `frontend/src/i18n/en.ts` — English
3. Use interpolation for dynamic values: `t('key', { count: n, name: x })`
4. Use i18next pluralization suffixes for count-dependent strings: `key_one` / `key_other`
5. **Module-level arrays/objects with translated strings must be defined inside the component function** (not at module scope) so they can call `t()`.
6. **Sub-components that render text need their own `const { t } = useTranslation()` call** — the hook does not inherit from a parent component.
7. Dynamic translation keys need a cast: `t(\`scoreTypes.${type}\` as any)`

### Namespace structure (in `sv.ts` / `en.ts`)

| Namespace | Used for |
|-----------|----------|
| `common.*` | Shared labels (Save, Cancel, Add, Delete, …) |
| `nav.*` | Navigation items |
| `leaderboard.*` | Leaderboard pages |
| `quiz.*` | Quiz lobby / live quiz (QuizPage.tsx) |
| `scoreTypes.*` | Score type labels |
| `admin.*` | All admin pages |
| *(page name).*` | Per-page keys (competitions, challenges, profile, …) |
