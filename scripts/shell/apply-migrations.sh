#!/bin/bash
# Apply Security & Workspace Migrations
# Run in order: 001 -> 006

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$PROJECT_ROOT/supabase/migrations"

# Load environment
if [ -f "$PROJECT_ROOT/.env.local" ]; then
  source "$PROJECT_ROOT/.env.local"
else
  echo "Error: .env.local not found"
  exit 1
fi

# Check required env vars
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: Missing Supabase credentials in .env.local"
  exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed 's/https:\/\/\(.*\)\.supabase\.co/\1/')

echo "=================================================="
echo "Applying Security & Workspace Migrations"
echo "=================================================="
echo ""
echo "Project: $PROJECT_REF"
echo "Migrations: $MIGRATIONS_DIR"
echo ""

# List of migrations to apply (in order)
MIGRATIONS=(
  "20251031000001_add_pii_encryption.sql"
  "20251031000002_add_gdpr_compliance.sql"
  "20251031000003_add_linkedin_url_validation.sql"
  "20251031000004_convert_to_single_user_workspaces.sql"
  "20251031000005_add_team_member_roles.sql"
  "20251031000006_workspace_split_utilities.sql"
)

# Function to apply migration via Supabase REST API
apply_migration() {
  local migration_file=$1
  local migration_path="$MIGRATIONS_DIR/$migration_file"

  echo "📄 Applying: $migration_file"

  if [ ! -f "$migration_path" ]; then
    echo "   ❌ File not found: $migration_path"
    return 1
  fi

  # Read SQL file
  SQL=$(cat "$migration_path")

  # Execute via Supabase REST API (using service role key)
  RESPONSE=$(curl -s -X POST \
    "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/exec_sql" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"sql\": $(echo "$SQL" | jq -Rs .)}" 2>&1)

  # Check if successful
  if echo "$RESPONSE" | grep -q "error"; then
    echo "   ❌ Failed: $RESPONSE"
    return 1
  else
    echo "   ✅ Success"
    return 0
  fi
}

# Apply each migration
echo "Starting migration process..."
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0

for migration in "${MIGRATIONS[@]}"; do
  if apply_migration "$migration"; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo ""
    echo "❌ Migration failed: $migration"
    echo "Stopping migration process."
    exit 1
  fi
  echo ""
done

echo "=================================================="
echo "Migration Summary"
echo "=================================================="
echo ""
echo "✅ Successful: $SUCCESS_COUNT"
echo "❌ Failed: $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo "🎉 All migrations applied successfully!"
  echo ""
  echo "Next steps:"
  echo "1. Verify encryption keys: SELECT COUNT(*) FROM workspace_encryption_keys;"
  echo "2. Check workspace types: SELECT workspace_type, COUNT(*) FROM workspaces GROUP BY workspace_type;"
  echo "3. Test GDPR workflow: Review docs/SECURITY_AND_WORKSPACE_IMPROVEMENTS_OCT_31_2025.md"
else
  echo "⚠️  Some migrations failed. Review errors above."
  exit 1
fi
