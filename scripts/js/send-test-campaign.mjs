#!/usr/bin/env node
/**
 * Send test campaign data to n8n Master Campaign Orchestrator
 */
import https from 'https'

const N8N_WEBHOOK_URL = 'https://innovareai.app.n8n.cloud/webhook/campaign-execute'

// Test campaign data
const testPayload = {
  workspaceId: 'test_workspace_' + Date.now(),
  campaignId: 'test_campaign_' + Date.now(),
  unipileAccountId: 'test_account_123',
  prospects: [
    {
      id: 'prospect_001',
      first_name: 'Test',
      last_name: 'User',
      linkedin_url: 'https://linkedin.com/in/testuser',
      linkedin_user_id: 'testuser'
    }
  ],
  messages: {
    cr: 'Hi Test, I would love to connect and discuss our AI solutions!',
    fu1: 'Following up on my connection request. Would love to chat!',
    fu2: 'Hope you are doing well. Still interested in connecting.',
    fu3: 'Just checking in - would be great to connect.',
    fu4: 'One more follow up - looking forward to connecting!',
    gb: 'Thanks for considering. Best of luck with your initiatives!'
  },
  timing: {
    fu1_delay_days: 2,
    fu2_delay_days: 5,
    fu3_delay_days: 7,
    fu4_delay_days: 5,
    gb_delay_days: 7
  },
  supabase_url: 'https://latxadqrvrrrcvkktrog.supabase.co',
  supabase_service_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ',
  unipile_dsn: 'api6.unipile.com:13670',
  unipile_api_key: 'aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU='
}

console.log('🚀 Sending test campaign to n8n Master Campaign Orchestrator\n')
console.log('📤 Webhook URL:', N8N_WEBHOOK_URL)
console.log('👤 Test Prospect:', testPayload.prospects[0].first_name, testPayload.prospects[0].last_name)
console.log('📝 Messages: CR + 5 follow-ups')
console.log()

const url = new URL(N8N_WEBHOOK_URL)

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}

const req = https.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    console.log('📥 Response Status:', res.statusCode)
    console.log('📥 Response Body:', data)

    if (res.statusCode === 200) {
      console.log('\n✅ Test campaign sent successfully!')
      console.log('\n📋 Next Steps:')
      console.log('1. Go to: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2')
      console.log('2. Check execution logs')
      console.log('3. Verify workflow processed the test data')
      console.log('4. Check for any errors in the nodes')
    } else {
      console.log('\n❌ Test campaign failed!')
      console.log('Response:', data)
    }
  })
})

req.on('error', (error) => {
  console.error('❌ Error sending test campaign:', error.message)
})

req.write(JSON.stringify(testPayload))
req.end()
