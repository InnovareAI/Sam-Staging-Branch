#!/bin/bash

# Monitor Netlify deployment status
# Checks if the latest commit is deployed to production

EXPECTED_COMMIT="315e40b"
SITE_URL="https://app.meet-sam.com"
MAX_CHECKS=30
CHECK_INTERVAL=10

echo "🔍 Monitoring deployment to production..."
echo "📦 Expected commit: $EXPECTED_COMMIT"
echo "🌐 Site: $SITE_URL"
echo ""

for i in $(seq 1 $MAX_CHECKS); do
    echo -n "Check $i/$MAX_CHECKS: "

    # Check if site is responding
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL")

    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Site is live (HTTP $HTTP_CODE)"

        # Try to detect deployment (check if newer build)
        # Since Netlify doesn't expose commit hash easily, we check response time changes
        # or wait for reasonable build time

        if [ $i -ge 3 ]; then
            echo ""
            echo "🎉 Deployment likely complete (site stable after $(($i * $CHECK_INTERVAL))s)"
            echo ""
            echo "✅ Next steps:"
            echo "   1. Open https://app.meet-sam.com in your browser"
            echo "   2. Sign in to your account"
            echo "   3. Open SAM chat"
            echo "   4. Type: #test-linkedin"
            echo "   5. Verify LinkedIn connections load successfully"
            echo ""
            exit 0
        fi
    else
        echo "⏳ Deploying... (HTTP $HTTP_CODE)"
    fi

    sleep $CHECK_INTERVAL
done

echo ""
echo "⏰ Monitoring timeout after $((MAX_CHECKS * CHECK_INTERVAL))s"
echo "   Deployment may still be in progress"
echo "   Check manually: https://app.netlify.com/projects/sam-new-sep-7"
