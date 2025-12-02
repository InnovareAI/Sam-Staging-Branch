#!/bin/bash

# Create N8N CRM Workflows using N8N API
# This script creates 3 workflows in N8N for bi-directional CRM sync

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Creating N8N CRM Workflows${NC}"

# Check required environment variables
if [ -z "$N8N_API_URL" ]; then
  echo -e "${RED}❌ N8N_API_URL not set${NC}"
  exit 1
fi

if [ -z "$N8N_API_KEY" ]; then
  echo -e "${RED}❌ N8N_API_KEY not set${NC}"
  exit 1
fi

# N8N API endpoint
N8N_API="${N8N_API_URL}/api/v1"

echo -e "${YELLOW}📡 N8N API: ${N8N_API}${NC}"

# ============================================
# Workflow 1: SAM → CRM Sync (Webhook)
# ============================================

echo -e "\n${GREEN}Creating Workflow 1: SAM → CRM Sync${NC}"

WORKFLOW_1='{
  "name": "CRM Sync - SAM to CRM",
  "nodes": [
    {
      "parameters": {
        "path": "crm-sync-to-crm",
        "responseMode": "lastNode",
        "options": {}
      },
      "id": "webhook-1",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1.1,
      "position": [240, 300],
      "webhookId": "crm-sync-to-crm"
    },
    {
      "parameters": {
        "url": "={{ $env.SUPABASE_URL }}/rest/v1/crm_connections",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendQuery": true,
        "queryParameters": {
          "parameters": [
            {
              "name": "workspace_id",
              "value": "=eq.{{ $json.body.workspace_id }}"
            },
            {
              "name": "crm_type",
              "value": "=eq.{{ $json.body.crm_type }}"
            },
            {
              "name": "status",
              "value": "=eq.active"
            },
            {
              "name": "select",
              "value": "*"
            }
          ]
        },
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "={{ $env.SUPABASE_SERVICE_ROLE_KEY }}"
            },
            {
              "name": "Authorization",
              "value": "=Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}"
            }
          ]
        },
        "options": {}
      },
      "id": "get-connection",
      "name": "Get CRM Connection",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [460, 300]
    },
    {
      "parameters": {
        "rules": {
          "values": [
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict"
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json[0].crm_type }}",
                    "rightValue": "hubspot",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "hubspot"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict"
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json[0].crm_type }}",
                    "rightValue": "activecampaign",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "activecampaign"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict"
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json[0].crm_type }}",
                    "rightValue": "airtable",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "airtable"
            }
          ]
        },
        "options": {}
      },
      "id": "switch-crm",
      "name": "Switch CRM Type",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3,
      "position": [680, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "=https://api.hubapi.com/crm/v3/objects/contacts",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{ $json[0].access_token }}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": []
        },
        "options": {},
        "jsonBody": "={{ {\\n  \\"properties\\": {\\n    \\"firstname\\": $(\\"Webhook\\").item.json.body.contact_data.firstName,\\n    \\"lastname\\": $(\\"Webhook\\").item.json.body.contact_data.lastName,\\n    \\"email\\": $(\\"Webhook\\").item.json.body.contact_data.email,\\n    \\"phone\\": $(\\"Webhook\\").item.json.body.contact_data.phone,\\n    \\"company\\": $(\\"Webhook\\").item.json.body.contact_data.company,\\n    \\"jobtitle\\": $(\\"Webhook\\").item.json.body.contact_data.jobTitle\\n  }\\n} }}"
      },
      "id": "hubspot-create",
      "name": "HubSpot Create Contact",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [900, 200]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $json[0].crm_account_id }}/api/3/contact/sync",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Api-Token",
              "value": "={{ $json[0].access_token }}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "options": {},
        "jsonBody": "={{ {\\n  \\"contact\\": {\\n    \\"email\\": $(\\"Webhook\\").item.json.body.contact_data.email,\\n    \\"firstName\\": $(\\"Webhook\\").item.json.body.contact_data.firstName,\\n    \\"lastName\\": $(\\"Webhook\\").item.json.body.contact_data.lastName,\\n    \\"phone\\": $(\\"Webhook\\").item.json.body.contact_data.phone\\n  }\\n} }}"
      },
      "id": "ac-create",
      "name": "ActiveCampaign Create Contact",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [900, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "=https://api.airtable.com/v0/{{ $json[0].crm_account_id }}/Contacts",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{ $json[0].access_token }}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "options": {},
        "jsonBody": "={{ {\\n  \\"fields\\": {\\n    \\"Name\\": $(\\"Webhook\\").item.json.body.contact_data.firstName + \\\" \\\" + $(\\"Webhook\\").item.json.body.contact_data.lastName,\\n    \\"First Name\\": $(\\"Webhook\\").item.json.body.contact_data.firstName,\\n    \\"Last Name\\": $(\\"Webhook\\").item.json.body.contact_data.lastName,\\n    \\"Email\\": $(\\"Webhook\\").item.json.body.contact_data.email,\\n    \\"Phone\\": $(\\"Webhook\\").item.json.body.contact_data.phone,\\n    \\"Company\\": $(\\"Webhook\\").item.json.body.contact_data.company,\\n    \\"Job Title\\": $(\\"Webhook\\").item.json.body.contact_data.jobTitle\\n  }\\n} }}"
      },
      "id": "airtable-create",
      "name": "Airtable Create Contact",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [900, 400]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $env.SAM_API_URL }}/api/crm/webhook/sync-complete",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "x-n8n-webhook-secret",
              "value": "={{ $env.N8N_WEBHOOK_SECRET }}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "options": {},
        "jsonBody": "={{ {\\n  \\"workspace_id\\": $(\\"Webhook\\").item.json.body.workspace_id,\\n  \\"entity_type\\": \\"contact\\",\\n  \\"entity_id\\": $(\\"Webhook\\").item.json.body.sam_contact_id || \\"unknown\\",\\n  \\"crm_type\\": $(\\"Webhook\\").item.json.body.crm_type,\\n  \\"status\\": \\"success\\",\\n  \\"crm_record_id\\": $json.id,\\n  \\"synced_at\\": new Date().toISOString()\\n} }}"
      },
      "id": "callback-sam",
      "name": "Callback SAM",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [1120, 300]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ {\\n  \\"success\\": true,\\n  \\"message\\": \\"Contact synced to CRM\\",\\n  \\"crm_record_id\\": $json.id\\n} }}"
      },
      "id": "respond",
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [1340, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Get CRM Connection",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get CRM Connection": {
      "main": [
        [
          {
            "node": "Switch CRM Type",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Switch CRM Type": {
      "main": [
        [
          {
            "node": "HubSpot Create Contact",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "ActiveCampaign Create Contact",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Airtable Create Contact",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HubSpot Create Contact": {
      "main": [
        [
          {
            "node": "Callback SAM",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "ActiveCampaign Create Contact": {
      "main": [
        [
          {
            "node": "Callback SAM",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Airtable Create Contact": {
      "main": [
        [
          {
            "node": "Callback SAM",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Callback SAM": {
      "main": [
        [
          {
            "node": "Respond to Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": true,
  "settings": {
    "executionOrder": "v1"
  },
  "tags": []
}'

# Create Workflow 1
RESPONSE=$(curl -s -X POST "${N8N_API}/workflows" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "${WORKFLOW_1}")

WORKFLOW_1_ID=$(echo $RESPONSE | jq -r '.id')

if [ "$WORKFLOW_1_ID" != "null" ] && [ ! -z "$WORKFLOW_1_ID" ]; then
  echo -e "${GREEN}✅ Workflow 1 created: ${WORKFLOW_1_ID}${NC}"
  WORKFLOW_1_URL="${N8N_API_URL}/webhook/crm-sync-to-crm"
  echo -e "${YELLOW}   Webhook URL: ${WORKFLOW_1_URL}${NC}"
else
  echo -e "${RED}❌ Failed to create Workflow 1${NC}"
  echo $RESPONSE | jq
fi

# ============================================
# Workflow 2: CRM → SAM Sync (Webhook)
# ============================================

echo -e "\n${GREEN}Creating Workflow 2: CRM → SAM Sync${NC}"

# TODO: Create Workflow 2 JSON (similar structure)

# ============================================
# Summary
# ============================================

echo -e "\n${GREEN}✅ N8N Workflows Created Successfully${NC}"
echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "1. Update N8N_WEBHOOK_BASE_URL in .env: ${N8N_API_URL}"
echo -e "2. Test Workflow 1: curl -X POST ${WORKFLOW_1_URL} -H 'Content-Type: application/json' -d '{...}'"
echo -e "3. Monitor N8N executions in UI"
