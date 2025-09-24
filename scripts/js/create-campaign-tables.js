/**
 * Create Campaign Tables for Charissa Campaign System
 * Creates the missing campaigns and campaign_prospects tables
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function createCampaignTables() {
  console.log('🏗️  Creating campaign tables for Charissa campaign system...')
  
  try {
    // Create campaigns table
    console.log('\n1️⃣ Creating campaigns table...')
    const { data: campaignsTableResult, error: campaignsTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS campaigns (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          campaign_type TEXT DEFAULT 'linkedin_only',
          status TEXT DEFAULT 'draft',
          channel_preferences JSONB DEFAULT '{"email": false, "linkedin": true}',
          linkedin_config JSONB,
          email_config JSONB,
          n8n_execution_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          started_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE
        );
      `
    })

    if (campaignsTableError) {
      console.error('❌ Failed to create campaigns table:', campaignsTableError.message)
    } else {
      console.log('✅ Campaigns table created successfully')
    }

    // Create campaign_prospects table
    console.log('\n2️⃣ Creating campaign_prospects table...')
    const { data: prospectsTableResult, error: prospectsTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS campaign_prospects (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT,
          company_name TEXT,
          linkedin_url TEXT,
          linkedin_user_id TEXT,
          title TEXT,
          phone TEXT,
          location TEXT,
          industry TEXT,
          status TEXT DEFAULT 'pending',
          notes TEXT,
          personalization_data JSONB DEFAULT '{}',
          n8n_execution_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          contacted_at TIMESTAMP WITH TIME ZONE,
          responded_at TIMESTAMP WITH TIME ZONE
        );
      `
    })

    if (prospectsTableError) {
      console.error('❌ Failed to create campaign_prospects table:', prospectsTableError.message)
    } else {
      console.log('✅ Campaign prospects table created successfully')
    }

    // Create indexes for better performance
    console.log('\n3️⃣ Creating indexes...')
    const { data: indexResult, error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
        CREATE INDEX IF NOT EXISTS idx_campaign_prospects_campaign_id ON campaign_prospects(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_campaign_prospects_status ON campaign_prospects(status);
        CREATE INDEX IF NOT EXISTS idx_campaign_prospects_linkedin_user_id ON campaign_prospects(linkedin_user_id);
      `
    })

    if (indexError) {
      console.warn('⚠️  Warning: Some indexes may not have been created:', indexError.message)
    } else {
      console.log('✅ Indexes created successfully')
    }

    // Test the tables
    console.log('\n4️⃣ Testing table functionality...')
    
    // Test campaigns table
    const testCampaign = {
      workspace_id: 'charissa-workspace',
      name: 'Charissa - LinkedIn Founder Outreach',
      description: 'LinkedIn-only campaign targeting early-stage founders',
      campaign_type: 'linkedin_only',
      status: 'draft',
      channel_preferences: {
        email: false,
        linkedin: true
      },
      linkedin_config: {
        account_id: 'he3RXnROSLuhONxgNle7dw',
        connection_message: 'Hi {first_name}, I work for InnovareAI...'
      }
    }

    const { data: campaignTest, error: campaignTestError } = await supabase
      .from('campaigns')
      .insert([testCampaign])
      .select('id')
      .single()

    if (campaignTestError) {
      console.error('❌ Campaign table test failed:', campaignTestError.message)
      return
    }

    console.log('✅ Campaign table test passed:', campaignTest.id)

    // Test campaign_prospects table
    const testProspect = {
      campaign_id: campaignTest.id,
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
      notes: 'Test prospect',
      personalization_data: {
        source: 'table_creation_test',
        created_at: new Date().toISOString()
      }
    }

    const { data: prospectTest, error: prospectTestError } = await supabase
      .from('campaign_prospects')
      .insert([testProspect])
      .select('id')

    if (prospectTestError) {
      console.error('❌ Prospect table test failed:', prospectTestError.message)
      return
    }

    console.log('✅ Prospect table test passed:', prospectTest[0].id)

    // Clean up test data
    console.log('\n5️⃣ Cleaning up test data...')
    await supabase.from('campaigns').delete().eq('id', campaignTest.id)
    console.log('✅ Test data cleaned up')

    console.log('\n🎉 All campaign tables created and tested successfully!')
    console.log('🚀 Charissa campaign system is now ready for use!')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the table creation
createCampaignTables().then(() => {
  console.log('\n🎯 Table creation complete')
}).catch(error => {
  console.error('❌ Table creation failed:', error)
})