/**
 * Debug Database Error - Charissa Campaign Setup
 * Checks database connectivity and table structure
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function debugDatabaseError() {
  console.log('🔍 Debugging database error for Charissa campaign setup...')
  
  try {
    // Test 1: Basic connection test
    console.log('\n1️⃣ Testing basic database connection...')
    const { data: connectionTest, error: connectionError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (connectionError) {
      console.error('❌ Connection failed:', connectionError.message)
      return
    }
    console.log('✅ Database connection working')

    // Test 2: Check if campaigns table exists
    console.log('\n2️⃣ Checking campaigns table...')
    const { data: campaignsTest, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id')
      .limit(1)
    
    if (campaignsError) {
      console.error('❌ Campaigns table error:', campaignsError.message)
      console.log('📝 Creating campaigns table might be needed')
    } else {
      console.log('✅ Campaigns table exists')
    }

    // Test 3: Check if campaign_prospects table exists  
    console.log('\n3️⃣ Checking campaign_prospects table...')
    const { data: prospectsTest, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('id')
      .limit(1)
    
    if (prospectsError) {
      console.error('❌ Campaign prospects table error:', prospectsError.message)
      console.log('📝 Creating campaign_prospects table might be needed')
    } else {
      console.log('✅ Campaign prospects table exists')
    }

    // Test 4: Try to create a test campaign (the actual operation that's failing)
    console.log('\n4️⃣ Testing campaign creation (simulating Charissa setup)...')
    
    const testCampaign = {
      workspace_id: 'charissa-workspace-test',
      name: 'Test Campaign - Debug',
      description: 'Test campaign for debugging',
      campaign_type: 'linkedin_only',
      status: 'draft',
      channel_preferences: {
        email: false,
        linkedin: true
      },
      linkedin_config: {
        account_id: 'he3RXnROSLuhONxgNle7dw',
        connection_message: 'Test message'
      }
    }

    const { data: campaignResult, error: campaignCreateError } = await supabase
      .from('campaigns')
      .insert([testCampaign])
      .select('id')
      .single()

    if (campaignCreateError) {
      console.error('❌ Campaign creation failed:', campaignCreateError.message)
      console.error('🔍 Details:', campaignCreateError)
      
      // Check if it's a column issue
      if (campaignCreateError.message.includes('column') || campaignCreateError.message.includes('does not exist')) {
        console.log('\n📋 Checking campaigns table schema...')
        const { data: tableInfo, error: schemaError } = await supabase.rpc('get_table_schema', { table_name: 'campaigns' })
        if (schemaError) {
          console.log('❌ Could not get table schema:', schemaError.message)
        } else {
          console.log('📊 Campaigns table columns:', tableInfo)
        }
      }
    } else {
      console.log('✅ Test campaign created successfully:', campaignResult.id)
      
      // Clean up test campaign
      await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignResult.id)
      console.log('🧹 Test campaign cleaned up')
    }

    // Test 5: Test prospect insertion  
    if (campaignResult?.id) {
      console.log('\n5️⃣ Testing prospect insertion...')
      
      const testProspect = {
        campaign_id: campaignResult.id,
        first_name: 'Test',
        last_name: 'Prospect',
        email: '',
        company_name: 'Test Company',
        linkedin_url: 'https://linkedin.com/in/test',
        title: '',
        phone: '',
        location: '',
        industry: '',
        status: 'pending',
        notes: 'Test prospect for debugging',
        personalization_data: {
          source: 'debug_test',
          uploaded_at: new Date().toISOString()
        }
      }

      const { data: prospectResult, error: prospectError } = await supabase
        .from('campaign_prospects')
        .insert([testProspect])
        .select('id')

      if (prospectError) {
        console.error('❌ Prospect insertion failed:', prospectError.message)
        console.error('🔍 Details:', prospectError)
      } else {
        console.log('✅ Test prospect created successfully')
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error during debugging:', error)
  }
}

// Run the debug
debugDatabaseError().then(() => {
  console.log('\n🎯 Debug complete')
}).catch(error => {
  console.error('❌ Debug script failed:', error)
})