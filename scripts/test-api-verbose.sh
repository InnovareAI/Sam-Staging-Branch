#!/bin/bash

echo "Testing API and showing server logs..."
echo "Make sure npm run dev is running!"
echo ""

# Clear database first
node scripts/clear-all-posts.js

echo ""
echo "Making API request..."
echo ""

# Make the request
response=$(curl -s -X POST http://localhost:3000/api/linkedin-commenting/discover-profile-posts \
  -H "Content-Type: application/json")

echo "Response:"
echo "$response" | jq .

echo ""
echo "✅ Check the terminal running 'npm run dev' for detailed logs"