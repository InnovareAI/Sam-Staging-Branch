/**
 * Ultra-Direct Table Creation
 * Create missing tables by any means necessary
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function createTablesUltraHard() {
  console.log('💪 Ultra-Hard Table Creation - By Any Means Necessary...')
  console.log('')

  try {
    // Create a Supabase client with maximum privileges
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('📍 **STEP 1: Test current table status**')

    // Check current state
    const { data: wsTest, error: wsError } = await supabase
      .from('workspace_tiers')
      .select('*')
      .limit(1)

    const { data: hitlTest, error: hitlError } = await supabase
      .from('hitl_reply_approval_sessions')
      .select('*')
      .limit(1)

    console.log(`workspace_tiers: ${wsError ? `❌ ${wsError.message}` : '✅ Exists'}`)
    console.log(`hitl_sessions: ${hitlError ? `❌ ${hitlError.message}` : '✅ Exists'}`)
    console.log('')

    if (!wsError && !hitlError) {
      console.log('🎉 Both tables already exist! No creation needed.')
      
      // Test with actual data
      console.log('📍 **Testing with real data...**')
      
      const testWorkspaceId = 'b070d94f-11e2-41d4-a913-cc5a8c017208'
      
      // Test tier assignment
      const { data: tierResult, error: tierError } = await supabase
        .from('workspace_tiers')
        .upsert({
          workspace_id: testWorkspaceId,
          tier: 'sme',
          monthly_email_limit: 1000,
          monthly_linkedin_limit: 100,
          daily_email_limit: 33,
          daily_linkedin_limit: 3
        }, {
          onConflict: 'workspace_id'
        })
        .select()

      if (tierError) {
        console.log(`❌ Tier test failed: ${tierError.message}`)
      } else {
        console.log('✅ Tier assignment working')
      }

      // Test HITL session
      const { data: hitlResult, error: hitlSessionError } = await supabase
        .from('hitl_reply_approval_sessions')
        .insert({
          workspace_id: testWorkspaceId,
          original_message_id: `test_${Date.now()}`,
          original_message_content: 'Test message',
          original_message_channel: 'linkedin',
          sam_suggested_reply: 'Test reply',
          assigned_to_email: 'sp@innovareai.com',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .select()

      if (hitlSessionError) {
        console.log(`❌ HITL test failed: ${hitlSessionError.message}`)
      } else {
        console.log('✅ HITL session creation working')
        console.log(`   Created session: ${hitlResult[0].id}`)
      }

      return
    }

    console.log('📍 **STEP 2: Manual table creation via SQL**')

    // Method 1: Try to create via function calls (if available)
    try {
      console.log('   Attempting method 1: SQL function execution...')
      
      // Check if we can execute raw SQL somehow
      const { data: sqlResult, error: sqlError } = await supabase
        .rpc('exec_sql', { sql: 'SELECT version();' })

      if (!sqlError) {
        console.log('   ✅ SQL execution available, proceeding with table creation...')
        
        const createSQL = `
          CREATE TABLE IF NOT EXISTS workspace_tiers (
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
          
          CREATE TABLE IF NOT EXISTS hitl_reply_approval_sessions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            original_message_id TEXT NOT NULL,
            original_message_content TEXT NOT NULL,
            original_message_channel TEXT NOT NULL CHECK (original_message_channel IN ('email', 'linkedin')),
            prospect_name TEXT,
            prospect_email TEXT,
            prospect_linkedin_url TEXT,
            prospect_company TEXT,
            sam_suggested_reply TEXT NOT NULL,
            sam_confidence_score DECIMAL(3,2),
            sam_reasoning TEXT,
            approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'expired')),
            assigned_to_email TEXT NOT NULL,
            assigned_to TEXT,
            reviewed_by TEXT,
            reviewed_at TIMESTAMP WITH TIME ZONE,
            final_message TEXT,
            rejection_reason TEXT,
            approval_email_sent_at TIMESTAMP WITH TIME ZONE,
            approval_email_opened_at TIMESTAMP WITH TIME ZONE,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            timeout_hours INTEGER DEFAULT 24,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
        
        const { error: createError } = await supabase.rpc('exec_sql', { sql: createSQL })
        
        if (createError) {
          console.log(`   ❌ SQL creation failed: ${createError.message}`)
        } else {
          console.log('   ✅ Tables created via SQL execution')
        }
      } else {
        console.log(`   ❌ SQL execution not available: ${sqlError.message}`)
      }
      
    } catch (method1Error) {
      console.log(`   ❌ Method 1 failed: ${method1Error.message}`)
    }

    console.log('')
    console.log('📍 **STEP 3: Final status check**')
    
    // Final verification
    const { data: finalWsTest, error: finalWsError } = await supabase
      .from('workspace_tiers')
      .select('*')
      .limit(1)

    const { data: finalHitlTest, error: finalHitlError } = await supabase
      .from('hitl_reply_approval_sessions')
      .select('*')
      .limit(1)

    console.log(`workspace_tiers: ${finalWsError ? `❌ ${finalWsError.message}` : '✅ Now exists'}`)
    console.log(`hitl_sessions: ${finalHitlError ? `❌ ${finalHitlError.message}` : '✅ Now exists'}`)
    console.log('')

    if (!finalWsError && !finalHitlError) {
      console.log('🎉 SUCCESS! Both tables are now available.')
    } else {
      console.log('❌ Tables still missing. Manual intervention required.')
      console.log('')
      console.log('🔧 **MANUAL SOLUTION:**')
      console.log('   1. Open Supabase Dashboard SQL Editor')
      console.log('   2. Execute the schema from sql/tenant-integrations-schema.sql')
      console.log('   3. Or use supabase CLI with proper migration handling')
    }

  } catch (error) {
    console.error('❌ Ultra-hard table creation failed:', error.message)
  }
}

// Execute
createTablesUltraHard()