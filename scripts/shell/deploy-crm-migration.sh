#!/bin/bash

# Deploy CRM Integration Migration to Supabase
# This script applies the CRM tables migration to the production database

set -e  # Exit on error

echo "🚀 Deploying CRM Integration Migration to Supabase..."
echo ""

# Database connection details
DB_HOST="aws-0-us-west-1.pooler.supabase.com"
DB_PORT="6543"
DB_USER="postgres.latxadqrvrrrcvkktrog"
DB_NAME="postgres"
DB_PASSWORD="Innovareeai2024!!"

# Migration file
MIGRATION_FILE="supabase/migrations/20251005000004_create_crm_integration_tables.sql"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📋 Migration file: $MIGRATION_FILE"
echo "🗄️  Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo ""

# Confirm before proceeding
read -p "⚠️  This will create CRM tables in production. Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled."
    exit 1
fi

echo ""
echo "🔧 Applying migration..."

# Execute migration
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ CRM Integration migration deployed successfully!"
    echo ""
    echo "📊 Verifying tables..."

    # Verify tables were created
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -c "\dt crm_*"

    echo ""
    echo "✨ Deployment complete!"
    echo ""
    echo "Next steps:"
    echo "1. Configure OAuth credentials in .env.local"
    echo "2. Test CRM Integration tile in workspace dashboard"
    echo "3. Connect a test HubSpot account"
else
    echo ""
    echo "❌ Migration failed. Check errors above."
    exit 1
fi
