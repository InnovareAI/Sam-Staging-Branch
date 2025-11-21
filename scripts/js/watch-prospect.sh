#!/bin/bash
for i in {1..12}; do
  echo "=== Check $i ($(($i * 5)) seconds) ==="
  PGPASSWORD='QFe75XZ2kqhy2AyH' psql -h db.latxadqrvrrrcvkktrog.supabase.co -p 5432 -U postgres -d postgres -c "SELECT first_name, status, contacted_at FROM campaign_prospects WHERE id = '13fb3658-8935-41fe-91b2-f03917754aa6'"
  sleep 5
done
