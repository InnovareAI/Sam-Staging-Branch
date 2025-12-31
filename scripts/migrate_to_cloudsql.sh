#!/bin/bash
# Migration script to run all Supabase migrations against Cloud SQL
# Excludes backup files, manual scripts, and debug files

set -e

PGHOST="34.40.53.86"
PGUSER="postgres"
PGDATABASE="sam_production"
export PGPASSWORD='SamAI2024!Prod'

MIGRATIONS_DIR="./supabase/migrations"
LOG_FILE="./migration_log_$(date +%Y%m%d_%H%M%S).txt"

echo "Starting migration to Cloud SQL..." | tee "$LOG_FILE"
echo "Host: $PGHOST" | tee -a "$LOG_FILE"
echo "Database: $PGDATABASE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Count total migrations
TOTAL=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -v '\.backup$' | grep -v '\.bak$' | grep -v 'MANUAL_' | grep -v 'DEBUG_' | grep -v 'CHECK_' | grep -v 'VERIFY_' | grep -v 'APPLY_' | grep -v 'RUN_THIS' | wc -l | tr -d ' ')
COUNT=0
ERRORS=0

echo "Found $TOTAL migration files to process" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# Run each migration file in order (sorted by filename/timestamp)
for file in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
    filename=$(basename "$file")
    
    # Skip backup files, manual scripts, debug files
    if [[ "$filename" == *".backup"* ]] || 
       [[ "$filename" == *".bak"* ]] || 
       [[ "$filename" == MANUAL_* ]] || 
       [[ "$filename" == DEBUG_* ]] || 
       [[ "$filename" == CHECK_* ]] || 
       [[ "$filename" == VERIFY_* ]] || 
       [[ "$filename" == APPLY_* ]] || 
       [[ "$filename" == RUN_THIS* ]]; then
        echo "SKIP: $filename (manual/backup file)" | tee -a "$LOG_FILE"
        continue
    fi
    
    COUNT=$((COUNT + 1))
    echo "" | tee -a "$LOG_FILE"
    echo "[$COUNT/$TOTAL] Running: $filename" | tee -a "$LOG_FILE"
    
    # Run the migration
    if psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -f "$file" >> "$LOG_FILE" 2>&1; then
        echo "  ✓ Success" | tee -a "$LOG_FILE"
    else
        echo "  ✗ Error (continuing...)" | tee -a "$LOG_FILE"
        ERRORS=$((ERRORS + 1))
    fi
done

echo "" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "Migration complete!" | tee -a "$LOG_FILE"
echo "Total: $COUNT migrations" | tee -a "$LOG_FILE"
echo "Errors: $ERRORS" | tee -a "$LOG_FILE"
echo "Log saved to: $LOG_FILE" | tee -a "$LOG_FILE"
