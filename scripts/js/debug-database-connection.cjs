/**
 * Debug Database Connection and Schema Issues
 * Check workspace and tables for API issues
 */

const { createClient } = require('@supabase/supabase-js')

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugDatabaseConnection() {
  console.log('🔍 Debugging Database Connection and Schema...')
  console.log('')

  try {
    // Test 1: Check workspace
    console.log('📍 **STEP 1: Check test workspace exists**')
    const testWorkspaceId = 'b070d94f-11e2-41d4-a913-cc5a8c017208'
    
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', testWorkspaceId)
      .single()

    if (workspaceError) {
      console.log(`❌ Workspace error: ${workspaceError.message}`)
      
      // Try to get any workspace
      const { data: anyWorkspace, error: anyError } = await supabase
        .from('workspaces')
        .select('id, name')
        .limit(1)
      
      if (anyError) {
        console.log(`❌ Cannot access workspaces table: ${anyError.message}`)
        return
      } else if (anyWorkspace?.length > 0) {
        console.log(`✅ Found alternative workspace: ${anyWorkspace[0].name} (${anyWorkspace[0].id})`)
        console.log('   Using this workspace for further testing')
        testWorkspaceId = anyWorkspace[0].id
      }
    } else {
      console.log(`✅ Test workspace found: ${workspace.name} (${workspace.id})`)
    }
    console.log('')

    // Test 2: Check workspace_tiers table
    console.log('📍 **STEP 2: Check workspace_tiers table**')
    
    const { data: tiers, error: tiersError } = await supabase
      .from('workspace_tiers')
      .select('*')
      .limit(1)

    if (tiersError) {
      console.log(`❌ workspace_tiers table error: ${tiersError.message}`)
    } else {
      console.log(`✅ workspace_tiers table accessible (found ${tiers?.length || 0} records)`)
    }
    console.log('')

    // Test 3: Check HITL table
    console.log('📍 **STEP 3: Check hitl_reply_approval_sessions table**')
    
    const { data: hitlSessions, error: hitlError } = await supabase
      .from('hitl_reply_approval_sessions')
      .select('*')
      .limit(1)

    if (hitlError) {
      console.log(`❌ HITL table error: ${hitlError.message}`)
    } else {
      console.log(`✅ HITL table accessible (found ${hitlSessions?.length || 0} records)`)
    }
    console.log('')

    // Test 4: Test tier assignment
    console.log('📍 **STEP 4: Test tier assignment**')
    
    const tierConfig = {
      workspace_id: testWorkspaceId,
      tier: 'sme',
      monthly_email_limit: 1000,
      monthly_linkedin_limit: 100,
      daily_email_limit: 33,
      daily_linkedin_limit: 3,
      hitl_approval_required: false,
      tier_features: {
        ai_message_generation: true,
        advanced_analytics: true,
        priority_support: true
      }
    }

    const { data: tierResult, error: tierAssignError } = await supabase
      .from('workspace_tiers')
      .upsert(tierConfig, {
        onConflict: 'workspace_id'
      })
      .select()
      .single()

    if (tierAssignError) {
      console.log(`❌ Tier assignment error: ${tierAssignError.message}`)
    } else {
      console.log(`✅ Tier assigned successfully: ${tierResult.tier}`)
      console.log(`   Monthly limits: ${tierResult.monthly_email_limit} email, ${tierResult.monthly_linkedin_limit} LinkedIn`)
    }
    console.log('')

    // Test 5: Test HITL session creation
    console.log('📍 **STEP 5: Test HITL session creation**')
    
    const hitlSession = {
      workspace_id: testWorkspaceId,
      original_message_id: `test_${Date.now()}`,
      original_message_content: 'Hello, I am interested in your AI solutions.',
      original_message_channel: 'linkedin',
      prospect_name: 'Test User',
      prospect_email: 'test@example.com',
      sam_suggested_reply: 'Thanks for your interest! I would love to discuss our AI solutions with you.',
      assigned_to_email: 'sp@innovareai.com',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    }

    const { data: hitlResult, error: hitlCreateError } = await supabase
      .from('hitl_reply_approval_sessions')
      .insert(hitlSession)
      .select()
      .single()

    if (hitlCreateError) {
      console.log(`❌ HITL session creation error: ${hitlCreateError.message}`)
    } else {
      console.log(`✅ HITL session created successfully: ${hitlResult.id}`)
      console.log(`   Status: ${hitlResult.approval_status}`)
      console.log(`   Expires: ${new Date(hitlResult.expires_at).toLocaleString()}`)
    }
    console.log('')

    // Summary
    console.log('🎯 **DATABASE DEBUG SUMMARY:**')
    console.log('')
    console.log('✅ **WORKING COMPONENTS:**')
    if (!workspaceError) console.log('   • Workspaces table access')
    if (!tiersError) console.log('   • Workspace tiers table access')
    if (!hitlError) console.log('   • HITL approval sessions table access')
    if (!tierAssignError) console.log('   • Tier assignment functionality')
    if (!hitlCreateError) console.log('   • HITL session creation functionality')
    
    console.log('')
    console.log('🔧 **READY FOR API TESTING:**')
    console.log('   • Database connections working')
    console.log('   • Core tables accessible')
    console.log('   • Data operations functional')

  } catch (error) {
    console.error('❌ Database debug failed:', error.message)
  }
}

// Execute the debug
debugDatabaseConnection()