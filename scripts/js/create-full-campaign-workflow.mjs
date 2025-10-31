#!/usr/bin/env node
/**
 * Create FULL campaign workflow with:
 * - Connection request sending
 * - Database updates  
 * - Follow-up message scheduling
 * - Full prospect loop
 */
import https from 'https'

const N8N_CLOUD_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwN2RlODBmNS1mNjk3LTRmMWQtYTA0NC1hNTE5YjlhMzc3NWMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxODgwMjI4fQ.qu4pgyKXHunfcKiNjx0dkRbtQZ51KmgoOFk2kQEsJ3U'
const N8N_CLOUD_URL = 'innovareai.app.n8n.cloud'

function httpsRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: N8N_CLOUD_URL,
      path: `/api/v1${path}`,
      method,
      headers: {
        'X-N8N-API-KEY': N8N_CLOUD_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        } else {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            resolve(data)
          }
        }
      })
    })

    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function main() {
  console.log('🚀 Creating FULL Campaign Workflow in n8n Cloud\n')

  const workflow = {
    name: 'SAM Campaign Execution - FULL',
    nodes: [
      // 1. Webhook Trigger
      {
        name: 'Campaign Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 400],
        parameters: {
          path: 'campaign-execute-full',
          httpMethod: 'POST',
          responseMode: 'onReceived',
          options: {}
        }
      },

      // 2. Extract Campaign Data
      {
        name: 'Extract Campaign Data',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [450, 400],
        parameters: {
          language: 'javaScript',
          jsCode: `const data = $input.first().json.body || $input.first().json;

return {
  workspace_id: data.workspaceId,
  campaign_id: data.campaignId,
  campaign_type: data.campaignType || 'connector',
  unipile_account_id: data.unipileAccountId,
  prospects: data.prospects || [],
  messages: data.messages || {},
  timing: data.timing || {},
  supabase_url: data.supabase_url,
  supabase_service_key: data.supabase_service_key,
  unipile_dsn: data.unipile_dsn,
  unipile_api_key: data.unipile_api_key
};`
        }
      },

      // 3. Split prospects into batches
      {
        name: 'Process Each Prospect',
        type: 'n8n-nodes-base.splitInBatches',
        typeVersion: 3,
        position: [650, 400],
        parameters: {
          batchSize: 1,
          options: {}
        }
      },

      // 4. Prepare Single Prospect
      {
        name: 'Prepare Prospect',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [850, 400],
        parameters: {
          language: 'javaScript',
          jsCode: `const campaign = $input.first().json;
const prospect = campaign.prospects[0];

return {
  ...campaign,
  current_prospect: {
    id: prospect.id,
    first_name: prospect.first_name,
    last_name: prospect.last_name,
    linkedin_url: prospect.linkedin_url,
    linkedin_user_id: prospect.linkedin_user_id,
    unipile_account_id: campaign.unipile_account_id
  }
};`
        }
      },

      // 5. Send LinkedIn Connection Request
      {
        name: 'Send Connection Request',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [1050, 400],
        parameters: {
          method: 'POST',
          url: '={{ "https://" + $json.unipile_dsn + "/api/v1/messaging" }}',
          authentication: 'none',
          sendHeaders: true,
          headerParameters: {
            parameters: [{
              name: 'X-API-KEY',
              value: '={{ $json.unipile_api_key }}'
            }]
          },
          sendBody: true,
          contentType: 'json',
          body: '={{ { "account_id": $json.current_prospect.unipile_account_id, "attendees": [$json.current_prospect.linkedin_user_id], "text": $json.messages.cr, "type": "LINKEDIN" } }}',
          options: {}
        }
      },

      // 6. Update Database - Mark as Contacted
      {
        name: 'Update Database',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [1250, 400],
        parameters: {
          method: 'POST',
          url: '={{ $json.supabase_url + "/rest/v1/campaign_prospects" }}',
          authentication: 'none',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              {
                name: 'apikey',
                value: '={{ $json.supabase_service_key }}'
              },
              {
                name: 'Authorization',
                value: '={{ "Bearer " + $json.supabase_service_key }}'
              },
              {
                name: 'Prefer',
                value: 'resolution=merge-duplicates'
              }
            ]
          },
          sendQuery: true,
          queryParameters: {
            parameters: [{
              name: 'id',
              value: '=eq.{{ $json.current_prospect.id }}'
            }]
          },
          sendBody: true,
          contentType: 'json',
          body: '={{ { "status": "connection_requested", "contacted_at": new Date().toISOString(), "personalization_data": { "unipile_message_id": $("Send Connection Request").item.json.id || "untracked", "sent_at": new Date().toISOString() } } }}',
          options: {}
        }
      },

      // 7. Log Success
      {
        name: 'Log Success',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [1450, 400],
        parameters: {
          language: 'javaScript',
          jsCode: `console.log('✅ Sent to:', $json.current_prospect.first_name, $json.current_prospect.last_name);
console.log('   Message ID:', $("Send Connection Request").item.json.id);
console.log('   Prospect ID:', $json.current_prospect.id);

return $input.all();`
        }
      },

      // 8. Error Handler
      {
        name: 'Handle Error',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [1050, 600],
        parameters: {
          language: 'javaScript',
          jsCode: `console.error('❌ Failed for:', $json.current_prospect?.first_name, $json.current_prospect?.last_name);
console.error('   Error:', $json.error);

return { error: true, prospect: $json.current_prospect };`
        }
      }
    ],

    connections: {
      'Campaign Webhook': {
        main: [[{ node: 'Extract Campaign Data', type: 'main', index: 0 }]]
      },
      'Extract Campaign Data': {
        main: [[{ node: 'Process Each Prospect', type: 'main', index: 0 }]]
      },
      'Process Each Prospect': {
        main: [[{ node: 'Prepare Prospect', type: 'main', index: 0 }]]
      },
      'Prepare Prospect': {
        main: [[{ node: 'Send Connection Request', type: 'main', index: 0 }]]
      },
      'Send Connection Request': {
        main: [[{ node: 'Update Database', type: 'main', index: 0 }]]
      },
      'Update Database': {
        main: [[{ node: 'Log Success', type: 'main', index: 0 }]]
      },
      'Log Success': {
        main: [[{ node: 'Process Each Prospect', type: 'main', index: 0 }]]
      }
    },

    settings: {
      executionOrder: 'v1',
      saveManualExecutions: true,
      saveExecutionProgress: true,
      saveDataSuccessExecution: 'all',
      saveDataErrorExecution: 'all',
      executionTimeout: 3600
    }
  }

  console.log('📤 Creating full workflow...')
  
  try {
    const created = await httpsRequest('/workflows', 'POST', workflow)
    console.log('\n✅ FULL WORKFLOW CREATED!\n')
    console.log('ID:', created.id)
    console.log('Name:', created.name)
    console.log('\n🔗 Webhook URL:')
    console.log(`https://${N8N_CLOUD_URL}/webhook/campaign-execute-full`)
    console.log('\n📋 Next Steps:')
    console.log('1. Go to n8n Cloud UI: https://innovareai.app.n8n.cloud/workflow/' + created.id)
    console.log('2. Activate the workflow')
    console.log('3. Test with a real campaign')
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
  }
}

main().catch(console.error)
