#!/usr/bin/env node
/**
 * Configure SAM Master Campaign Orchestrator with actual API endpoints
 * Replaces $env references with actual values from .env.local
 */
import https from 'https'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const N8N_CLOUD_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwN2RlODBmNS1mNjk3LTRmMWQtYTA0NC1hNTE5YjlhMzc3NWMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxODgwMjI4fQ.qu4pgyKXHunfcKiNjx0dkRbtQZ51KmgoOFk2kQEsJ3U'
const N8N_CLOUD_URL = 'innovareai.app.n8n.cloud'
const WORKFLOW_ID = '2bmFPN5t2y6A4Rx2'

// Load environment variables
const envPath = join(__dirname, '../../.env.local')
const envContent = readFileSync(envPath, 'utf8')

function getEnvValue(key) {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return match ? match[1].trim() : null
}

const UNIPILE_DSN = getEnvValue('UNIPILE_DSN')
const SAM_API_URL = getEnvValue('NEXT_PUBLIC_SITE_URL')

console.log('🔧 Configuration values:')
console.log('   UNIPILE_DSN:', UNIPILE_DSN)
console.log('   SAM_API_URL:', SAM_API_URL)
console.log()

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
  console.log('🚀 Configuring SAM Master Campaign Orchestrator\n')

  // Get current workflow
  console.log('📥 Fetching workflow...')
  const workflow = await httpsRequest(`/workflows/${WORKFLOW_ID}`)
  console.log('✅ Workflow fetched:', workflow.name)
  console.log(`   Nodes: ${workflow.nodes.length}`)

  // Update nodes that reference environment variables
  let updatedCount = 0

  workflow.nodes.forEach(node => {
    if (node.parameters?.url) {
      let url = node.parameters.url
      let updated = false

      // Replace $env.UNIPILE_DSN with actual value
      if (url.includes('$env.UNIPILE_DSN')) {
        url = url.replace('$env.UNIPILE_DSN', `https://${UNIPILE_DSN}`)
        updated = true
      }

      // Replace $env.SAM_API_URL with actual value
      if (url.includes('$env.SAM_API_URL')) {
        url = url.replace('$env.SAM_API_URL', SAM_API_URL)
        updated = true
      }

      if (updated) {
        node.parameters.url = url
        updatedCount++
        console.log(`   ✓ Updated node: ${node.name}`)
      }
    }
  })

  console.log(`\n📝 Updated ${updatedCount} nodes\n`)

  // Update workflow
  console.log('📤 Updating workflow...')

  // Only send allowed fields for update
  const updatePayload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings
  }

  try {
    await httpsRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', updatePayload)
    console.log('✅ Workflow updated successfully!\n')
    console.log('📋 Next Steps:')
    console.log('1. Go to: https://innovareai.app.n8n.cloud/workflow/' + WORKFLOW_ID)
    console.log('2. Verify the node configurations look correct')
    console.log('3. Activate the workflow')
    console.log('4. Test with a campaign')
  } catch (error) {
    console.error('❌ Error updating workflow:', error.message)
  }
}

main().catch(console.error)
