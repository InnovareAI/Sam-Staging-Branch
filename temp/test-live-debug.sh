#!/bin/bash

echo "🔍 Testing live DEBUG endpoint (requires no auth)..."
echo ""

curl -s "https://app.meet-sam.com/api/debug/approval-data" | jq '.'

echo ""
echo "✅ If you see sessions above, backend is working"
echo "❌ If you see 404, deployment hasn't gone live yet"
