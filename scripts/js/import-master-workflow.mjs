#!/usr/bin/env node
/**
 * Import SAM Master Campaign Orchestrator to n8n Cloud
 * Includes all 6 messages: CR + FU1-4 + GB (Goodbye)
 */
import https from 'https'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
  console.log('🚀 Importing SAM Master Campaign Orchestrator to n8n Cloud\n')

  // Load workflow JSON
  const workflowPath = '/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator (3).json'
  console.log('📂 Loading workflow from:', workflowPath)

  let workflow
  try {
    workflow = JSON.parse(readFileSync(workflowPath, 'utf8'))
  } catch (error) {
    console.error('❌ Failed to read workflow file:', error.message)
    return
  }

  console.log('✅ Workflow loaded:', workflow.name)
  console.log(`   Nodes: ${workflow.nodes.length}`)
  console.log(`   Connections: ${Object.keys(workflow.connections).length}`)

  // Remove fields that n8n Cloud API doesn't accept
  delete workflow.id
  delete workflow.versionId
  delete workflow.meta
  delete workflow.tags
  delete workflow.active  // Let user activate manually
  delete workflow.pinData

  console.log('\n📤 Creating workflow in n8n Cloud...')

  try {
    const created = await httpsRequest('/workflows', 'POST', workflow)
    console.log('\n✅ MASTER WORKFLOW IMPORTED!\n')
    console.log('ID:', created.id)
    console.log('Name:', created.name)
    console.log('\n🔗 Webhook URL:')
    console.log(`https://${N8N_CLOUD_URL}/webhook/campaign-execute`)
    console.log('\n📋 Workflow includes:')
    console.log('   1. CR - Connection Request (immediate)')
    console.log('   2. FU1 - Follow-up 1 (after connection accepted + timing delay)')
    console.log('   3. FU2 - Follow-up 2')
    console.log('   4. FU3 - Follow-up 3')
    console.log('   5. FU4 - Follow-up 4')
    console.log('   6. GB - Goodbye message')
    console.log('\n⚠️  IMPORTANT: Workflow requires environment variables:')
    console.log('   - UNIPILE_DSN')
    console.log('   - SAM_API_URL (your app URL)')
    console.log('\n📋 Next Steps:')
    console.log('1. Go to n8n Cloud: https://innovareai.app.n8n.cloud/workflow/' + created.id)
    console.log('2. Set environment variables in workflow settings')
    console.log('3. Activate the workflow')
    console.log('4. Update .env.local to use webhook: campaign-execute')

  } catch (error) {
    console.error('\n❌ Error:', error.message)

    // Check if workflow already exists
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log('\n💡 Workflow may already exist. List existing workflows:')
      try {
        const workflows = await httpsRequest('/workflows')
        const existing = workflows.data.find(w => w.name === workflow.name)
        if (existing) {
          console.log('\n✅ Found existing workflow:')
          console.log('   ID:', existing.id)
          console.log('   URL: https://innovareai.app.n8n.cloud/workflow/' + existing.id)
          console.log('   Active:', existing.active)
        }
      } catch (listError) {
        console.error('   Failed to list workflows:', listError.message)
      }
    }
  }
}

main().catch(console.error)
