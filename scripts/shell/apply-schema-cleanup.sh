#!/bin/bash
###############################################################################
# Apply Schema Cleanup Migration via Postgres CLI
# Fixes campaign_prospects status constraint issue
###############################################################################

set -e  # Exit on error

echo "🔧 Applying Schema Cleanup Migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Supabase connection details
DB_HOST="db.latxadqrvrrrcvkktrog.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASSWORD="${SUPABASE_DB_PASSWORD}"

# Check if password is set
if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Error: SUPABASE_DB_PASSWORD not set in .env.local"
    echo ""
    echo "Please add to .env.local:"
    echo "SUPABASE_DB_PASSWORD=your_database_password"
    echo ""
    echo "Get password from:"
    echo "https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/settings/database"
    exit 1
fi

# Migration file
MIGRATION_FILE="sql/migrations/20251031_cleanup_campaign_prospects.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📄 Migration file: $MIGRATION_FILE"
echo "🗄️  Database: $DB_HOST"
echo ""

# Execute migration
echo "🚀 Executing migration..."
echo ""

PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$MIGRATION_FILE"

EXIT_CODE=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Migration applied successfully!"
    echo ""
    echo "📊 Status constraint updated"
    echo "📊 Indexes created"
    echo "📊 Helper function mark_prospect_contacted() created"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "✅ Next step: Fix stuck prospects"
    echo ""
    echo "Run:"
    echo "  node scripts/js/fix-stuck-queued-prospects.mjs"
    echo ""
else
    echo "❌ Migration failed with exit code: $EXIT_CODE"
    echo ""
    echo "Check the error messages above."
    exit $EXIT_CODE
fi
