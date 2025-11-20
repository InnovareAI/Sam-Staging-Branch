#!/bin/bash
# Update Inngest signing key after getting correct one from dashboard
# Usage: ./update-signing-key.sh "signkey-prod-XXXXX"

if [ -z "$1" ]; then
  echo "❌ Please provide the signing key from Inngest dashboard"
  echo "Usage: ./update-signing-key.sh \"signkey-prod-XXXXX\""
  exit 1
fi

SIGNING_KEY="$1"

echo "📝 Updating Inngest signing key..."

# Update .env.local
if grep -q "INNGEST_SIGNING_KEY=" .env.local; then
  sed -i.bak "s|INNGEST_SIGNING_KEY=.*|INNGEST_SIGNING_KEY=$SIGNING_KEY|" .env.local
  echo "✅ Updated .env.local"
else
  echo "INNGEST_SIGNING_KEY=$SIGNING_KEY" >> .env.local
  echo "✅ Added to .env.local"
fi

# Update Netlify production
echo "📤 Updating Netlify environment..."
netlify env:set INNGEST_SIGNING_KEY "$SIGNING_KEY"

echo ""
echo "✅ Signing key updated!"
echo ""
echo "Next steps:"
echo "1. Verify at: https://app.meet-sam.com/api/inngest"
echo "2. Check authentication_succeeded should be true"
echo "3. Test campaign execution"
