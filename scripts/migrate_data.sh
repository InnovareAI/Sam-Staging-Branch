#!/bin/bash
# Data Migration Script: Supabase to Cloud SQL (Fixed)
# Uses INSERT format instead of COPY for better compatibility

set -e

# Use PostgreSQL 17 from Homebrew
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

echo "============================================"
echo "  SAM AI - Data Migration"
echo "  Supabase -> Cloud SQL"
echo "============================================"
echo ""

# Supabase connection
SUPABASE_HOST="db.latxadqrvrrrcvkktrog.supabase.co"
SUPABASE_PORT="5432"
SUPABASE_USER="postgres"
SUPABASE_DB="postgres"
SUPABASE_PASS="7jQpeTMlnd2NqRa0"

# Cloud SQL connection  
CLOUDSQL_HOST="34.40.53.86"
CLOUDSQL_PORT="5432"
CLOUDSQL_USER="postgres"
CLOUDSQL_DB="sam_production"
CLOUDSQL_PASS="SamAI2024!Prod"

# Export directory
EXPORT_DIR="./migration_data"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${EXPORT_DIR}/supabase_data_inserts_${TIMESTAMP}.sql"

mkdir -p "$EXPORT_DIR"

echo "Step 1: Exporting data from Supabase (INSERT format)..."
echo "Host: $SUPABASE_HOST"
echo ""

# Export data using INSERT format for better compatibility
export PGPASSWORD="$SUPABASE_PASS"
pg_dump \
    -h "$SUPABASE_HOST" \
    -p "$SUPABASE_PORT" \
    -U "$SUPABASE_USER" \
    -d "$SUPABASE_DB" \
    --data-only \
    --no-owner \
    --no-acl \
    --column-inserts \
    --inserts \
    --disable-triggers \
    --exclude-schema='auth' \
    --exclude-schema='storage' \
    --exclude-schema='supabase_functions' \
    --exclude-schema='supabase_migrations' \
    --exclude-schema='realtime' \
    --exclude-schema='graphql_public' \
    --exclude-schema='graphql' \
    --exclude-schema='pgsodium' \
    --exclude-schema='pgsodium_masks' \
    --exclude-schema='vault' \
    --exclude-schema='extensions' \
    --exclude-schema='_realtime' \
    --exclude-schema='net' \
    --exclude-schema='cron' \
    --exclude-table='spatial_ref_sys' \
    --exclude-table='pg_stat_statements' \
    --exclude-table='pg_stat_statements_info' \
    -f "$DUMP_FILE"

echo "✓ Data exported to: $DUMP_FILE"
echo "  Size: $(du -h "$DUMP_FILE" | cut -f1)"
echo ""

# Clean up any stray backslash commands
echo "Cleaning dump file..."
sed -i.bak '/^\\[a-z]/d' "$DUMP_FILE"
echo "✓ Cleaned"
echo ""

echo "Step 2: Disabling foreign key checks and importing data..."
echo "Host: $CLOUDSQL_HOST"
echo ""

# Import data with foreign key checks disabled
export PGPASSWORD="$CLOUDSQL_PASS"

# Create a wrapper that disables triggers
psql -h "$CLOUDSQL_HOST" -U "$CLOUDSQL_USER" -d "$CLOUDSQL_DB" <<EOF
-- Disable all triggers to allow data import regardless of FK order
SET session_replication_role = 'replica';

-- Import the data
\i $DUMP_FILE

-- Re-enable triggers
SET session_replication_role = 'origin';
EOF

echo "✓ Data imported successfully!"
echo ""

echo "Step 3: Verifying data counts..."
echo ""

# Compare row counts for key tables
TABLES=("users" "workspaces" "campaigns" "campaign_prospects" "knowledge_base_entries")

for table in "${TABLES[@]}"; do
    export PGPASSWORD="$SUPABASE_PASS"
    supabase_count=$(psql -h "$SUPABASE_HOST" -U "$SUPABASE_USER" -d "$SUPABASE_DB" -t -c "SELECT COUNT(*) FROM public.$table" 2>/dev/null | xargs || echo "0")
    
    export PGPASSWORD="$CLOUDSQL_PASS"
    cloudsql_count=$(psql -h "$CLOUDSQL_HOST" -U "$CLOUDSQL_USER" -d "$CLOUDSQL_DB" -t -c "SELECT COUNT(*) FROM public.$table" 2>/dev/null | xargs || echo "0")
    
    if [ "$supabase_count" == "$cloudsql_count" ]; then
        echo "✓ $table: $supabase_count rows (matched)"
    else
        echo "⚠ $table: Supabase=$supabase_count, CloudSQL=$cloudsql_count"
    fi
done

echo ""
echo "============================================"
echo "  Migration Complete!"
echo "============================================"
echo "Dump file: $DUMP_FILE"
echo ""
