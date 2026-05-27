# KampKollen

Office 5-kamp scoring app — manage competitions, teams, challenges, and live leaderboards for Liseberg-style multi-event contests.

## Quick Start (Docker)

```bash
# Pull and start (image from GitHub Container Registry)
docker compose up -d

# App is available at:
http://localhost:7666
```

The database schema is applied automatically on first start. A single admin account is created:

| Role  | Username | Password    |
|-------|----------|-------------|
| Admin | `admin`  | `admin1234` |

> ⚠️ Change the admin password before exposing the app publicly.

## Unraid / Self-hosted

The app ships as a single Docker image at `ghcr.io/karlmit/kampkollen:latest`. Each GitHub release builds and pushes a new image — check for updates via Unraid's Docker tab or pull manually:

```bash
docker compose pull && docker compose up -d
```

## Features

- **Competitions** — Create competitions, set a date, choose scoring mode
- **Challenges** — Define activities with scoring types: highest score, lowest score, fastest time, ranked points, golf-style placement, manual points, or win/loss
- **Teams** — Create teams, assign players, set team leaders and scorekeepers
- **Guest players** — Add players by name only (no account required); convert them to a real account later
- **Guest / spectator mode** — Anyone can browse competitions and leaderboards without an account
- **Scoring modes** — Raw sum or placement-points (rank-based)
- **Leaderboards** — Live team and individual standings, per-challenge breakdown
- **Score entry** — Numpad UI for scorekeepers; scores save immediately; clear a score with one tap
- **Image generation** — AI-generated images for profiles, teams, and challenges (requires Azure AI config)
- **PWA** — Installable as a mobile app on iOS and Android

## Roles

| Role | Permissions |
|------|-------------|
| Guest (no account) | View competitions and leaderboards |
| Player | Join competitions, view everything |
| Scorekeeper | Enter and clear scores for their team |
| Team Leader | Manage team roster, add guest players, convert guest to real player |
| Admin | Full access — create/manage everything, delete users |

## Local Development

### Requirements

- Node.js 20+
- PostgreSQL 16+

### Setup

```bash
# 1. Install backend dependencies and push schema
cd backend
npm install
npx prisma db push
npm run db:seed

# 2. Start backend (dev mode)
npm run dev

# 3. In another terminal, install and start frontend
cd ../frontend
npm install
npm run dev

# Frontend: http://localhost:5173
# Backend API: http://localhost:7666
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7666` | Server port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `JWT_SECRET` | — | JWT signing secret (min 32 chars) |
| `COOKIE_SECRET` | — | Cookie signing secret (min 32 chars) |
| `SEED_DB` | `true` | Create admin account on first start |
| `AZURE_AI_IMAGE_ENDPOINT` | — | Azure AI Foundry image generation endpoint |
| `AZURE_AI_IMAGE_API_KEY` | — | Azure AI Foundry API key |
| `AZURE_AI_IMAGE_MODEL` | `MAI-Image-2e` | Image model name |
| `AZURE_AI_IMAGE_API_VERSION` | `preview` | Image API version |

## Architecture

```
KampKollen/
├── backend/                # Fastify + TypeScript + Prisma
│   ├── src/
│   │   ├── routes/         # auth, competitions, challenges, teams, scores, leaderboards, users, settings
│   │   ├── lib/            # scoring logic, auth helpers, image generation
│   │   └── middleware/     # requireAuth, requireAdmin, optionalAuth
│   └── prisma/             # schema.prisma + seed.ts
├── frontend/               # React + Vite + TypeScript PWA
│   └── src/
│       ├── pages/          # app pages (incl. GuestCompetitionView for unauthenticated users)
│       ├── components/     # UI components + Layout
│       ├── contexts/       # AuthContext
│       └── api/            # typed API client
└── docker-compose.yml
```

## API

All endpoints at `/api/*`. Public endpoints (no auth required) are marked with `*`.

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET *  /api/competitions
GET *  /api/competitions/:id
POST   /api/competitions          (admin)
PUT    /api/competitions/:id      (admin)
POST   /api/competitions/:id/join
POST   /api/competitions/:id/players
PUT    /api/competitions/:id/players/:userId
DELETE /api/competitions/:id/players/:userId
POST   /api/competitions/:id/players/dummy
POST   /api/competitions/:id/players/dummy/:dummyUserId/convert
POST   /api/competitions/:id/challenges
DELETE /api/competitions/:id/challenges/:challengeId
PUT    /api/competitions/:id/challenges/reorder

GET *  /api/leaderboards/competition/:id
GET *  /api/leaderboards/historical
GET *  /api/leaderboards/challenge/:challengeId/all-time

GET    /api/challenges
POST   /api/challenges            (admin)
GET    /api/teams/competition/:id
GET    /api/scores/competition/:id/challenge/:ccId
POST   /api/scores/competition/:cid/challenge/:ccId
DELETE /api/scores/:id

GET    /api/users                 (admin)
PUT    /api/users/:id
DELETE /api/users/:id             (admin)

GET    /api/admin/settings        (admin)
PUT    /api/admin/settings        (admin)
```

## Docker Commands

```bash
# Start
docker compose up -d

# Rebuild after code changes
docker compose build --no-cache && docker compose up -d --force-recreate app

# View logs
docker compose logs app -f

# Access database
docker compose exec db psql -U kampkollen
```
