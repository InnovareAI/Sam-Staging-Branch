#!/bin/bash
# Add poll-message-replies cron job to cron-job.org
#
# Usage: ./add-reply-polling-cron.sh YOUR_CRONJOB_API_KEY
#
# Get your API key from: https://console.cron-job.org/settings
# Under "API" section, click "Generate API Key"

API_KEY="$1"

if [ -z "$API_KEY" ]; then
    echo "❌ Missing API key"
    echo "Usage: ./add-reply-polling-cron.sh YOUR_CRONJOB_API_KEY"
    echo ""
    echo "Get your API key from: https://console.cron-job.org/settings"
    exit 1
fi

echo "🔧 Adding poll-message-replies cron job..."

# Create the job via cron-job.org API
# Schedule: Every 15 minutes (minutes 0, 15, 30, 45)
response=$(curl -s -X PUT \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d '{
        "job": {
            "title": "SAM - Poll Message Replies",
            "url": "https://app.meet-sam.com/api/cron/poll-message-replies",
            "enabled": true,
            "saveResponses": true,
            "requestMethod": 1,
            "extendedData": {
                "headers": {
                    "x-cron-secret": "792e0c09eeee1a229b78a6341739613177fad24f401b1c82f2673bbb9ee806a0"
                }
            },
            "schedule": {
                "timezone": "America/New_York",
                "expiresAt": 0,
                "hours": [-1],
                "mdays": [-1],
                "minutes": [0, 15, 30, 45],
                "months": [-1],
                "wdays": [-1]
            }
        }
    }' \
    https://api.cron-job.org/jobs)

# Check response
if echo "$response" | grep -q '"jobId"'; then
    job_id=$(echo "$response" | grep -o '"jobId":[0-9]*' | cut -d: -f2)
    echo "✅ Cron job created successfully!"
    echo "   Job ID: $job_id"
    echo "   URL: https://app.meet-sam.com/api/cron/poll-message-replies"
    echo "   Schedule: Every 15 minutes"
    echo ""
    echo "View job: https://console.cron-job.org/jobs"
else
    echo "❌ Failed to create cron job"
    echo "Response: $response"
    exit 1
fi
