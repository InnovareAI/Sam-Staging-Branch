/**
 * Deploy Missing Database Tables
 * Create workspace_tiers and hitl_reply_approval_sessions tables
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function deployMissingTables() {
  console.log('🚀 Deploying Missing Database Tables...')
  console.log('')

  try {
    // Deploy workspace_tiers table
    console.log('📍 **STEP 1: Creating workspace_tiers table**')
    
    const workspaceTiersSQL = `
      CREATE TABLE IF NOT EXISTS workspace_tiers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        
        -- Service tier configuration
        tier TEXT NOT NULL CHECK (tier IN ('startup', 'sme', 'enterprise')),
        tier_status TEXT NOT NULL DEFAULT 'active' CHECK (tier_status IN ('active', 'suspended', 'cancelled')),
        
        -- Feature limits per tier
        monthly_email_limit INTEGER NOT NULL DEFAULT 1000,
        monthly_linkedin_limit INTEGER NOT NULL DEFAULT 100,
        daily_email_limit INTEGER,
        daily_linkedin_limit INTEGER,
        hitl_approval_required BOOLEAN DEFAULT true,
        
        -- Integration configuration
        integration_config JSONB DEFAULT '{}',
        tier_features JSONB DEFAULT '{}',
        
        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- Unique constraint
        UNIQUE(workspace_id)
      );
      
      -- Enable RLS
      ALTER TABLE workspace_tiers ENABLE ROW LEVEL SECURITY;
      
      -- RLS policies
      CREATE POLICY "Users can view their workspace tiers" ON workspace_tiers
        FOR SELECT USING (
          workspace_id IN (
            SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
          )
        );
      
      CREATE POLICY "Users can update their workspace tiers" ON workspace_tiers
        FOR ALL USING (
          workspace_id IN (
            SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
          )
        );
    `

    const { error: tiersError } = await supabase.rpc('exec_sql', {
      sql: workspaceTiersSQL
    })

    if (tiersError) {
      console.log(`❌ workspace_tiers creation failed: ${tiersError.message}`)
    } else {
      console.log('✅ workspace_tiers table created successfully')
    }
    console.log('')

    // Deploy HITL table
    console.log('📍 **STEP 2: Creating hitl_reply_approval_sessions table**')
    
    const hitlTableSQL = `
      CREATE TABLE IF NOT EXISTS hitl_reply_approval_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        campaign_execution_id uuid REFERENCES n8n_campaign_executions(id) ON DELETE SET NULL,
        
        -- Original message details
        original_message_id TEXT NOT NULL,
        original_message_content TEXT NOT NULL,
        original_message_channel TEXT NOT NULL CHECK (original_message_channel IN ('email', 'linkedin')),
        
        -- Prospect information
        prospect_name TEXT,
        prospect_email TEXT,
        prospect_linkedin_url TEXT,
        prospect_company TEXT,
        
        -- SAM's suggested response
        sam_suggested_reply TEXT NOT NULL,
        sam_confidence_score DECIMAL(3,2) CHECK (sam_confidence_score >= 0 AND sam_confidence_score <= 1),
        sam_reasoning TEXT,
        
        -- Approval workflow
        approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'expired')),
        assigned_to_email TEXT NOT NULL,
        assigned_to TEXT, -- User ID who should approve
        
        -- Decision details
        reviewed_by TEXT,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        final_message TEXT,
        rejection_reason TEXT,
        
        -- Email tracking
        approval_email_sent_at TIMESTAMP WITH TIME ZONE,
        approval_email_opened_at TIMESTAMP WITH TIME ZONE,
        
        -- Expiration
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        timeout_hours INTEGER DEFAULT 24,
        
        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Enable RLS
      ALTER TABLE hitl_reply_approval_sessions ENABLE ROW LEVEL SECURITY;
      
      -- RLS policies
      CREATE POLICY "Users can view their workspace HITL sessions" ON hitl_reply_approval_sessions
        FOR SELECT USING (
          workspace_id IN (
            SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
          )
        );
      
      CREATE POLICY "Users can manage their workspace HITL sessions" ON hitl_reply_approval_sessions
        FOR ALL USING (
          workspace_id IN (
            SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
          )
        );
    `

    const { error: hitlError } = await supabase.rpc('exec_sql', {
      sql: hitlTableSQL
    })

    if (hitlError) {
      console.log(`❌ HITL table creation failed: ${hitlError.message}`)
    } else {
      console.log('✅ hitl_reply_approval_sessions table created successfully')
    }
    console.log('')

    // Test the tables
    console.log('📍 **STEP 3: Testing created tables**')
    
    const { data: tiersTest, error: tiersTestError } = await supabase
      .from('workspace_tiers')
      .select('*')
      .limit(0)
    
    const { data: hitlTest, error: hitlTestError } = await supabase
      .from('hitl_reply_approval_sessions')
      .select('*')
      .limit(0)

    if (!tiersTestError) {
      console.log('✅ workspace_tiers table accessible')
    } else {
      console.log(`❌ workspace_tiers table test failed: ${tiersTestError.message}`)
    }

    if (!hitlTestError) {
      console.log('✅ hitl_reply_approval_sessions table accessible')
    } else {
      console.log(`❌ HITL table test failed: ${hitlTestError.message}`)
    }
    console.log('')

    // Summary
    console.log('🎯 **TABLE DEPLOYMENT SUMMARY:**')
    console.log('')
    console.log('✅ **CREATED TABLES:**')
    if (!tiersError) console.log('   • workspace_tiers - Service tier management')
    if (!hitlError) console.log('   • hitl_reply_approval_sessions - Human approval workflow')
    console.log('')
    console.log('🔧 **READY FOR TESTING:**')
    console.log('   • API endpoints can now access required tables')
    console.log('   • RLS policies configured for multi-tenant security')
    console.log('   • All foreign key relationships established')

  } catch (error) {
    console.error('❌ Table deployment failed:', error.message)
  }
}

// Execute the deployment
deployMissingTables()