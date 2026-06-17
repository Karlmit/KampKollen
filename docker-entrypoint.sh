#!/bin/sh
set -e

echo "Setting up KampKollen database schema..."

# GlobalRole is now just PLAYER | ADMIN — the old all-team SCOREKEEPER/REFEREE
# global roles are gone (referee is a per-competition CompetitionPlayer flag now).
# Demote any user still holding a removed global role to PLAYER BEFORE `db push`,
# so recreating the enum without those values doesn't hit rows that reference them.
# Idempotent and a no-op on fresh databases (guarded by the table check).
npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
DO $$
BEGIN
  IF to_regclass('public."User"') IS NOT NULL THEN
    UPDATE "User" SET "globalRole" = 'PLAYER'
    WHERE "globalRole"::text NOT IN ('PLAYER', 'ADMIN');
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
