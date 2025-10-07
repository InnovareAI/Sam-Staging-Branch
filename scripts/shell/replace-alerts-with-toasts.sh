#!/bin/bash
# Replace alert() calls with toast() notifications
# Run from project root: bash scripts/shell/replace-alerts-with-toasts.sh

echo "🔄 Replacing alert() calls with toast() notifications..."

# Find all files with alert() calls
FILES=$(grep -rl "\\balert(" app components --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null)

REPLACED=0
TOTAL=0

for file in $FILES; do
  if [ ! -f "$file" ]; then
    continue
  fi

  # Count alerts in this file
  COUNT=$(grep -o "\\balert(" "$file" | wc -l)
  TOTAL=$((TOTAL + COUNT))

  echo "Processing: $file ($COUNT alerts)"

  # Backup original
  cp "$file" "$file.alert-backup"

  # Check if file already imports toast
  if ! grep -q "import.*toast" "$file"; then
    # Add toast import after existing imports
    if grep -q "^import" "$file"; then
      # Add after last import
      awk '
        /^import/ { imports = imports $0 "\n"; next }
        !added && !/^import/ && NF {
          print imports "import { toastSuccess, toastError, toastWarning, toastInfo } from '\''@/lib/toast'\'';\n"
          added = 1
        }
        { print }
      ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    else
      # No imports, add at top
      echo "import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';" > "$file.tmp"
      cat "$file" >> "$file.tmp"
      mv "$file.tmp" "$file"
    fi
  fi

  # Replace alert() calls with toastError() - default to error type
  # Pattern 1: alert('message')
  sed -i.bak "s/alert(\s*'\([^']*\)'\s*)/toastError('\1')/g" "$file"

  # Pattern 2: alert("message")
  sed -i.bak 's/alert(\s*"\([^"]*\)"\s*)/toastError("\1")/g' "$file"

  # Pattern 3: alert(variable)
  sed -i.bak 's/alert(\s*\([a-zA-Z_][a-zA-Z0-9_]*\)\s*)/toastError(\1)/g' "$file"

  # Pattern 4: alert(`template string`)
  sed -i.bak 's/alert(\s*`\([^`]*\)`\s*)/toastError(`\1`)/g' "$file"

  # Clean up backup files
  rm -f "$file.bak"

  # Check if any replacements were made
  if ! cmp -s "$file" "$file.alert-backup"; then
    ((REPLACED++))
    echo "  ✓ Replaced $COUNT alert(s)"
  else
    echo "  ℹ No changes needed"
    rm "$file.alert-backup"
  fi
done

echo "
✅ Alert replacement completed!

📊 Summary:
   Files processed: $REPLACED files
   Total alerts replaced: $TOTAL

⚠️  IMPORTANT NEXT STEPS:
1. Review changes with: git diff
2. Some alerts may need manual type adjustment:
   - toastSuccess() for success messages
   - toastWarning() for warnings
   - toastInfo() for informational messages
3. Add <ToastContainer /> to root layout if not present
4. Test toasts in browser
5. Delete *.alert-backup files when verified

🔍 Backup files: *.alert-backup
"
