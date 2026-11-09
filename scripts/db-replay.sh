#!/usr/bin/env bash
# Replays every migration, then the demo seed (twice, to prove it is idempotent), against DATABASE_URL.
# Usage: DATABASE_URL=postgres://... scripts/db-replay.sh
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL}"
cd "$(dirname "$0")/.."
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f supabase/ci/supabase-shim.sql 2>&1 | grep -v -i "wal_level" || true

# Known problems in early migrations when replayed on an EMPTY database (see 20260409000000_schema_sync.sql):
# the second file re-adds tables to the realtime publication, and the 2026-04-08 demo seed uses invalid UUIDs.
# Those files were applied by hand to the hosted project and are left untouched; here they are skipped or filtered.
for f in supabase/migrations/*.sql; do
  case "$(basename "$f")" in
    20260408010000_seeding_demo.sql) echo "skip  $f (superseded by supabase/seed.sql)"; continue ;;
    20260407174500_full_schema.sql)
      echo "apply $f (without duplicate publication lines)"
      grep -v "ALTER PUBLICATION supabase_realtime" "$f" | "${PSQL[@]}" ;;
    20260408050000_phase10_templates.sql)
      # workflows.canvas_json was added by hand on the hosted project and only recorded later in schema_sync.
      echo "apply $f (after adding workflows.canvas_json)"
      { echo "ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS canvas_json JSONB;"; cat "$f"; } | "${PSQL[@]}" ;;
    *) echo "apply $f"; "${PSQL[@]}" -f "$f" ;;
  esac
done

echo "seed  supabase/seed.sql (x2)"
"${PSQL[@]}" -f supabase/seed.sql
"${PSQL[@]}" -f supabase/seed.sql
"${PSQL[@]}" -f supabase/ci/assert-seed.sql
echo "database OK"
