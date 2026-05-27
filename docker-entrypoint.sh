#!/bin/sh
set -e

echo "Setting up KampKollen database schema..."
npx prisma db push --accept-data-loss

# Seed on first run (if SEED_DB=true or no users exist)
if [ "${SEED_DB}" = "true" ]; then
  echo "Seeding database..."
  npx tsx /app/prisma/seed.ts 2>/dev/null || echo "Seed skipped (may already be seeded)"
fi

echo "Starting KampKollen on port 7666..."
exec node /app/dist/index.js
