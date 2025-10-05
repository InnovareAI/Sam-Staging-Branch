#!/bin/bash
# Deploy prospect approval migration to Supabase

set -e

# Load environment variables
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
fi

# Database connection details
DB_HOST="aws-0-eu-central-1.pooler.supabase.com"
DB_PORT="6543"
DB_NAME="postgres"
DB_USER="postgres.latxadqrvrrrcvkktrog"

echo "🚀 Deploying prospect approval migration..."
echo "📍 Database: ${DB_HOST}"

# Apply migration
export PGPASSWORD="${DB_PASSWORD}"
psql "postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  -f supabase/migrations/20251002000000_create_prospect_approval_system.sql \
  2>&1

if [ $? -eq 0 ]; then
    echo "✅ Migration deployed successfully!"
else
    echo "❌ Migration failed!"
    exit 1
fi
