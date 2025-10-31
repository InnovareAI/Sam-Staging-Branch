#!/bin/bash
set -e
source .env.local

for file in supabase/migrations/202510310000{01..06}*.sql; do
  echo "▶ $file"
  psql "$DATABASE_URL" -f "$file" 2>&1 | grep -v "NOTICE" || true
done

echo "✅ Done"
