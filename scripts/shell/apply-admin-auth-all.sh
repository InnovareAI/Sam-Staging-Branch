#!/bin/bash
# Apply authentication to ALL admin routes automatically
# Run from project root: bash scripts/shell/apply-admin-auth-all.sh

echo "🔒 Applying authentication to ALL admin routes..."

# Find all admin routes
ADMIN_ROUTES=$(find app/api/admin -name "route.ts" -type f)

# Counter
PROTECTED=0
SKIPPED=0
FAILED=0

# Backup directory
mkdir -p .admin-routes-backup

for route in $ADMIN_ROUTES; do
  echo "Processing: $route"

  # Check if already has auth
  if grep -q "requireAdmin\|requireAuth" "$route"; then
    echo "  ℹ Already protected, skipping"
    ((SKIPPED++))
    continue
  fi

  # Backup original
  cp "$route" ".admin-routes-backup/$(basename $(dirname $route))_route.ts.backup"

  # Read the file content
  CONTENT=$(cat "$route")

  # Check if it has imports section
  if echo "$CONTENT" | grep -q "^import"; then
    # Add requireAdmin import after existing imports
    awk '
      /^import/ { imports = imports $0 "\n"; next }
      !imports_added && !/^import/ && NF {
        print imports "import { requireAdmin } from '\''@/lib/security/route-auth'\'';\n"
        imports_added = 1
      }
      { print }
    ' "$route" > "$route.tmp" && mv "$route.tmp" "$route"
  else
    # No imports, add at top
    echo "import { requireAdmin } from '@/lib/security/route-auth';" > "$route.tmp"
    cat "$route" >> "$route.tmp"
    mv "$route.tmp" "$route"
  fi

  # Add auth check to each HTTP method (GET, POST, PUT, DELETE, PATCH)
  for method in GET POST PUT DELETE PATCH; do
    if grep -q "export async function $method" "$route"; then
      # Add auth check after function declaration
      sed -i.bak "/export async function $method/a\\
\\
  // Require admin authentication\\
  const { error: authError } = await requireAdmin(request);\\
  if (authError) return authError;\\
" "$route"
      rm -f "$route.bak"
      echo "  ✓ Added auth to $method method"
    fi
  done

  ((PROTECTED++))
done

echo "
✅ Admin route protection completed!

📊 Summary:
   Protected: $PROTECTED routes
   Skipped:   $SKIPPED routes (already protected)
   Failed:    $FAILED routes

⚠️  IMPORTANT NEXT STEPS:
1. Review changes with: git diff app/api/admin
2. Test key admin routes manually
3. Run: npm run dev (check for compilation errors)
4. If all good, commit changes
5. Delete .admin-routes-backup/ when verified

🔍 Backup location: .admin-routes-backup/
"
