#!/bin/bash

# Script to fix broken auth client across all API routes
# Replaces deprecated createRouteHandlerClient with createSupabaseRouteClient

echo "🔧 Fixing auth client in all API routes..."

# Read all files that need fixing
files=$(grep -r "createRouteHandlerClient" app/api --include="*.ts" -l)

count=0
for file in $files; do
  echo "  Fixing: $file"

  # Replace the import statement
  sed -i '' "s/import { createRouteHandlerClient } from '@supabase\/auth-helpers-nextjs';/import { createSupabaseRouteClient } from '@\/lib\/supabase-route-client';/g" "$file"

  # Replace the client creation - handle both sync and async patterns
  # Pattern 1: const supabase = createRouteHandlerClient({ cookies: () => cookies() });
  sed -i '' "s/const supabase = createRouteHandlerClient({ cookies: () => cookies() });/const supabase = await createSupabaseRouteClient();/g" "$file"

  # Pattern 2: const supabase = createRouteHandlerClient({ cookies });
  sed -i '' "s/const supabase = createRouteHandlerClient({ cookies });/const supabase = await createSupabaseRouteClient();/g" "$file"

  # Pattern 3: Multi-line pattern
  sed -i '' "s/createRouteHandlerClient({$/await createSupabaseRouteClient();/g" "$file"

  count=$((count + 1))
done

echo "✅ Fixed $count files"
echo ""
echo "⚠️  Note: Some files may need manual adjustment if they use complex patterns"
echo "🔍 Please review the changes with: git diff"
