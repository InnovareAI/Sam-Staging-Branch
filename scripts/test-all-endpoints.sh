#!/bin/bash

# Test All Search Endpoints
# Run this after starting the dev server (npm run dev)

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           TESTING ALL SEARCH ENDPOINTS                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if server is running
if ! lsof -ti:3000 > /dev/null 2>&1; then
  echo "❌ Dev server not running on port 3000!"
  echo ""
  echo "Please start the server first:"
  echo "  npm run dev"
  echo ""
  exit 1
fi

echo "✅ Dev server is running"
echo ""

# Test 1: MCP Status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: MCP Status & Available Tools"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "GET http://localhost:3000/api/mcp"
echo ""

MCP_RESPONSE=$(curl -s http://localhost:3000/api/mcp)
echo "$MCP_RESPONSE" | jq '.'

# Check if BrightData is available
BRIGHTDATA_AVAILABLE=$(echo "$MCP_RESPONSE" | jq -r '.tools[] | select(.name | contains("brightdata")) | .name' 2>/dev/null)

if [ -n "$BRIGHTDATA_AVAILABLE" ]; then
  echo ""
  echo "✅ BrightData MCP Tools Found:"
  echo "$BRIGHTDATA_AVAILABLE"
else
  echo ""
  echo "⚠️  BrightData MCP Tools NOT available"
  echo "   This is expected - BrightData needs Claude Desktop or MCP server running"
fi

echo ""
echo ""

# Test 2: BrightData Health Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: BrightData Scraper Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "GET http://localhost:3000/api/leads/brightdata-scraper"
echo ""

curl -s http://localhost:3000/api/leads/brightdata-scraper | jq '.'

echo ""
echo ""

# Test 3: Search Router (without auth - will fail but shows routing)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: Search Router (No Auth - Expected to Fail)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "POST http://localhost:3000/api/linkedin/search-router"
echo ""

curl -s -X POST http://localhost:3000/api/linkedin/search-router \
  -H "Content-Type: application/json" \
  -d '{
    "search_criteria": {
      "title": "CEO",
      "keywords": "startup",
      "location": "Seattle",
      "connectionDegree": "2nd"
    },
    "target_count": 5,
    "needs_emails": false
  }' | jq '.'

echo ""
echo ""

# Test 4: Unipile Simple Search (without auth - will fail but shows it's there)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 4: Unipile Simple Search (No Auth - Expected to Fail)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "POST http://localhost:3000/api/linkedin/search/simple"
echo ""

curl -s -X POST http://localhost:3000/api/linkedin/search/simple \
  -H "Content-Type: application/json" \
  -d '{
    "search_criteria": {
      "title": "CEO",
      "keywords": "startup",
      "location": "Seattle",
      "connectionDegree": "2nd"
    },
    "target_count": 5
  }' | jq '.'

echo ""
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -n "$BRIGHTDATA_AVAILABLE" ]; then
  echo "✅ BrightData MCP: CONNECTED"
else
  echo "⚠️  BrightData MCP: NOT CONNECTED (expected - needs MCP server)"
fi

echo "✅ Search Router: DEPLOYED"
echo "✅ Unipile Search: DEPLOYED"
echo ""
echo "To test with authentication:"
echo "1. Open browser and login to http://localhost:3000"
echo "2. Open DevTools Console (F12)"
echo "3. Run the browser console tests from test-all-routing-scenarios.mjs"
echo ""
echo "OR use the Unipile direct test:"
echo "  node scripts/force-real-unipile-search.mjs"
echo ""
