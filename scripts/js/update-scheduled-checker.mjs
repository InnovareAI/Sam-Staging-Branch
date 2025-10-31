#!/usr/bin/env node
/**
 * Update SAM Scheduled Campaign Checker - Fix splitOut node
 */
import https from 'https'
import { readFileSync } from 'fs'

const N8N_CLOUD_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwN2RlODBmNS1mNjk3LTRmMWQtYTA0NC1hNTE5YjlhMzc3NWMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxODgwMjI4fQ.qu4pgyKXHunfcKiNjx0dkRbtQZ51KmgoOFk2kQEsJ3U'
const N8N_CLOUD_URL = 'innovareai.app.n8n.cloud'
const WORKFLOW_ID = '7QJZcRwQBI0wPRS4'

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
  console.log('🔧 Fixing SAM Scheduled Campaign Checker - Replace splitOut with splitInBatches\n')

  const workflow = JSON.parse(readFileSync('/tmp/fix-split-node.json', 'utf8'))

  console.log('📤 Updating workflow...')

  const updatePayload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings
  }

  try {
    await httpsRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', updatePayload)
    console.log('✅ Workflow updated successfully!\n')
    console.log('🔍 Fixed Issue: Replaced splitOut node with splitInBatches')
    console.log('   - splitInBatches properly handles array splitting')
    console.log('   - Loop connection added to process all campaigns')
    console.log('\n📋 Next Steps:')
    console.log('1. Go to: https://innovareai.app.n8n.cloud/workflow/' + WORKFLOW_ID)
    console.log('2. Click "Execute Workflow" to test')
    console.log('3. Verify no parameter errors')
    console.log('4. Activate the workflow')
  } catch (error) {
    console.error('❌ Error updating workflow:', error.message)
  }
}

main().catch(console.error)
