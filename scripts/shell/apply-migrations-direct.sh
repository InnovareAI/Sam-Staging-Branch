#!/bin/bash
set -e

export PGHOST="aws-0-us-east-1.pooler.supabase.com"
export PGPORT="5432"
export PGDATABASE="postgres"
export PGUSER="postgres.latxadqrvrrrcvkktrog"
export PGPASSWORD="Goalie00x!"

echo "Applying migrations..."
psql -f supabase/migrations/20251031000001_add_pii_encryption.sql
psql -f supabase/migrations/20251031000002_add_gdpr_compliance.sql
psql -f supabase/migrations/20251031000004_convert_to_single_user_workspaces.sql
psql -f supabase/migrations/20251031000005_add_team_member_roles.sql
psql -f supabase/migrations/20251031000006_workspace_split_utilities.sql
echo "✅ Done"
