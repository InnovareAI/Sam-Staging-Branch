/**
 * Direct Table Creation for Campaign System
 * Creates tables using direct API calls instead of migrations
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function createTablesDirectly() {
  console.log('🏗️  Creating campaign tables directly...')
  
  try {
    // First, let's check what tables already exist
    console.log('\n1️⃣ Checking existing tables...')
    const { data: existingTables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['campaigns', 'campaign_prospects'])

    if (tablesError) {
      console.log('ℹ️  Could not check existing tables, proceeding with creation...')
    } else {
      console.log('📋 Existing tables:', existingTables?.map(t => t.table_name) || [])
    }

    // Instead of using migrations, let's use a simpler approach
    // Create a test entry to see what tables exist and what's missing
    console.log('\n2️⃣ Testing campaigns table access...')
    
    const { data: campaignTest, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .limit(1)

    if (campaignError && campaignError.message.includes('does not exist')) {
      console.log('❌ Campaigns table does not exist')
      console.log('📝 We need to create the campaigns table through Supabase interface or contact admin')
      
      // For now, let's provide the SQL that needs to be executed
      console.log('\n📋 SQL to create campaigns table:')
      console.log(`
-- Execute this SQL in Supabase SQL Editor:

CREATE TABLE campaigns (
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

CREATE TABLE campaign_prospects (
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

-- Indexes
CREATE INDEX idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaign_prospects_campaign_id ON campaign_prospects(campaign_id);
CREATE INDEX idx_campaign_prospects_status ON campaign_prospects(status);

-- RLS Policies  
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for service role" ON campaigns FOR ALL USING (true);
CREATE POLICY "Enable all operations for service role" ON campaign_prospects FOR ALL USING (true);
      `)
      
    } else if (campaignError) {
      console.error('❌ Other campaigns table error:', campaignError.message)
    } else {
      console.log('✅ Campaigns table exists and is accessible')
    }

    console.log('\n3️⃣ Testing campaign_prospects table access...')
    
    const { data: prospectsTest, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('id')
      .limit(1)

    if (prospectsError && prospectsError.message.includes('does not exist')) {
      console.log('❌ Campaign prospects table does not exist')
    } else if (prospectsError) {
      console.error('❌ Other prospects table error:', prospectsError.message)
    } else {
      console.log('✅ Campaign prospects table exists and is accessible')
    }

    // Alternative: Try to use an admin API endpoint to create tables
    console.log('\n4️⃣ Alternative: Create using admin API...')
    
    const adminApiUrl = `${SUPABASE_URL}/rest/v1/rpc/create_campaign_tables`
    const response = await fetch(adminApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({})
    })

    if (response.ok) {
      console.log('✅ Tables created via admin API')
    } else {
      const errorText = await response.text()
      console.log('❌ Admin API method not available:', errorText)
    }

    console.log('\n🎯 Next steps:')
    console.log('1. Copy the SQL above and run it in Supabase SQL Editor')
    console.log('2. Or contact admin to create the tables')
    console.log('3. Then retry the Charissa campaign upload')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the table creation
createTablesDirectly().then(() => {
  console.log('\n🎯 Table creation check complete')
}).catch(error => {
  console.error('❌ Table creation check failed:', error)
})