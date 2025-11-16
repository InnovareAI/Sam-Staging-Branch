#!/bin/bash

# Test enrichment API with Dhananjay Nair's prospect ID

echo "Testing enrichment API (N8N async workflow)..."
echo ""

curl -X POST https://app.meet-sam.com/api/prospects/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "prospectIds": ["prospect_1763274020862_q8c6q7ndz"],
    "workspaceId": "babdcab8-1a78-4b2f-913e-6e9fd9821009",
    "autoEnrich": true
  }' \
  | jq '.'

echo ""
echo "Expected response:"
echo "  - status: 'queued'"
echo "  - queued_count: 1"
echo "  - message: '🔄 Enriching 1 prospect(s) in background via N8N workflow.'"
echo ""
echo "Check enrichment_jobs table for job status:"
echo "  psql: SELECT id, status, processed_count, total_prospects FROM enrichment_jobs ORDER BY created_at DESC LIMIT 1;"
echo ""
echo "Check N8N workflow execution at: https://workflows.innovareai.com"
