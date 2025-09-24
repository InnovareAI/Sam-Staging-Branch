/**
 * ULTRA-HARD TABLE CREATION
 * Uses direct SQL execution through admin endpoints
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function ultrahardCreateTables() {
  console.log('💀 ULTRA-HARD MODE: Creating tables via direct SQL execution...')
  
  const createTableSQL = `
    -- Create campaigns table
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

    -- Create campaign_prospects table
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

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
    CREATE INDEX IF NOT EXISTS idx_campaign_prospects_campaign_id ON campaign_prospects(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_prospects_status ON campaign_prospects(status);

    -- Enable RLS
    ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
    ALTER TABLE campaign_prospects ENABLE ROW LEVEL SECURITY;
  `

  const rlsPolicySQL = `
    -- Create RLS policies
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'campaigns' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON campaigns FOR ALL USING (true);
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'campaign_prospects' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON campaign_prospects FOR ALL USING (true);
      END IF;
    END $$;
  `

  try {
    console.log('\n🔥 Attempting method 1: Direct SQL via API...')
    
    // Method 1: Try using the SQL runner API endpoint directly
    const sqlApiUrl = `${SUPABASE_URL}/rest/v1/rpc/sql`
    const response1 = await fetch(sqlApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({ query: createTableSQL })
    })

    if (response1.ok) {
      console.log('✅ Tables created via SQL API')
    } else {
      console.log('❌ SQL API method failed')
      
      // Method 2: Try SQL Editor endpoint
      console.log('\n🔥 Attempting method 2: SQL Editor endpoint...')
      const editorUrl = `${SUPABASE_URL}/sql`
      const response2 = await fetch(editorUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: createTableSQL })
      })

      if (response2.ok) {
        console.log('✅ Tables created via SQL Editor')
      } else {
        console.log('❌ SQL Editor method failed')
        
        // Method 3: Raw PostgreSQL connection simulation
        console.log('\n🔥 Attempting method 3: Raw SQL execution...')
        
        // Split SQL into individual statements and execute each
        const statements = createTableSQL.split(';').filter(stmt => stmt.trim())
        
        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i].trim()
          if (!stmt) continue
          
          console.log(`💀 Executing statement ${i + 1}/${statements.length}`)
          
          try {
            // Try using a generic function executor
            const { data, error } = await supabase.rpc('exec', { sql: stmt })
            if (error) {
              console.log(`⚠️  Statement ${i + 1} error:`, error.message)
            } else {
              console.log(`✅ Statement ${i + 1} executed`)
            }
          } catch (err) {
            console.log(`⚠️  Statement ${i + 1} failed:`, err.message)
          }
        }
      }
    }

    // Now create RLS policies
    console.log('\n🔥 Creating RLS policies...')
    try {
      const { data, error } = await supabase.rpc('exec', { sql: rlsPolicySQL })
      if (error) {
        console.log('⚠️  RLS policies error:', error.message)
      } else {
        console.log('✅ RLS policies created')
      }
    } catch (err) {
      console.log('⚠️  RLS policies failed:', err.message)
    }

    // Final test
    console.log('\n🔥 Testing table creation...')
    
    const { data: campaignTest, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .limit(1)

    if (campaignError) {
      console.log('❌ Campaigns table still not accessible:', campaignError.message)
      
      // Last resort: Create minimal working tables
      console.log('\n💀 LAST RESORT: Creating minimal table structure...')
      console.log('📋 Execute this manually in Supabase SQL Editor:')
      console.log('\n```sql')
      console.log(createTableSQL)
      console.log('```\n')
      
    } else {
      console.log('✅ SUCCESS! Campaigns table is now accessible')
      
      const { data: prospectsTest, error: prospectsError } = await supabase
        .from('campaign_prospects')
        .select('id')
        .limit(1)

      if (prospectsError) {
        console.log('❌ Campaign prospects table not accessible:', prospectsError.message)
      } else {
        console.log('✅ SUCCESS! Campaign prospects table is now accessible')
        console.log('🎉 ALL TABLES CREATED SUCCESSFULLY!')
        console.log('🚀 Charissa campaign system is ready to use!')
      }
    }

  } catch (error) {
    console.error('💀 ULTRA-HARD MODE FAILED:', error)
    console.log('\n📋 Manual SQL for Supabase SQL Editor:')
    console.log('```sql')
    console.log(createTableSQL)
    console.log('```')
  }
}

// Execute ultra-hard mode
ultrahardCreateTables().then(() => {
  console.log('\n💀 ULTRA-HARD TABLE CREATION COMPLETE')
}).catch(error => {
  console.error('💀 ULTRA-HARD MODE CRASHED:', error)
})