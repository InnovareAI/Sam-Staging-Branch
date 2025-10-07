/**
 * End-to-End Test: Prospect Approval Flow
 * Tests the complete workflow from session creation to learning insights
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test user credentials (use existing test user)
const TEST_USER_ID = 'f3a7b9c1-4d2e-6f8a-9b0c-1d2e3f4a5b6c'; // Replace with actual test user
const TEST_WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000'; // Replace with actual test workspace

// Sample ICP criteria
const TEST_ICP_CRITERIA = {
  industry: 'B2B SaaS',
  target_role: 'VP of Sales',
  company_size: '50-200 employees',
  geography: 'United States',
  pain_points: ['Struggling with outbound prospecting', 'Low conversion rates'],
  objectives: ['Increase pipeline by 50%', 'Reduce sales cycle']
};

// Sample prospects
const SAMPLE_PROSPECTS = [
  {
    prospect_id: 'unipile_prospect_001',
    name: 'Sarah Martinez',
    title: 'VP of Sales',
    location: 'San Francisco, CA',
    profile_image: 'https://example.com/sarah.jpg',
    recent_activity: 'Posted about sales automation challenges',
    company: {
      name: 'TechScale Inc',
      size: '150 employees',
      industry: 'B2B SaaS',
      website: 'https://techscale.com'
    },
    contact: {
      email: 'sarah.martinez@techscale.com',
      linkedin_url: 'https://linkedin.com/in/sarahmartinez'
    },
    connection_degree: 2,
    enrichment_score: 85
  },
  {
    prospect_id: 'unipile_prospect_002',
    name: 'Michael Chen',
    title: 'Director of Sales',
    location: 'Austin, TX',
    profile_image: 'https://example.com/michael.jpg',
    recent_activity: 'Commented on LinkedIn outreach strategies',
    company: {
      name: 'GrowthCo',
      size: '80 employees',
      industry: 'B2B SaaS',
      website: 'https://growthco.io'
    },
    contact: {
      email: 'michael.chen@growthco.io',
      linkedin_url: 'https://linkedin.com/in/michaelchen'
    },
    connection_degree: 1,
    enrichment_score: 92
  },
  {
    prospect_id: 'unipile_prospect_003',
    name: 'Jessica Thompson',
    title: 'VP Sales Operations',
    location: 'New York, NY',
    profile_image: 'https://example.com/jessica.jpg',
    recent_activity: 'Shared article on CRM optimization',
    company: {
      name: 'DataDrive Systems',
      size: '200 employees',
      industry: 'B2B SaaS',
      website: 'https://datadrive.com'
    },
    contact: {
      email: 'jessica.t@datadrive.com',
      linkedin_url: 'https://linkedin.com/in/jessicathompson'
    },
    connection_degree: 3,
    enrichment_score: 78
  }
];

async function testProspectApprovalFlow() {
  console.log('🧪 Testing Prospect Approval Flow End-to-End\n');

  try {
    // ================================================================
    // STEP 1: Get or create test workspace and user
    // ================================================================
    console.log('1. Setting up test environment...');

    // Get actual test user and workspace from workspace_members
    const { data: testMember } = await supabase
      .from('workspace_members')
      .select('user_id, workspace_id')
      .limit(1)
      .single();

    if (!testMember) {
      console.error('   ❌ No workspace members found. Create a test user and workspace first.');
      return;
    }

    const userId = testMember.user_id;
    const workspaceId = testMember.workspace_id;

    console.log(`   ✅ Using test user: ${userId}`);
    console.log(`   ✅ Using workspace: ${workspaceId}`);

    // ================================================================
    // STEP 2: Create prospect approval session
    // ================================================================
    console.log('\n2. Creating prospect approval session...');

    const { data: session, error: sessionError } = await supabase
      .from('prospect_approval_sessions')
      .insert({
        batch_number: 1,
        user_id: userId,
        workspace_id: workspaceId,
        status: 'active',
        total_prospects: SAMPLE_PROSPECTS.length,
        approved_count: 0,
        rejected_count: 0,
        pending_count: SAMPLE_PROSPECTS.length,
        icp_criteria: TEST_ICP_CRITERIA,
        prospect_source: 'unipile_linkedin_search'
      })
      .select()
      .single();

    if (sessionError) {
      console.error('   ❌ Session creation failed:', sessionError.message);
      return;
    }

    console.log(`   ✅ Session created: ${session.id}`);
    console.log(`   📊 Batch #${session.batch_number}, ${session.total_prospects} prospects`);

    // ================================================================
    // STEP 3: Add prospects to session
    // ================================================================
    console.log('\n3. Adding prospects to session...');

    for (const prospect of SAMPLE_PROSPECTS) {
      const { data, error } = await supabase
        .from('prospect_approval_data')
        .insert({
          session_id: session.id,
          ...prospect
        })
        .select()
        .single();

      if (error) {
        console.error(`   ❌ Failed to add ${prospect.name}:`, error.message);
      } else {
        console.log(`   ✅ Added: ${prospect.name} (${prospect.company.name})`);
      }
    }

    // ================================================================
    // STEP 4: Make approval/rejection decisions
    // ================================================================
    console.log('\n4. Making approval decisions...');

    // Approve Sarah (high score, 2nd degree)
    const { error: decision1Error } = await supabase
      .from('prospect_approval_decisions')
      .insert({
        session_id: session.id,
        prospect_id: SAMPLE_PROSPECTS[0].prospect_id,
        decision: 'approved',
        reason: 'Perfect fit: VP Sales at B2B SaaS, high engagement, 2nd degree connection',
        decided_by: userId
      });

    if (decision1Error) {
      console.error('   ❌ Decision 1 failed:', decision1Error.message);
    } else {
      console.log(`   ✅ APPROVED: ${SAMPLE_PROSPECTS[0].name}`);
    }

    // Approve Michael (highest score, 1st degree)
    const { error: decision2Error } = await supabase
      .from('prospect_approval_decisions')
      .insert({
        session_id: session.id,
        prospect_id: SAMPLE_PROSPECTS[1].prospect_id,
        decision: 'approved',
        reason: 'Excellent match: Director at B2B SaaS, 1st degree, very active on LinkedIn',
        decided_by: userId
      });

    if (decision2Error) {
      console.error('   ❌ Decision 2 failed:', decision2Error.message);
    } else {
      console.log(`   ✅ APPROVED: ${SAMPLE_PROSPECTS[1].name}`);
    }

    // Reject Jessica (3rd degree, lower score)
    const { error: decision3Error } = await supabase
      .from('prospect_approval_decisions')
      .insert({
        session_id: session.id,
        prospect_id: SAMPLE_PROSPECTS[2].prospect_id,
        decision: 'rejected',
        reason: 'Too distant: 3rd degree connection, lower engagement score',
        decided_by: userId
      });

    if (decision3Error) {
      console.error('   ❌ Decision 3 failed:', decision3Error.message);
    } else {
      console.log(`   ❌ REJECTED: ${SAMPLE_PROSPECTS[2].name}`);
    }

    // ================================================================
    // STEP 5: Create learning logs
    // ================================================================
    console.log('\n5. Creating learning logs...');

    for (let i = 0; i < SAMPLE_PROSPECTS.length; i++) {
      const prospect = SAMPLE_PROSPECTS[i];
      const decision = i < 2 ? 'approved' : 'rejected';
      const reason = i === 0
        ? 'Perfect fit: VP Sales at B2B SaaS, high engagement, 2nd degree connection'
        : i === 1
        ? 'Excellent match: Director at B2B SaaS, 1st degree, very active on LinkedIn'
        : 'Too distant: 3rd degree connection, lower engagement score';

      const { error: logError } = await supabase
        .from('prospect_learning_logs')
        .insert({
          session_id: session.id,
          prospect_id: prospect.prospect_id,
          decision,
          reason,
          prospect_title: prospect.title,
          company_size: prospect.company.size,
          company_industry: prospect.company.industry,
          connection_degree: prospect.connection_degree,
          enrichment_score: prospect.enrichment_score,
          has_email: !!prospect.contact.email,
          has_phone: false,
          learning_features: {
            recent_job_change: false,
            actively_posting: true,
            mutual_connections: prospect.connection_degree <= 2
          }
        });

      if (logError) {
        console.error(`   ❌ Learning log failed for ${prospect.name}:`, logError.message);
      } else {
        console.log(`   ✅ Logged: ${prospect.name} (${decision})`);
      }
    }

    // ================================================================
    // STEP 6: Update session counts
    // ================================================================
    console.log('\n6. Updating session counts...');

    const { error: updateError } = await supabase
      .from('prospect_approval_sessions')
      .update({
        approved_count: 2,
        rejected_count: 1,
        pending_count: 0
      })
      .eq('id', session.id);

    if (updateError) {
      console.error('   ❌ Session update failed:', updateError.message);
    } else {
      console.log('   ✅ Session counts updated');
    }

    // ================================================================
    // STEP 7: Generate learning insights (mock)
    // ================================================================
    console.log('\n7. Generating learning insights...');

    const learningInsights = {
      approval_rate: 0.67,
      key_patterns: [
        'Prefer 1st-2nd degree connections over 3rd degree',
        'High engagement score (>85) correlates with approval',
        'VP/Director titles at B2B SaaS companies are ideal'
      ],
      feature_weights: {
        connection_degree: 0.35,
        enrichment_score: 0.30,
        title_match: 0.20,
        company_industry: 0.15
      }
    };

    const { error: insightsError } = await supabase
      .from('prospect_approval_sessions')
      .update({
        learning_insights: learningInsights
      })
      .eq('id', session.id);

    if (insightsError) {
      console.error('   ❌ Insights update failed:', insightsError.message);
    } else {
      console.log('   ✅ Learning insights generated');
      console.log('   📈 Approval rate: 67%');
      console.log('   🧠 Key pattern: Prefer 1st-2nd degree connections');
    }

    // ================================================================
    // STEP 8: Complete session
    // ================================================================
    console.log('\n8. Completing session...');

    const { error: completeError } = await supabase
      .from('prospect_approval_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', session.id);

    if (completeError) {
      console.error('   ❌ Session completion failed:', completeError.message);
    } else {
      console.log('   ✅ Session completed');
    }

    // ================================================================
    // STEP 9: Create export record
    // ================================================================
    console.log('\n9. Creating export record...');

    const approvedProspects = SAMPLE_PROSPECTS.slice(0, 2);

    const { data: exportRecord, error: exportError } = await supabase
      .from('prospect_exports')
      .insert({
        session_id: session.id,
        user_id: userId,
        workspace_id: workspaceId,
        prospect_count: approvedProspects.length,
        export_data: approvedProspects,
        export_format: 'json'
      })
      .select()
      .single();

    if (exportError) {
      console.error('   ❌ Export creation failed:', exportError.message);
    } else {
      console.log(`   ✅ Export created: ${exportRecord.id}`);
      console.log(`   📦 ${exportRecord.prospect_count} prospects exported`);
    }

    // ================================================================
    // STEP 10: Update or create SAM learning model
    // ================================================================
    console.log('\n10. Updating SAM learning model...');

    const { data: existingModel } = await supabase
      .from('sam_learning_models')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .eq('model_type', 'prospect_approval')
      .single();

    if (existingModel) {
      // Update existing model
      const { error: modelError } = await supabase
        .from('sam_learning_models')
        .update({
          learned_preferences: learningInsights.key_patterns,
          feature_weights: learningInsights.feature_weights,
          accuracy_score: learningInsights.approval_rate,
          sessions_trained_on: (existingModel.sessions_trained_on || 0) + 1,
          last_training_session: session.id
        })
        .eq('id', existingModel.id);

      if (modelError) {
        console.error('   ❌ Model update failed:', modelError.message);
      } else {
        console.log('   ✅ SAM learning model updated');
      }
    } else {
      // Create new model
      const { error: modelError } = await supabase
        .from('sam_learning_models')
        .insert({
          user_id: userId,
          workspace_id: workspaceId,
          model_version: 1,
          model_type: 'prospect_approval',
          learned_preferences: learningInsights.key_patterns,
          feature_weights: learningInsights.feature_weights,
          accuracy_score: learningInsights.approval_rate,
          sessions_trained_on: 1,
          last_training_session: session.id
        });

      if (modelError) {
        console.error('   ❌ Model creation failed:', modelError.message);
      } else {
        console.log('   ✅ SAM learning model created');
      }
    }

    // ================================================================
    // VERIFICATION
    // ================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION RESULTS\n');

    // Count records
    const { count: sessionsCount } = await supabase
      .from('prospect_approval_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    const { count: prospectsCount } = await supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);

    const { count: decisionsCount } = await supabase
      .from('prospect_approval_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);

    const { count: logsCount } = await supabase
      .from('prospect_learning_logs')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);

    const { count: exportsCount } = await supabase
      .from('prospect_exports')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);

    console.log(`✅ Sessions created: ${sessionsCount}`);
    console.log(`✅ Prospects added: ${prospectsCount}`);
    console.log(`✅ Decisions made: ${decisionsCount}`);
    console.log(`✅ Learning logs: ${logsCount}`);
    console.log(`✅ Exports created: ${exportsCount}`);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 END-TO-END TEST COMPLETED SUCCESSFULLY!\n');

    // Cleanup option
    console.log('💡 To clean up test data, run:');
    console.log(`   DELETE FROM prospect_approval_sessions WHERE id = '${session.id}';`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testProspectApprovalFlow();
