#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '../../.env.local')

console.log('🔧 Updating .env.local with n8n Cloud settings\n')

let env = readFileSync(envPath, 'utf8')

// Update n8n settings
env = env.replace(
  /N8N_INSTANCE_URL=.*/,
  'N8N_INSTANCE_URL=https://innovareai.app.n8n.cloud'
)

env = env.replace(
  /N8N_API_BASE_URL=.*/,
  'N8N_API_BASE_URL=https://innovareai.app.n8n.cloud'
)

env = env.replace(
  /N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[^\\n]+/g,
  'N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwN2RlODBmNS1mNjk3LTRmMWQtYTA0NC1hNTE5YjlhMzc3NWMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxODgwMjI4fQ.qu4pgyKXHunfcKiNjx0dkRbtQZ51KmgoOFk2kQEsJ3U'
)

env = env.replace(
  /N8N_CAMPAIGN_WEBHOOK_URL=.*/,
  'N8N_CAMPAIGN_WEBHOOK_URL=https://innovareai.app.n8n.cloud/webhook/campaign-execute'
)

writeFileSync(envPath, env)

console.log('✅ Updated .env.local:')
console.log('   N8N_INSTANCE_URL: https://innovareai.app.n8n.cloud')
console.log('   N8N_CAMPAIGN_WEBHOOK_URL: https://innovareai.app.n8n.cloud/webhook/campaign-execute')
console.log('   N8N_API_KEY: [UPDATED]')
