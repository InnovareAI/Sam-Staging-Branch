#!/bin/bash

# Test Inngest Setup Script
# This script verifies that all Inngest components are properly configured

echo "🧪 Testing Inngest Setup..."
echo ""

# Check if required files exist
echo "1. Checking files..."
files=(
  "lib/inngest/client.ts"
  "app/api/inngest/route.ts"
  "inngest/functions/connector-campaign.ts"
  "inngest/functions/campaign-cron.ts"
  "lib/campaign-randomizer.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (missing)"
  fi
done

echo ""

# Check if Inngest is installed
echo "2. Checking Inngest package..."
if grep -q '"inngest"' package.json; then
  echo "  ✅ Inngest package installed"
else
  echo "  ❌ Inngest package not found"
  echo "  Run: npm install inngest"
fi

echo ""

# Check if Unipile SDK is installed
echo "3. Checking Unipile SDK..."
if grep -q '"unipile-node-sdk"' package.json; then
  echo "  ✅ Unipile SDK installed"
else
  echo "  ❌ Unipile SDK not found"
  echo "  Run: npm install unipile-node-sdk"
fi

echo ""

# Check environment variables
echo "4. Checking environment variables..."
required_vars=(
  "UNIPILE_DSN"
  "UNIPILE_API_KEY"
  "NEXT_PUBLIC_SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
)

for var in "${required_vars[@]}"; do
  if [ -n "${!var}" ]; then
    echo "  ✅ $var"
  else
    echo "  ⚠️  $var (not set in current shell)"
  fi
done

echo ""

# Check Inngest-specific env vars
echo "5. Checking Inngest environment variables..."
inngest_vars=(
  "INNGEST_SIGNING_KEY"
  "INNGEST_EVENT_KEY"
)

for var in "${inngest_vars[@]}"; do
  if [ -n "${!var}" ]; then
    echo "  ✅ $var"
  else
    echo "  ❌ $var (required - get from https://app.inngest.com)"
  fi
done

echo ""

# Check if TypeScript compiles
echo "6. Checking TypeScript compilation..."
if npx tsc --noEmit --skipLibCheck 2>&1 | grep -q "error TS"; then
  echo "  ⚠️  TypeScript errors found (this is OK if they're unrelated)"
else
  echo "  ✅ No TypeScript errors"
fi

echo ""
echo "================================================"
echo "Setup Summary"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Get Inngest keys from https://app.inngest.com"
echo "2. Add to .env.local:"
echo "   INNGEST_SIGNING_KEY=your-key"
echo "   INNGEST_EVENT_KEY=your-key"
echo ""
echo "3. Install Inngest CLI:"
echo "   npm install -g inngest-cli"
echo ""
echo "4. Start Inngest dev server:"
echo "   inngest-cli dev"
echo ""
echo "5. Start Next.js:"
echo "   npm run dev"
echo ""
echo "6. Test with a campaign!"
echo ""
