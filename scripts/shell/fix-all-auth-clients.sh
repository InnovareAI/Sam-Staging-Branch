#!/bin/bash
# Fix all remaining old auth-helpers client imports

set -e

echo "🔧 Fixing all auth client imports..."

# Fix client components (createClientComponentClient)
find app -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' \
  's/import { createClientComponentClient } from .@supabase\/auth-helpers-nextjs./import { createClient } from '\''@\/app\/lib\/supabase'\'';/g' {} +

find app -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' \
  's/const supabase = createClientComponentClient()/const supabase = createClient()/g' {} +

# Fix route handlers (createRouteHandlerClient)
find app/api -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' \
  's/import { createRouteHandlerClient } from .@supabase\/auth-helpers-nextjs./import { createServerSupabaseClient } from '\''@\/app\/lib\/supabase'\'';/g' {} +

find app/api -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' \
  's/createRouteHandlerClient({ cookies })/await createServerSupabaseClient()/g' {} +

find app/api -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' \
  's/createRouteHandlerClient()/await createServerSupabaseClient()/g' {} +

echo "✅ All auth clients fixed!"
echo "📋 Files modified:"
git status --short | grep "^ M"
