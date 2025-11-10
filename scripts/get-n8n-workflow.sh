#!/bin/bash

curl -s 'https://workflows.innovareai.com/api/v1/workflows/iKIchXBOT7ahhIwa' \
  -H 'X-N8N-API-KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMzE4MzU5fQ.ZlCEWESXrba8QESYWGCwE9IVczctJCflnF7iyf0OysQ' \
  > /tmp/n8n-workflow-iKIchXBOT7ahhIwa.json

echo "Workflow saved to /tmp/n8n-workflow-iKIchXBOT7ahhIwa.json"

# Extract HTTP nodes with UNIPILE_DSN
cat /tmp/n8n-workflow-iKIchXBOT7ahhIwa.json | jq '.data.nodes[] | select(.parameters.url? and (.parameters.url | tostring | contains("UNIPILE_DSN"))) | {name: .name, url: .parameters.url}'
