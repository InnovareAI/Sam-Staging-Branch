#!/bin/bash
echo "🧪 Testing LinkedIn Search Integration"
echo ""
echo "1️⃣ Check Connection:"
curl -s http://localhost:3000/api/linkedin/check-connection | jq '.'
echo ""
echo "2️⃣ Test Search (requires connected LinkedIn):"
curl -s -X POST http://localhost:3000/api/linkedin/search \
  -H "Content-Type: application/json" \
  -d '{"keywords": "VP Sales SaaS", "category": "people"}' | jq '.prospects[0:2]'
