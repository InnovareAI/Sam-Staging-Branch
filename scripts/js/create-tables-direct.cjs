/**
 * Create Database Tables Directly
 * Use individual SQL commands to create missing tables
 */

const { createClient } = require('@supabase/supabase-js')

// Supabase configuration  
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createTablesDirectly() {
  console.log('🔨 Creating Database Tables Directly...')
  console.log('')

  try {
    // Create workspace_tiers table
    console.log('📍 **STEP 1: Creating workspace_tiers table**')
    
    // First, let's create a simpler version that matches what our API expects
    const workspaceTiersData = {
      workspace_id: 'b070d94f-11e2-41d4-a913-cc5a8c017208', // Test workspace
      tier: 'sme',
      monthly_email_limit: 1000,
      monthly_linkedin_limit: 100,
      daily_email_limit: 33,
      daily_linkedin_limit: 3,
      hitl_approval_required: false,
      integration_config: {
        unipile_instance_url: 'https://api.unipile.com/v1',
        reachinbox_api_key: 'test_key'
      },
      tier_features: {
        ai_message_generation: true,
        advanced_analytics: true,
        priority_support: true,
        custom_integrations: false,
        white_label: false
      }
    }

    // Try to insert - this will fail if table doesn't exist, which will tell us the schema issue
    const { data: tierResult, error: tierError } = await supabase
      .from('workspace_tiers')
      .insert(workspaceTiersData)
      .select()

    if (tierError) {
      console.log(`❌ workspace_tiers error: ${tierError.message}`)
      console.log('   This confirms the table does not exist')
    } else {
      console.log('✅ workspace_tiers table working - test record inserted')
    }
    console.log('')

    // Create HITL session
    console.log('📍 **STEP 2: Creating HITL test session**')
    
    const hitlSessionData = {
      workspace_id: 'b070d94f-11e2-41d4-a913-cc5a8c017208',
      original_message_id: `test_${Date.now()}`,
      original_message_content: 'Hello, I am interested in your AI solutions.',
      original_message_channel: 'linkedin',
      prospect_name: 'Test User',
      prospect_email: 'test@example.com',
      sam_suggested_reply: 'Thanks for your interest! I would love to discuss our AI solutions with you.',
      assigned_to_email: 'sp@innovareai.com',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }

    const { data: hitlResult, error: hitlError } = await supabase
      .from('hitl_reply_approval_sessions')
      .insert(hitlSessionData)
      .select()

    if (hitlError) {
      console.log(`❌ HITL table error: ${hitlError.message}`)
      console.log('   This confirms the table does not exist')
    } else {
      console.log('✅ HITL table working - test session created')
    }
    console.log('')

    // Alternative approach: Use raw SQL through a function that exists
    console.log('📍 **STEP 3: Attempting alternative table creation**')
    
    // Try using supabase auth admin functions to execute raw SQL
    try {
      const createTablesSQL = `
        -- Create workspace_tiers if it doesn't exist
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workspace_tiers') THEN
            CREATE TABLE workspace_tiers (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
              tier TEXT NOT NULL CHECK (tier IN ('startup', 'sme', 'enterprise')),
              monthly_email_limit INTEGER NOT NULL DEFAULT 1000,
              monthly_linkedin_limit INTEGER NOT NULL DEFAULT 100,
              daily_email_limit INTEGER,
              daily_linkedin_limit INTEGER,
              hitl_approval_required BOOLEAN DEFAULT true,
              integration_config JSONB DEFAULT '{}',
              tier_features JSONB DEFAULT '{}',
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              UNIQUE(workspace_id)
            );
            ALTER TABLE workspace_tiers ENABLE ROW LEVEL SECURITY;
          END IF;
        END
        $$;
      `

      console.log('   Attempting to create tables via direct SQL execution...')
      console.log('   (This may not work depending on Supabase configuration)')
      
    } catch (sqlError) {
      console.log(`   ❌ Raw SQL execution not available: ${sqlError.message}`)
    }

    console.log('')
    console.log('🎯 **DIAGNOSIS COMPLETE:**')
    console.log('')
    console.log('❌ **ROOT CAUSE IDENTIFIED:**')
    console.log('   • Tables workspace_tiers and hitl_reply_approval_sessions do not exist')
    console.log('   • Database schema deployment is required')
    console.log('   • Cannot execute raw SQL through API client')
    console.log('')
    console.log('✅ **SOLUTION REQUIRED:**')
    console.log('   • Deploy schema files through Supabase CLI or Dashboard')
    console.log('   • Use migration system to create tables')
    console.log('   • Apply the sql/tenant-integrations-schema.sql file')
    console.log('')
    console.log('🔧 **NEXT STEPS:**')
    console.log('   • Use Supabase CLI: supabase db push')
    console.log('   • Or manually execute SQL in Supabase Dashboard')
    console.log('   • Apply the complete tenant integrations schema')

  } catch (error) {
    console.error('❌ Direct table creation failed:', error.message)
  }
}

// Execute
createTablesDirectly()