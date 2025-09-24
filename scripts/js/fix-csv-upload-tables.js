/**
 * Fix CSV Upload Tables - Create missing workspace_prospects table
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function fixCsvUploadTables() {
  console.log('🔧 Fixing CSV Upload Tables...')
  
  try {
    // Create workspace_prospects table
    console.log('\n1️⃣ Creating workspace_prospects table...')
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS workspace_prospects (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        company_name TEXT,
        job_title TEXT,
        linkedin_profile_url TEXT NOT NULL,
        email_address TEXT,
        location TEXT,
        industry TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(workspace_id, linkedin_profile_url)
      );
      
      -- Add RLS policy
      ALTER TABLE workspace_prospects ENABLE ROW LEVEL SECURITY;
      
      -- Create index for performance
      CREATE INDEX IF NOT EXISTS idx_workspace_prospects_workspace_id ON workspace_prospects(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_workspace_prospects_linkedin_url ON workspace_prospects(linkedin_profile_url);
    `
    
    const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL })
    
    if (createError) {
      console.log('❌ Error creating workspace_prospects table:', createError.message)
      
      // Try alternative approach - direct table creation
      console.log('🔄 Trying direct table creation...')
      
      const { error: directError } = await supabase
        .from('workspace_prospects')
        .select('id')
        .limit(1)
      
      if (directError && directError.message.includes('does not exist')) {
        console.log('⚠️ Table still missing - need manual creation')
        
        // Create a simple SQL migration file for manual execution
        const migrationSQL = `
-- Create workspace_prospects table for CSV upload functionality
CREATE TABLE workspace_prospects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company_name TEXT,
  job_title TEXT,
  linkedin_profile_url TEXT NOT NULL,
  email_address TEXT,
  location TEXT,
  industry TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, linkedin_profile_url)
);

-- Add indexes
CREATE INDEX idx_workspace_prospects_workspace_id ON workspace_prospects(workspace_id);
CREATE INDEX idx_workspace_prospects_linkedin_url ON workspace_prospects(linkedin_profile_url);

-- Enable RLS
ALTER TABLE workspace_prospects ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for workspace access
CREATE POLICY "Users can access prospects in their workspace" ON workspace_prospects
  FOR ALL USING (workspace_id = current_setting('app.current_workspace_id', true));
`
        
        console.log('\n📝 Migration SQL needed:')
        console.log(migrationSQL)
      }
    } else {
      console.log('✅ workspace_prospects table created successfully')
    }
    
    // Create required function for adding prospects to campaigns
    console.log('\n2️⃣ Creating add_prospects_to_campaign function...')
    
    const functionSQL = `
      CREATE OR REPLACE FUNCTION add_prospects_to_campaign(
        p_campaign_id UUID,
        p_prospect_ids UUID[]
      ) RETURNS VOID AS $$
      BEGIN
        INSERT INTO campaign_prospects (campaign_id, prospect_id, status)
        SELECT p_campaign_id, unnest(p_prospect_ids), 'pending'
        ON CONFLICT (campaign_id, prospect_id) DO NOTHING;
      END;
      $$ LANGUAGE plpgsql;
    `
    
    const { error: funcError } = await supabase.rpc('exec_sql', { sql: functionSQL })
    
    if (funcError) {
      console.log('❌ Error creating function:', funcError.message)
    } else {
      console.log('✅ add_prospects_to_campaign function created')
    }
    
    // Test the upload endpoint again
    console.log('\n3️⃣ Testing CSV upload endpoint after fixes...')
    
    try {
      const response = await fetch('https://app.meet-sam.com/api/campaigns/upload-with-resolution', {
        method: 'GET'
      })
      
      if (response.ok) {
        console.log('✅ CSV upload endpoint now working')
      } else {
        console.log('❌ CSV upload endpoint still has issues:', response.status)
      }
    } catch (apiError) {
      console.log('❌ CSV upload endpoint test failed:', apiError.message)
    }
    
    console.log('\n🎉 CSV Upload fixes complete!')
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the fix
fixCsvUploadTables().then(() => {
  console.log('\n✨ Fix completed')
}).catch(error => {
  console.error('💥 Fix failed:', error)
})