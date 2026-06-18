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

## Always push and tag after changes

After every set of changes:

1. Commit with a descriptive message.
2. Tag the commit `vX.Y.Z` (increment the appropriate semver part).
3. Push both: `git push && git push --tags`

The tag triggers GitHub Actions → GHCR publish → Unraid update. Without the tag push the deployment never fires.

## Deployment topology — two containers, updated differently

The Unraid stack (`docker-compose.unraid.yml`) runs **two** containers:

| Container | Image | Built by us? | How it updates |
|-----------|-------|--------------|----------------|
| `kampkollen` | `ghcr.io/karlmit/kampkollen:latest` | **Yes** — our code | Automatic: pushing a `vX.Y.Z` tag rebuilds and republishes it (see above) |
| `kampkollen-db` | `postgres:16-alpine` (pinned by digest) | **No** — stock Postgres | Manual only — our pipeline never touches it |

**The GitHub Actions workflow only builds the app image.** It does not build,
tag, or push the database image, and it never edits the user's Unraid copy of
the compose file.

### "kampkollen-db update ready" in Unraid is NOT caused by our code

If Unraid shows **"update ready" / "DB needs an update"** on `kampkollen-db`,
that is a routine upstream Postgres patch on the `postgres:16-alpine` tag — it
is **not** caused by any code change we made. Do not go hunting through the
app/quiz/Prisma code for it. It is harmless and safe to apply: it stays on
Postgres major version 16 and the data volume (`/mnt/user/appdata/kampkollen/db`)
persists.

- **Simplest fix for the user:** just press the **update** button on
  `kampkollen-db` in the Unraid UI. No file editing. It may reappear on the next
  Postgres patch — pressing update again is fine.
- **To stop the nag entirely:** pin the image to a fixed digest in the compose
  file, e.g. `image: postgres:16-alpine@sha256:<digest>`. The repo copy is
  already pinned, but the **running** config lives only on the Unraid server at
  `/mnt/user/appdata/kampkollen/`, so the repo change does not reach the server
  automatically — the user must edit that copy and run
  `docker compose pull && docker compose up -d` for a pin to take effect.

The important takeaway: changes to the **database** container must be made where
its config lives (on Unraid). Only the **app** flows through the git tag pipeline.
