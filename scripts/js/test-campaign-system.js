/**
 * Test Campaign System Database Tables
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function testCampaignSystem() {
  console.log('🧪 Testing Campaign System Database Tables...')
  
  try {
    // Test campaigns table
    console.log('\n1️⃣ Testing campaigns table...')
    const { data: campaignTest, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, status')
      .limit(3)

    if (campaignError) {
      console.log('❌ Campaigns table error:', campaignError.message)
    } else {
      console.log('✅ Campaigns table accessible')
      console.log(`📊 Found ${campaignTest?.length || 0} existing campaigns`)
      if (campaignTest?.length > 0) {
        campaignTest.forEach(c => console.log(`   - ${c.name} (${c.status})`))
      }
    }

    // Test campaign_prospects table
    console.log('\n2️⃣ Testing campaign_prospects table...')
    const { data: prospectsTest, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, status')
      .limit(3)

    if (prospectsError) {
      console.log('❌ Campaign prospects table error:', prospectsError.message)
    } else {
      console.log('✅ Campaign prospects table accessible')
      console.log(`📊 Found ${prospectsTest?.length || 0} existing prospects`)
      if (prospectsTest?.length > 0) {
        prospectsTest.forEach(p => console.log(`   - ${p.first_name} ${p.last_name} (${p.status})`))
      }
    }

    // Test creating a test campaign
    console.log('\n3️⃣ Testing campaign creation...')
    const testCampaignName = `Test Campaign ${Date.now()}`
    const { data: newCampaign, error: createError } = await supabase
      .from('campaigns')
      .insert([{
        workspace_id: 'test-workspace',
        name: testCampaignName,
        description: 'Test campaign for system verification',
        campaign_type: 'linkedin_only',
        status: 'draft',
        channel_preferences: { email: false, linkedin: true },
        linkedin_config: {
          connection_message: 'Hi {first_name}, test message.',
          linkedin_account_id: 'he3RXnROSLuhONxgNle7dw'
        }
      }])
      .select()
      .single()

    if (createError) {
      console.log('❌ Campaign creation error:', createError.message)
    } else {
      console.log('✅ Campaign creation successful')
      console.log(`📝 Created campaign: ${newCampaign.name} (ID: ${newCampaign.id})`)
      
      // Test adding prospects to the campaign
      console.log('\n4️⃣ Testing prospect creation...')
      const { data: newProspects, error: prospectError } = await supabase
        .from('campaign_prospects')
        .insert([
          {
            campaign_id: newCampaign.id,
            first_name: 'Test',
            last_name: 'Prospect',
            email: 'test@example.com',
            company_name: 'Test Company',
            linkedin_url: 'https://linkedin.com/in/test-prospect',
            title: 'Test Title',
            status: 'pending'
          }
        ])
        .select()

      if (prospectError) {
        console.log('❌ Prospect creation error:', prospectError.message)
      } else {
        console.log('✅ Prospect creation successful')
        console.log(`👥 Created ${newProspects?.length || 0} prospects`)
        
        // Now test the campaign execution endpoint
        console.log('\n5️⃣ Testing campaign execution API...')
        try {
          const response = await fetch('https://app.meet-sam.com/api/campaigns/charissa/execute', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              campaign_id: newCampaign.id,
              execution_preferences: {
                batch_size: 1,
                delay_between_requests: 5,
                max_daily_requests: 5,
                start_immediately: false // Just test, don't actually execute
              }
            })
          })

          const result = await response.json()
          
          if (result.success) {
            console.log('✅ Campaign execution API responded successfully')
            console.log('🎯 Response:', {
              campaign_id: result.campaign_id,
              prospects_processed: result.execution_details?.prospects_processed,
              linkedin_account: result.execution_details?.linkedin_account_id
            })
          } else {
            console.log('❌ Campaign execution API error:', result.error)
            console.log('🔍 Details:', result.details)
          }
        } catch (apiError) {
          console.log('❌ Campaign execution API call failed:', apiError.message)
        }
      }
      
      // Clean up test data
      console.log('\n6️⃣ Cleaning up test data...')
      await supabase.from('campaign_prospects').delete().eq('campaign_id', newCampaign.id)
      await supabase.from('campaigns').delete().eq('id', newCampaign.id)
      console.log('🧹 Test data cleaned up')
    }

    console.log('\n🎉 Campaign system test complete!')
    
  } catch (error) {
    console.error('❌ Unexpected test error:', error)
  }
}

// Run the test
testCampaignSystem().then(() => {
  console.log('\n✨ Test completed successfully')
}).catch(error => {
  console.error('💥 Test failed:', error)
})