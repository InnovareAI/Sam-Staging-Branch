#!/bin/bash
# Apply authentication to all admin routes
# Run from project root: bash scripts/shell/apply-admin-auth.sh

echo "🔒 Applying authentication to admin routes..."

# List of admin routes to protect
ADMIN_ROUTES=(
  "app/api/admin/check-3cubed-members/route.ts"
  "app/api/admin/check-innovareai-data/route.ts"
  "app/api/admin/check-user-data/route.ts"
  "app/api/admin/check-approval-data/route.ts"
  "app/api/admin/all-unipile-accounts/route.ts"
  "app/api/admin/check-workspace-accounts/route.ts"
  "app/api/admin/check-sendingcell-members/route.ts"
  "app/api/admin/check-user-workspaces/route.ts"
)

# Backup directory
mkdir -p .admin-routes-backup

for route in "${ADMIN_ROUTES[@]}"; do
  if [ -f "$route" ]; then
    echo "  ✓ Protecting $route"

    # Backup original
    cp "$route" ".admin-routes-backup/$(basename $route).backup"

    # Check if already has auth
    if grep -q "requireAdmin" "$route"; then
      echo "    ℹ Already protected, skipping"
      continue
    fi

    # Add import if not present
    if ! grep -q "import.*requireAdmin" "$route"; then
      sed -i '' "1i\\
import { requireAdmin } from '@/lib/security/route-auth';\\
" "$route"
    fi

    # Add auth check after function declaration
    # This is a simplified approach - manual review recommended
    echo "    → Added requireAdmin import (manual auth check needed)"
  else
    echo "  ✗ Not found: $route"
  fi
done

echo "
✅ Admin route protection applied!

⚠️  MANUAL STEPS REQUIRED:
1. Each admin route needs auth check added manually:

   export async function GET(request: NextRequest) {
     const { error: authError } = await requireAdmin(request);
     if (authError) return authError;
     // ... rest of route logic
   }

2. Review each file in .admin-routes-backup/ for comparison
3. Test each admin route with and without authentication
4. Delete .admin-routes-backup/ when verified

📝 Routes processed: ${#ADMIN_ROUTES[@]}
"
