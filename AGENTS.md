# KampKollen — Agent Instructions

This file mirrors the key operational rules in `CLAUDE.md`. Read `CLAUDE.md` for
the full design-system, i18n, and release details. The notes below are the ones
agents get wrong most often.

## Release flow — always push and tag after changes

After every set of changes:

1. Commit with a descriptive message.
2. Tag the commit `vX.Y.Z` (increment the appropriate semver part).
3. Push both: `git push && git push --tags`

The tag triggers GitHub Actions → GHCR publish → Unraid update. Without the tag
push the deployment never fires.

## Deployment topology — two containers, updated differently

The Unraid stack (`docker-compose.unraid.yml`) runs **two** containers:

| Container | Image | Built by us? | How it updates |
|-----------|-------|--------------|----------------|
| `kampkollen` | `ghcr.io/karlmit/kampkollen:latest` | **Yes** — our code | Automatic: pushing a `vX.Y.Z` tag rebuilds and republishes it |
| `kampkollen-db` | `postgres:16-alpine` (pinned by digest) | **No** — stock Postgres | Manual only — our pipeline never touches it |

**The GitHub Actions workflow (`.github/workflows/docker-publish.yml`) only
builds the app image.** It does not build, tag, or push the database image, and
it never edits the user's Unraid copy of the compose file.

### "kampkollen-db update ready" / "DB needs an update" is NOT our code

If Unraid flags `kampkollen-db` as needing an update, that is a routine upstream
Postgres patch on the `postgres:16-alpine` tag — **not** caused by any app /
quiz / Prisma change. Do not investigate the app code for it. It is harmless and
safe to apply: it stays on Postgres major 16 and the data volume
(`/mnt/user/appdata/kampkollen/db`) persists.

- **Simplest fix:** the user presses the **update** button on `kampkollen-db` in
  the Unraid UI. No file editing. It may reappear on the next Postgres patch;
  pressing update again is fine.
- **To stop the nag entirely:** pin the image to a fixed digest in the compose
  file (`image: postgres:16-alpine@sha256:<digest>`). The repo copy is already
  pinned, but the **running** config lives only on the Unraid server at
  `/mnt/user/appdata/kampkollen/`, so a repo change does not reach the server by
  itself — the user must edit that copy and run
  `docker compose pull && docker compose up -d`.

Takeaway: **database** changes must be made on Unraid where its config lives;
only the **app** flows through the git tag pipeline.
