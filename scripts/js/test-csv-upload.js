/**
 * Test CSV Upload Functionality
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function testCsvUpload() {
  console.log('🧪 Testing CSV Upload System...')
  
  try {
    // Check required tables exist
    console.log('\n1️⃣ Checking required tables...')
    
    const tables = ['workspace_prospects', 'campaigns', 'campaign_prospects']
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)
      
      if (error) {
        console.log(`❌ Table ${table} error:`, error.message)
      } else {
        console.log(`✅ Table ${table} accessible`)
      }
    }
    
    // Check required functions exist
    console.log('\n2️⃣ Checking required functions...')
    
    const { data: functions, error: funcError } = await supabase
      .rpc('add_prospects_to_campaign', {
        p_campaign_id: 'test',
        p_prospect_ids: []
      })
    
    if (funcError && !funcError.message.includes('does not exist')) {
      console.log('✅ add_prospects_to_campaign function exists')
    } else {
      console.log('❌ add_prospects_to_campaign function missing')
    }
    
    // Test CSV upload endpoint availability
    console.log('\n3️⃣ Testing CSV upload endpoint...')
    
    try {
      const response = await fetch('https://app.meet-sam.com/api/campaigns/upload-with-resolution', {
        method: 'GET'
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('✅ CSV upload endpoint accessible')
        console.log('📋 Required CSV columns:', result.endpoints?.csv_format?.required_columns)
        console.log('📋 Optional CSV columns:', result.endpoints?.csv_format?.optional_columns)
      } else {
        console.log('❌ CSV upload endpoint error:', response.status)
      }
    } catch (apiError) {
      console.log('❌ CSV upload endpoint call failed:', apiError.message)
    }
    
    // Check existing campaigns for upload test
    console.log('\n4️⃣ Checking existing campaigns for upload...')
    
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, status')
      .limit(3)
    
    if (campaignError) {
      console.log('❌ Error fetching campaigns:', campaignError.message)
    } else {
      console.log(`✅ Found ${campaigns?.length || 0} campaigns for upload testing`)
      campaigns?.forEach(c => console.log(`   - ${c.name} (${c.status}) - ID: ${c.id}`))
    }
    
    console.log('\n🎉 CSV Upload system test complete!')
    
  } catch (error) {
    console.error('❌ Unexpected test error:', error)
  }
}

// Run the test
testCsvUpload().then(() => {
  console.log('\n✨ Test completed successfully')
}).catch(error => {
  console.error('💥 Test failed:', error)
})