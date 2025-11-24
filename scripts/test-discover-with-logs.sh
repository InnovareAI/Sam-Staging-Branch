#!/bin/bash

echo "🔍 Testing discover-profile-posts API with logging..."
echo ""
echo "Watch the terminal running 'npm run dev' to see detailed logs"
echo ""
echo "Making API request..."

curl -X POST http://localhost:3000/api/linkedin-commenting/discover-profile-posts \
  -H "Content-Type: application/json" \
  2>/dev/null | jq .

echo ""
echo "Check the dev server terminal for detailed logs!"