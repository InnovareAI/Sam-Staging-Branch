#!/bin/bash

N8N_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMzE4MzU5fQ.ZlCEWESXrba8QESYWGCwE9IVczctJCflnF7iyf0OysQ"

echo "🔍 Fetching funnel workflow details..."
echo ""

curl -s "https://workflows.innovareai.com/api/v1/workflows/aVG6LC4ZFRMN7Bw6" \
  -H "X-N8N-API-KEY: $N8N_KEY" \
  -H "Accept: application/json" > /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/temp/funnel-workflow.json

echo "✅ Workflow saved to temp/funnel-workflow.json"
echo ""
echo "📋 Workflow Summary:"
cat /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/temp/funnel-workflow.json | jq '{name: .name, active: .active, nodes: (.nodes | length)}'
