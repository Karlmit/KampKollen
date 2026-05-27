#!/bin/bash
# KampKollen start script
# Usage:
#   ./start.sh           — start (or restart) the app
#   ./start.sh --seed    — also seed demo data on first run
#   ./start.sh --bg      — start in background (nohup)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
UPLOADS_DIR="$SCRIPT_DIR/uploads"
PUBLIC_DIR="$BACKEND_DIR/public"
LOG_FILE="/tmp/kampkollen.log"

SEED=false
BG=false
for arg in "$@"; do
  [ "$arg" = "--seed" ] && SEED=true
  [ "$arg" = "--bg" ]   && BG=true
done

echo "=== KampKollen startup ==="

# Stop any existing instance
pkill -f "node dist/index.js" 2>/dev/null && echo "↺ Stopped previous instance" || true
sleep 1

# 1. Ensure uploads dir exists
mkdir -p "$UPLOADS_DIR"

# 2. Start or reuse a Postgres Docker container
PG_CONTAINER="kampkollen-postgres"
if docker ps -q -f name="$PG_CONTAINER" | grep -q .; then
  echo "✓ Postgres already running"
elif docker ps -aq -f name="$PG_CONTAINER" | grep -q .; then
  echo "↺ Starting existing Postgres container..."
  docker start "$PG_CONTAINER"
  sleep 2
else
  echo "▶ Starting new Postgres container on port 5434..."
  docker run -d \
    --name "$PG_CONTAINER" \
    -e POSTGRES_USER=kampkollen \
    -e POSTGRES_PASSWORD=kampkollen \
    -e POSTGRES_DB=kampkollen \
    -p 5434:5432 \
    --restart unless-stopped \
    postgres:16-alpine
  echo "  Waiting for Postgres to be ready..."
  until docker exec "$PG_CONTAINER" pg_isready -U kampkollen >/dev/null 2>&1; do
    sleep 1
  done
fi
echo "✓ Postgres ready"

# 3. Write runtime .env for the backend
# Read Azure credentials from environment or existing .env (never hardcode secrets here)
EXISTING_AZURE_KEY="${AZURE_AI_IMAGE_API_KEY:-}"
EXISTING_AZURE_ENDPOINT="${AZURE_AI_IMAGE_ENDPOINT:-}"
if [ -f "$BACKEND_DIR/.env" ]; then
  [ -z "$EXISTING_AZURE_KEY" ] && EXISTING_AZURE_KEY=$(grep "^AZURE_AI_IMAGE_API_KEY=" "$BACKEND_DIR/.env" 2>/dev/null | cut -d= -f2-)
  [ -z "$EXISTING_AZURE_ENDPOINT" ] && EXISTING_AZURE_ENDPOINT=$(grep "^AZURE_AI_IMAGE_ENDPOINT=" "$BACKEND_DIR/.env" 2>/dev/null | cut -d= -f2-)
fi

cat > "$BACKEND_DIR/.env" <<EOF
NODE_ENV=production
PORT=7666
DATABASE_URL=postgresql://kampkollen:kampkollen@127.0.0.1:5434/kampkollen
JWT_SECRET=kampkollen_dev_jwt_secret_key_minimum_32_characters_long
COOKIE_SECRET=kampkollen_dev_cookie_secret_minimum_32_characters
UPLOADS_DIR=${UPLOADS_DIR}
AZURE_AI_IMAGE_ENDPOINT=${EXISTING_AZURE_ENDPOINT}
AZURE_AI_IMAGE_API_KEY=${EXISTING_AZURE_KEY}
AZURE_AI_IMAGE_MODEL=MAI-Image-2e
AZURE_AI_IMAGE_API_VERSION=preview
EOF

# 4. Push Prisma schema (idempotent)
echo "▶ Syncing database schema..."
cd "$BACKEND_DIR"
DATABASE_URL="postgresql://kampkollen:kampkollen@127.0.0.1:5434/kampkollen" \
  node_modules/.bin/prisma db push --accept-data-loss --skip-generate 2>&1 | grep -v "^$" | tail -3
echo "✓ Schema ready"

# 5. Seed if requested (won't fail if already seeded)
if [ "$SEED" = "true" ]; then
  echo "▶ Seeding database..."
  DATABASE_URL="postgresql://kampkollen:kampkollen@127.0.0.1:5434/kampkollen" \
    node_modules/.bin/tsx prisma/seed.ts 2>&1 | tail -5 || echo "  (seed may already exist — OK)"
  echo "✓ Seed done"
fi

# 6. Build frontend if public dir is missing or source changed
NEEDS_FRONTEND_BUILD=false
[ ! -d "$PUBLIC_DIR" ] && NEEDS_FRONTEND_BUILD=true
[ -d "$FRONTEND_DIR/src" ] && [ "$FRONTEND_DIR/src" -nt "$PUBLIC_DIR/index.html" ] 2>/dev/null && NEEDS_FRONTEND_BUILD=true

if [ "$NEEDS_FRONTEND_BUILD" = "true" ]; then
  echo "▶ Building frontend..."
  cd "$FRONTEND_DIR"
  npm run build 2>&1 | tail -3
  rm -rf "$PUBLIC_DIR"
  cp -r "$FRONTEND_DIR/dist" "$PUBLIC_DIR"
  echo "✓ Frontend built and copied"
else
  echo "✓ Frontend up-to-date"
fi

# 7. Build backend if dist is missing or source changed
NEEDS_BACKEND_BUILD=false
[ ! -f "$BACKEND_DIR/dist/index.js" ] && NEEDS_BACKEND_BUILD=true
[ -d "$BACKEND_DIR/src" ] && [ "$BACKEND_DIR/src" -nt "$BACKEND_DIR/dist/index.js" ] 2>/dev/null && NEEDS_BACKEND_BUILD=true

if [ "$NEEDS_BACKEND_BUILD" = "true" ]; then
  echo "▶ Building backend..."
  cd "$BACKEND_DIR"
  npm run build 2>&1 | tail -3
  echo "✓ Backend built"
else
  echo "✓ Backend up-to-date"
fi

echo ""
echo "=== Launching KampKollen on http://0.0.0.0:7666 ==="
echo "    Admin login: admin / admin1234"
echo ""

cd "$BACKEND_DIR"

if [ "$BG" = "true" ]; then
  nohup node dist/index.js > "$LOG_FILE" 2>&1 &
  PID=$!
  sleep 2
  if kill -0 "$PID" 2>/dev/null; then
    echo "✓ Started in background (PID $PID)"
    echo "  Logs: tail -f $LOG_FILE"
    echo "  Stop: $SCRIPT_DIR/stop.sh"
  else
    echo "✗ Failed to start — check logs: $LOG_FILE"
    exit 1
  fi
else
  exec node dist/index.js
fi
