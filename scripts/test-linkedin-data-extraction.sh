#!/bin/bash

# Test LinkedIn Search Data Extraction
# This script tests that company, industry, and connection degree are properly extracted

echo "🧪 Testing LinkedIn Search Data Extraction"
echo "=========================================="
echo ""

# Check if server is running
if ! curl -s http://localhost:3000/api/version > /dev/null 2>&1; then
    echo "❌ Server is not running. Please start with: npm run dev"
    exit 1
fi

echo "✅ Server is running"
echo ""

# Test 1: Basic search with location filter
echo "📍 Test 1: Search with location filter (San Francisco)"
echo "Expected: Should show location IDs being looked up"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:3000/api/linkedin/search/simple \
  -H "Content-Type: application/json" \
  -d '{
    "search_criteria": {
      "keywords": "software engineer",
      "location": "San Francisco",
      "connectionDegree": "2nd"
    },
    "target_count": 5
  }')

echo "Response:"
echo "$RESPONSE" | jq '.count, .prospects[0] | {firstName, lastName, company, industry, title, location, connectionDegree}'
echo ""

# Test 2: Search with company filter
echo "🏢 Test 2: Search with company filter (Google)"
echo "Expected: Should show company IDs being looked up"
echo ""

RESPONSE2=$(curl -s -X POST http://localhost:3000/api/linkedin/search/simple \
  -H "Content-Type: application/json" \
  -d '{
    "search_criteria": {
      "keywords": "product manager",
      "company": "Google",
      "connectionDegree": "1st"
    },
    "target_count": 5
  }')

echo "Response:"
echo "$RESPONSE2" | jq '.count, .prospects[0] | {firstName, lastName, company, industry, title, connectionDegree}'
echo ""

# Test 3: Combined filters
echo "🎯 Test 3: Combined filters (Location + Company + Industry + Connection Degree)"
echo "Expected: All filters should be applied and data should be present"
echo ""

RESPONSE3=$(curl -s -X POST http://localhost:3000/api/linkedin/search/simple \
  -H "Content-Type: application/json" \
  -d '{
    "search_criteria": {
      "keywords": "VP Sales",
      "location": "New York",
      "company": "Salesforce",
      "industry": "Software",
      "connectionDegree": "2nd"
    },
    "target_count": 5
  }')

echo "Response:"
echo "$RESPONSE3" | jq '.count, .prospects[0:3] | .[] | {name: .fullName, company, industry, title, location, connectionDegree}'
echo ""

# Check for missing data
echo "🔍 Checking for Missing Data Issues:"
echo "-----------------------------------"
echo ""

MISSING_COMPANY=$(echo "$RESPONSE" "$RESPONSE2" "$RESPONSE3" | jq -r '.prospects[] | select(.company == "" or .company == null) | .fullName' | wc -l | tr -d ' ')
MISSING_INDUSTRY=$(echo "$RESPONSE" "$RESPONSE2" "$RESPONSE3" | jq -r '.prospects[] | select(.industry == "" or .industry == null) | .fullName' | wc -l | tr -d ' ')
MISSING_DEGREE=$(echo "$RESPONSE" "$RESPONSE2" "$RESPONSE3" | jq -r '.prospects[] | select(.connectionDegree == null) | .fullName' | wc -l | tr -d ' ')

if [ "$MISSING_COMPANY" -gt 0 ]; then
    echo "⚠️  Found $MISSING_COMPANY prospects with missing company data"
else
    echo "✅ All prospects have company data"
fi

if [ "$MISSING_INDUSTRY" -gt 0 ]; then
    echo "⚠️  Found $MISSING_INDUSTRY prospects with missing industry data"
else
    echo "✅ All prospects have industry data"
fi

if [ "$MISSING_DEGREE" -gt 0 ]; then
    echo "⚠️  Found $MISSING_DEGREE prospects with missing connection degree"
else
    echo "✅ All prospects have connection degree"
fi

echo ""
echo "📊 Summary Statistics:"
echo "---------------------"
echo "Test 1 Results: $(echo "$RESPONSE" | jq -r '.count // 0') prospects found"
echo "Test 2 Results: $(echo "$RESPONSE2" | jq -r '.count // 0') prospects found"
echo "Test 3 Results: $(echo "$RESPONSE3" | jq -r '.count // 0') prospects found"
echo ""

# Check server logs for the detailed field information
echo "💡 To see detailed extraction logs, check your server console for:"
echo "   - 🔵 Available fields in first item"
echo "   - 📌 Extracted company from headline"
echo "   - 🎯 Connection degree filter"
echo ""
echo "✅ Tests complete!"
