#!/bin/sh
set -e

echo "Setting up KampKollen database schema..."

# Rename the legacy SCOREKEEPER global role to REFEREE if present. Idempotent and
# a no-op on fresh databases where the type/value doesn't exist yet. Done BEFORE
# `db push` so the DB enum already matches the schema and push sees no drift (a
# bare value rename would otherwise force Prisma to drop/recreate the type).
npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'GlobalRole' AND e.enumlabel = 'SCOREKEEPER'
  ) THEN
    ALTER TYPE "GlobalRole" RENAME VALUE 'SCOREKEEPER' TO 'REFEREE';
  END IF;
END$$;
SQL

npx prisma db push --accept-data-loss

# Seed on first run (if SEED_DB=true or no users exist)
if [ "${SEED_DB}" = "true" ]; then
  echo "Seeding database..."
  npx tsx /app/prisma/seed.ts 2>/dev/null || echo "Seed skipped (may already be seeded)"
fi

echo "Starting KampKollen on port 7666..."
exec node /app/dist/index.js
