#!/bin/bash
# Smart Data Migration - Import essential tables first, handle errors gracefully

set -e

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

# Cloud SQL connection  
CLOUDSQL_HOST="34.40.53.86"
CLOUDSQL_USER="postgres"
CLOUDSQL_DB="sam_production"
export PGPASSWORD="SamAI2024!Prod"

# Supabase connection
SUPABASE_HOST="db.latxadqrvrrrcvkktrog.supabase.co"
SUPABASE_PASS="7jQpeTMlnd2NqRa0"

EXPORT_DIR="./migration_data/tables"
mkdir -p "$EXPORT_DIR"

echo "============================================"
echo "  Smart Data Migration"
echo "  Supabase -> Cloud SQL"
echo "============================================"

# Priority tables that need to be imported in order (parent tables first)
PRIORITY_TABLES=(
    "workspaces"
    "users" 
    "workspace_members"
    "campaigns"
    "campaign_prospects"
    "workspace_prospects"
    "master_prospects"
    "knowledge_base_entries"
    "sam_conversations"
    "sam_conversation_messages"
    "workspace_accounts"
    "user_unipile_accounts"
)

# Export and import each table
for table in "${PRIORITY_TABLES[@]}"; do
    echo ""
    echo "Processing: $table"
    echo "-----------------------------------"
    
    # Export from Supabase
    export PGPASSWORD="$SUPABASE_PASS"
    pg_dump \
        -h "$SUPABASE_HOST" \
        -p 5432 \
        -U postgres \
        -d postgres \
        --data-only \
        --no-owner \
        --no-acl \
        --column-inserts \
        --inserts \
        -t "public.$table" \
        -f "$EXPORT_DIR/${table}.sql" 2>/dev/null || {
            echo "  ⚠ Table not found in Supabase, skipping"
            continue
        }
    
    supabase_count=$(psql -h "$SUPABASE_HOST" -U postgres -d postgres -t -c "SELECT COUNT(*) FROM public.$table" 2>/dev/null | xargs || echo "0")
    echo "  Supabase rows: $supabase_count"
    
    # Truncate in Cloud SQL
    export PGPASSWORD="SamAI2024!Prod"
    psql -h "$CLOUDSQL_HOST" -U "$CLOUDSQL_USER" -d "$CLOUDSQL_DB" -c "TRUNCATE TABLE public.$table CASCADE" 2>/dev/null || true
    
    # Import to Cloud SQL (ignore errors)
    psql -h "$CLOUDSQL_HOST" -U "$CLOUDSQL_USER" -d "$CLOUDSQL_DB" \
        -v ON_ERROR_STOP=off \
        -f "$EXPORT_DIR/${table}.sql" 2>&1 | grep -c "INSERT" || echo "  (no inserts)"
    
    # Verify count
    cloudsql_count=$(psql -h "$CLOUDSQL_HOST" -U "$CLOUDSQL_USER" -d "$CLOUDSQL_DB" -t -c "SELECT COUNT(*) FROM public.$table" 2>/dev/null | xargs || echo "0")
    
    if [ "$supabase_count" == "$cloudsql_count" ]; then
        echo "  ✓ CloudSQL: $cloudsql_count (matched)"
    else
        echo "  ⚠ CloudSQL: $cloudsql_count (expected: $supabase_count)"
    fi
done

echo ""
echo "============================================"
echo "  Migration Complete"
echo "============================================"
