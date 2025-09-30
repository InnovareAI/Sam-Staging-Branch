#!/bin/bash

# ==============================================================================
# Production Database Migration Execution Script
# ==============================================================================
# This script orchestrates the complete migration process for WARP team
# Run this script on a machine with:
# - Supabase CLI installed
# - Direct access to production database
# - PostgreSQL client (psql) installed
# ==============================================================================

set -e  # Exit on any error
set -o pipefail  # Exit on pipe failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MIGRATION_DIR="./migrations"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# ==============================================================================
# Helper Functions
# ==============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

confirm() {
    read -p "$1 (yes/no): " response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# ==============================================================================
# Pre-flight Checks
# ==============================================================================

log_info "Starting pre-flight checks..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    log_error "Supabase CLI not found. Install it first: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    log_error "psql client not found. Install PostgreSQL client tools."
    exit 1
fi

# Check if migration directory exists
if [ ! -d "$MIGRATION_DIR" ]; then
    log_error "Migration directory not found: $MIGRATION_DIR"
    exit 1
fi

log_success "Pre-flight checks passed"

# ==============================================================================
# Environment Setup
# ==============================================================================

echo ""
log_info "Please provide production database credentials:"
read -p "Supabase Project Reference (or press Enter to skip): " PROJECT_REF
read -p "Database Password: " -s DB_PASSWORD
echo ""

if [ -n "$PROJECT_REF" ]; then
    export PROD_DB_URL="postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"
else
    read -p "Full Database URL: " PROD_DB_URL
fi

# Test connection
log_info "Testing database connection..."
if psql "$PROD_DB_URL" -c "SELECT 1;" &> /dev/null; then
    log_success "Database connection successful"
else
    log_error "Cannot connect to database. Check credentials."
    exit 1
fi

# ==============================================================================
# STEP 1: Create Backup
# ==============================================================================

echo ""
echo "=========================================="
echo "STEP 1: DATABASE BACKUP"
echo "=========================================="

log_warning "This will create a full backup of your production database."
if ! confirm "Proceed with backup?"; then
    log_error "Migration cancelled by user"
    exit 1
fi

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql"

log_info "Creating backup: $BACKUP_FILE"
if pg_dump "$PROD_DB_URL" > "$BACKUP_FILE"; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_success "Backup created successfully (${BACKUP_SIZE})"
else
    log_error "Backup failed"
    exit 1
fi

# ==============================================================================
# STEP 2: Run Structural Migrations
# ==============================================================================

echo ""
echo "=========================================="
echo "STEP 2: RUN STRUCTURAL MIGRATIONS"
echo "=========================================="

log_info "This will apply schema changes to production database."
if ! confirm "Proceed with schema migrations?"; then
    log_error "Migration cancelled by user"
    exit 1
fi

# Check if using Supabase CLI or direct psql
if [ -n "$PROJECT_REF" ]; then
    log_info "Using Supabase CLI to push migrations..."
    if supabase db push --password "$DB_PASSWORD"; then
        log_success "Schema migrations applied via Supabase CLI"
    else
        log_error "Schema migration failed"
        log_info "To rollback: psql $PROD_DB_URL < $BACKUP_FILE"
        exit 1
    fi
else
    log_info "Applying migrations via psql..."
    # Apply any pending migration files
    for migration in "$MIGRATION_DIR"/*.sql; do
        if [[ -f "$migration" && "$migration" =~ ^[0-9] ]]; then
            log_info "Applying: $(basename $migration)"
            if psql "$PROD_DB_URL" < "$migration"; then
                log_success "Applied $(basename $migration)"
            else
                log_error "Failed to apply $(basename $migration)"
                exit 1
            fi
        fi
    done
fi

# ==============================================================================
# STEP 3: Backfill Workspace IDs
# ==============================================================================

echo ""
echo "=========================================="
echo "STEP 3: BACKFILL WORKSPACE IDs"
echo "=========================================="

log_info "This will assign workspace_id to existing KB entries."
if ! confirm "Proceed with workspace ID backfill?"; then
    log_error "Migration cancelled by user"
    exit 1
fi

log_info "Running workspace ID backfill script..."
if psql "$PROD_DB_URL" < "$MIGRATION_DIR/03_backfill_workspace_ids.sql"; then
    log_success "Workspace IDs backfilled successfully"
else
    log_error "Workspace ID backfill failed"
    exit 1
fi

# ==============================================================================
# STEP 4: Seed KB Sections
# ==============================================================================

echo ""
echo "=========================================="
echo "STEP 4: SEED KB SECTIONS"
echo "=========================================="

log_info "This will create default sections for each workspace."
if ! confirm "Proceed with section seeding?"; then
    log_error "Migration cancelled by user"
    exit 1
fi

log_info "Running section seeding script..."
if psql "$PROD_DB_URL" < "$MIGRATION_DIR/04_seed_kb_sections.sql"; then
    log_success "KB sections seeded successfully"
else
    log_error "Section seeding failed"
    exit 1
fi

# ==============================================================================
# STEP 5: Import Legacy Data (Optional)
# ==============================================================================

echo ""
echo "=========================================="
echo "STEP 5: IMPORT LEGACY DATA (OPTIONAL)"
echo "=========================================="

log_warning "This step is optional and depends on whether you have legacy data."
if confirm "Do you have legacy ICP/Product/Competitor/Persona data to import?"; then
    log_info "Running legacy data import script..."
    if psql "$PROD_DB_URL" < "$MIGRATION_DIR/05_import_legacy_data.sql"; then
        log_success "Legacy data imported successfully"
    else
        log_error "Legacy data import failed (you can retry this step later)"
    fi
else
    log_info "Skipping legacy data import"
fi

# ==============================================================================
# STEP 6: Run Smoke Tests
# ==============================================================================

echo ""
echo "=========================================="
echo "STEP 6: SMOKE TESTS"
echo "=========================================="

log_info "Running automated smoke tests..."
if psql "$PROD_DB_URL" < "$MIGRATION_DIR/06_smoke_tests.sql" > smoke_test_results_${TIMESTAMP}.log 2>&1; then
    log_success "Smoke tests completed"
    log_info "Results saved to: smoke_test_results_${TIMESTAMP}.log"
else
    log_warning "Some smoke tests failed - review the log file"
fi

# ==============================================================================
# STEP 7: Manual Verification
# ==============================================================================

echo ""
echo "=========================================="
echo "STEP 7: MANUAL VERIFICATION REQUIRED"
echo "=========================================="

log_warning "Please perform the following manual tests:"
echo ""
echo "1. Log in to production application as a test user"
echo "2. Navigate to Knowledge Base section"
echo "3. Verify you can:"
echo "   - See existing KB entries for your workspace"
echo "   - Create a new KB entry"
echo "   - Edit an existing entry"
echo "   - Cannot see other workspace's entries"
echo "4. Check that sections are properly displayed"
echo "5. Test search functionality within KB"
echo ""

if ! confirm "Have you completed manual verification and everything works?"; then
    log_error "Migration not verified - investigate issues before proceeding"
    exit 1
fi

# ==============================================================================
# COMPLETION
# ==============================================================================

echo ""
echo "=========================================="
echo "✅ MIGRATION COMPLETED SUCCESSFULLY"
echo "=========================================="
echo ""
log_success "All migration steps completed"
log_info "Backup location: $BACKUP_FILE"
log_info "Smoke test results: smoke_test_results_${TIMESTAMP}.log"
echo ""
log_info "Next steps:"
echo "  1. Monitor application logs for any errors"
echo "  2. Keep the backup file safe for at least 7 days"
echo "  3. Monitor database performance metrics"
echo "  4. Notify team that migration is complete"
echo ""
log_warning "If you need to rollback, run: psql $PROD_DB_URL < $BACKUP_FILE"
echo ""