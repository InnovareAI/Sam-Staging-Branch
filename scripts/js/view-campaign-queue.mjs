#!/usr/bin/env node
/**
 * View Campaign Queue
 * Shows all prospects currently queued in n8n with timing information
 */
import https from 'https'

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'

console.log('📊 Campaign Queue Viewer\n')

function supabaseRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}${endpoint}`)

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.end()
  })
}

async function main() {
  // Get all queued prospects
  const prospects = await supabaseRequest(
    '/rest/v1/campaign_prospects?status=eq.queued_in_n8n&select=id,campaign_id,first_name,last_name,linkedin_url,personalization_data,campaigns(name,campaign_type)'
  )

  if (!prospects || prospects.length === 0) {
    console.log('✅ No prospects in queue - all clear!\n')
    return
  }

  console.log(`🔄 ${prospects.length} prospect(s) currently queued:\n`)

  // Group by campaign
  const byCampaign = {}
  prospects.forEach(p => {
    const campaignName = p.campaigns?.name || 'Unknown Campaign'
    if (!byCampaign[campaignName]) {
      byCampaign[campaignName] = []
    }
    byCampaign[campaignName].push(p)
  })

  // Display each campaign's queue
  for (const [campaignName, campaignProspects] of Object.entries(byCampaign)) {
    console.log(`📋 Campaign: ${campaignName}`)
    console.log(`   Type: ${campaignProspects[0].campaigns?.campaign_type || 'unknown'}`)
    console.log(`   Queued: ${campaignProspects.length} prospect(s)\n`)

    campaignProspects.forEach((p, idx) => {
      const queuedAt = p.personalization_data?.queued_at
      const delayMinutes = p.personalization_data?.send_delay_minutes
      const executionId = p.personalization_data?.n8n_execution_id
      const patternIndex = p.personalization_data?.pattern_index

      console.log(`   ${idx + 1}. ${p.first_name} ${p.last_name}`)
      console.log(`      LinkedIn: ${p.linkedin_url}`)
      console.log(`      Queued at: ${queuedAt ? new Date(queuedAt).toLocaleString() : 'unknown'}`)

      if (delayMinutes !== undefined) {
        const queuedTime = new Date(queuedAt)
        const estimatedSend = new Date(queuedTime.getTime() + delayMinutes * 60000)
        const now = new Date()
        const minutesUntilSend = Math.round((estimatedSend - now) / 60000)

        console.log(`      Delay: ${delayMinutes} minutes (pattern position: ${patternIndex})`)
        console.log(`      Estimated send: ${estimatedSend.toLocaleString()}`)

        if (minutesUntilSend > 0) {
          console.log(`      ⏰ Sending in: ${minutesUntilSend} minutes`)
        } else {
          console.log(`      ⚠️  Should have sent ${Math.abs(minutesUntilSend)} minutes ago`)
        }
      }

      if (executionId) {
        console.log(`      N8N Execution: ${executionId}`)
      }
      console.log()
    })
  }

  // Summary
  console.log('📊 Summary:')
  console.log(`   Total in queue: ${prospects.length}`)
  console.log(`   Campaigns affected: ${Object.keys(byCampaign).length}`)

  // Next check
  const oldestQueued = prospects.reduce((oldest, p) => {
    const queuedAt = new Date(p.personalization_data?.queued_at)
    return !oldest || queuedAt < oldest ? queuedAt : oldest
  }, null)

  if (oldestQueued) {
    const hoursInQueue = Math.round((new Date() - oldestQueued) / 3600000)
    console.log(`   Oldest in queue: ${hoursInQueue} hours`)
  }

  console.log('\n🔍 To view in Supabase:')
  console.log('   https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog')
  console.log('   → Table Editor → campaign_prospects → Filter: status = queued_in_n8n')

  console.log('\n🔍 To view in N8N:')
  console.log('   https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2')
  console.log('   → Executions tab → Look for webhook mode executions')
}

main().catch(console.error)
