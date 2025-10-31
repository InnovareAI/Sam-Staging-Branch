#!/bin/bash
###############################################################################
# Apply Schema Cleanup Migration
# Uses psql to execute SQL directly on Supabase Postgres
###############################################################################

set -e  # Exit on error

echo "🔧 Schema Cleanup Migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql is not installed"
    echo ""
    echo "Install PostgreSQL client:"
    echo "  brew install postgresql@15"
    echo ""
    exit 1
fi

# Migration file
MIGRATION_FILE="sql/migrations/20251031_cleanup_campaign_prospects.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

# Supabase connection details
DB_HOST="db.latxadqrvrrrcvkktrog.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

echo "📄 Migration file: $MIGRATION_FILE"
echo "🗄️  Database: $DB_HOST"
echo "👤 User: $DB_USER"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 You will be prompted for the Supabase database password"
echo ""
echo "Get password from:"
echo "  https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/settings/database"
echo "  → Database Settings → Connection String → Password"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Execute migration
echo "🚀 Executing migration..."
echo ""

psql \
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
    echo "📊 Changes applied:"
    echo "   ✅ Status constraint updated"
    echo "   ✅ Indexes created"
    echo "   ✅ Helper function mark_prospect_contacted() created"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🎯 Next step: Fix stuck prospects"
    echo ""
    echo "Run:"
    echo "  node scripts/js/fix-stuck-queued-prospects.mjs"
    echo ""
else
    echo "❌ Migration failed with exit code: $EXIT_CODE"
    echo ""
    echo "Common issues:"
    echo "  - Wrong password"
    echo "  - Network/firewall blocking connection"
    echo "  - Constraint already exists (safe to ignore)"
    echo ""
    exit $EXIT_CODE
fi
