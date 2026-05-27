# KampKollen

Office 5-kamp scoring app — manage events, competitions, teams, and scores for Liseberg-style 5-kamp events.

## Quick Start (Docker)

```bash
# 1. Clone/copy the project

# 2. Start the app (first time — also seeds demo data)
SEED_DB=true docker compose up --build

# Or without seed data:
docker compose up --build

# App is available at:
http://localhost:7666
```

## Default Credentials

> ⚠️ Change these before exposing the app publicly!

| Role  | Username | Password    |
|-------|----------|-------------|
| Admin | `admin`  | `admin1234` |
| Player | `anna`  | `player1234` |
| Player | `bjorn` | `player1234` |
| Player | `cecilia` | `player1234` |
| Player | `david` | `player1234` |
| Player | `emma`  | `player1234` |
| Player | `fredrik` | `player1234` |

## Seed Data

On first run, the database is automatically seeded with:

- **Event:** Summer Party 2026
- **Competition:** 5-Kamp 2026 (Active)
- **Challenges:** Bollplanket, Träslaget, Desperados, Ringtoss, Kaninhoppning
- **Teams:** Team Balder, Team Kaninen, Team Flumeride
- **Players** assigned to teams with sample scores

## Local Development

### Requirements

- Node.js 20+
- PostgreSQL 16+
- pnpm or npm

### Setup

```bash
# 1. Copy env file
cp .env.example .env
# Edit .env with your local database URL

# 2. Install backend dependencies
cd backend
npm install

# 3. Run migrations and seed
npx prisma migrate dev
npm run db:seed

# 4. Start backend
npm run dev

# 5. In another terminal, install and start frontend
cd ../frontend
npm install
npm run dev

# Frontend: http://localhost:5173
# Backend API: http://localhost:7666
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 7666) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT tokens (min 32 chars) |
| `COOKIE_SECRET` | Secret for cookie signing (min 32 chars) |
| `AZURE_AI_IMAGE_ENDPOINT` | Azure AI Foundry image generation endpoint |
| `AZURE_AI_IMAGE_API_KEY` | Azure AI Foundry API key |
| `AZURE_AI_IMAGE_MODEL` | Model name (default: MAI-Image-2e) |
| `AZURE_AI_IMAGE_API_VERSION` | API version (default: preview) |

## Features

- **Events** — Create events like "Summer Party 2026"
- **Competitions** — Create 5-kamp competitions within events
- **Challenges** — Define activities with scoring types (highest wins, fastest time, ranked points, etc.)
- **Teams** — Assign players to teams with team leaders
- **Player Pool** — Players who haven't been assigned to a team yet
- **Scoring** — Enter scores per player per challenge; team scores calculated automatically
- **Leaderboards** — Live team and individual rankings
- **Image Generation** — Generate AI images for profiles, teams, challenges, and events
- **PWA** — Installable as a mobile app

## Roles

| Role | Permissions |
|------|-------------|
| Player | View, join competitions, view leaderboards |
| Scorekeeper | Enter and edit scores |
| Team Leader | Manage team roster, generate team image |
| Admin | Full access — create/manage everything |

## Architecture

```
KampKollen/
├── backend/           # Fastify + TypeScript + Prisma
│   ├── src/
│   │   ├── routes/    # API endpoints
│   │   ├── lib/       # Scoring, auth, image generation
│   │   └── middleware/
│   └── prisma/        # Schema + migrations + seed
├── frontend/          # React + Vite + TypeScript
│   └── src/
│       ├── pages/     # App pages
│       ├── components/ # Reusable UI
│       ├── contexts/  # Auth context
│       └── api/       # API client
└── docker-compose.yml
```

## API

All endpoints at `/api/*`:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET/POST /api/events`
- `GET/POST /api/competitions`
- `POST /api/competitions/:id/join`
- `GET/POST /api/challenges`
- `GET /api/teams/competition/:id`
- `POST /api/scores/competition/:cid/challenge/:ccId`
- `GET /api/leaderboards/competition/:id`

## Docker Commands

```bash
# Start (builds on first run)
docker compose up

# Rebuild after code changes
docker compose up --build

# Run database migrations manually
docker compose exec app npx prisma migrate deploy

# View logs
docker compose logs app -f

# Access database
docker compose exec db psql -U kampkollen
```
