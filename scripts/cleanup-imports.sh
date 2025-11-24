#!/bin/bash

# Clean up unused cookies imports from fixed files

echo "🧹 Cleaning unused imports..."

files=$(grep -r "import { createSupabaseRouteClient }" app/api --include="*.ts" -l)

for file in $files; do
  if grep -q "import.*cookies.*from 'next/headers'" "$file"; then
    sed -i '' "/import.*cookies.*from 'next\/headers'/d" "$file"
    echo "  Cleaned: $file"
  fi
done

echo "✅ Cleanup complete"
