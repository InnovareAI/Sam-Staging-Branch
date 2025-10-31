#!/bin/bash
###############################################################################
# Apply Schema Cleanup Migration with Password
# Usage: PGPASSWORD="your_password" ./scripts/shell/migrate-with-password.sh
###############################################################################

set -e

echo "🔧 Schema Cleanup Migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check password
if [ -z "$PGPASSWORD" ]; then
    echo "❌ Error: PGPASSWORD environment variable not set"
    echo ""
    echo "Usage:"
    echo "  PGPASSWORD='your_password' ./scripts/shell/migrate-with-password.sh"
    echo ""
    echo "Or add to .env.local:"
    echo "  export PGPASSWORD='your_password'"
    echo "  source .env.local"
    echo "  ./scripts/shell/migrate-with-password.sh"
    echo ""
    echo "Get password from:"
    echo "  https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/settings/database"
    echo ""
    exit 1
fi

# Migration file
MIGRATION_FILE="sql/migrations/20251031_cleanup_campaign_prospects.sql"

# Connection details
DB_HOST="db.latxadqrvrrrcvkktrog.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

echo "📄 Migration: $MIGRATION_FILE"
echo "🗄️  Host: $DB_HOST"
echo ""
echo "🚀 Executing..."
echo ""

# Run migration
psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Migration applied successfully!"
    echo ""
    echo "Next step:"
    echo "  node scripts/js/fix-stuck-queued-prospects.mjs"
    echo ""
else
    echo ""
    echo "❌ Migration failed"
    exit 1
fi
