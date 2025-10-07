#!/bin/bash
# Fix admin routes that are missing request parameter
# Run from project root: bash scripts/shell/fix-admin-request-params.sh

echo "🔧 Fixing request parameters in admin routes..."

# Find all admin routes
ADMIN_ROUTES=$(find app/api/admin -name "route.ts" -type f)

FIXED=0

for route in $ADMIN_ROUTES; do
  # Skip if already has proper request parameter with type
  if grep -q "export async function.*request:.*Request\|NextRequest" "$route"; then
    continue
  fi

  # Check if function has auth check but missing request param
  if grep -q "requireAdmin(request)" "$route"; then
    # Fix GET method
    if grep -q "export async function GET()" "$route"; then
      sed -i.bak 's/export async function GET()/export async function GET(request: Request)/' "$route"
      rm -f "$route.bak"
      echo "  ✓ Fixed GET in: $route"
      ((FIXED++))
    fi

    # Fix POST method
    if grep -q "export async function POST()" "$route"; then
      sed -i.bak 's/export async function POST()/export async function POST(request: Request)/' "$route"
      rm -f "$route.bak"
      echo "  ✓ Fixed POST in: $route"
      ((FIXED++))
    fi

    # Fix PUT method
    if grep -q "export async function PUT()" "$route"; then
      sed -i.bak 's/export async function PUT()/export async function PUT(request: Request)/' "$route"
      rm -f "$route.bak"
      echo "  ✓ Fixed PUT in: $route"
      ((FIXED++))
    fi

    # Fix DELETE method
    if grep -q "export async function DELETE()" "$route"; then
      sed -i.bak 's/export async function DELETE()/export async function DELETE(request: Request)/' "$route"
      rm -f "$route.bak"
      echo "  ✓ Fixed DELETE in: $route"
      ((FIXED++))
    fi

    # Fix PATCH method
    if grep -q "export async function PATCH()" "$route"; then
      sed -i.bak 's/export async function PATCH()/export async function PATCH(request: Request)/' "$route"
      rm -f "$route.bak"
      echo "  ✓ Fixed PATCH in: $route"
      ((FIXED++))
    fi
  fi
done

echo "
✅ Request parameter fixes completed!

📊 Fixed: $FIXED function signatures
"
