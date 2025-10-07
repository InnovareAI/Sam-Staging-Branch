/**
 * Verify Prospect Approval System - Check deployment status and identify loose ends
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyProspectApprovalSystem() {
  console.log('🔍 Verifying Prospect Approval & ICP Research System\n');

  const issues = [];
  const warnings = [];

  // Step 1: Check database tables
  console.log('1. Checking Database Tables...');

  const tables = [
    'prospect_approval_sessions',
    'prospect_approval_data',
    'prospect_approval_decisions',
    'prospect_learning_logs',
    'prospect_exports',
    'sam_learning_models',
    'sam_icp_discovery_sessions'
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`   ❌ ${table}: NOT DEPLOYED`);
      issues.push(`Table ${table} not deployed`);
    } else {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      console.log(`   ✅ ${table}: EXISTS (${count} records)`);
    }
  }

  // Step 2: Check API routes
  console.log('\n2. Checking API Routes...');

  const apiRoutes = [
    '/api/prospect-approval/session',
    '/api/prospect-approval/prospects',
    '/api/prospect-approval/decide',
    '/api/prospect-approval/decisions',
    '/api/prospect-approval/complete',
    '/api/prospect-approval/learning',
    '/api/prospect-approval/optimize',
    '/api/prospect-approval/setup'
  ];

  for (const route of apiRoutes) {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), 'app', route, 'route.ts');

      if (fs.existsSync(filePath)) {
        console.log(`   ✅ ${route}`);
      } else {
        console.log(`   ❌ ${route}: FILE MISSING`);
        issues.push(`API route ${route} missing`);
      }
    } catch (err) {
      console.log(`   ⚠️  ${route}: ${err.message}`);
      warnings.push(`Could not verify ${route}`);
    }
  }

  // Step 3: Check prospect approval sessions using wrong table reference
  console.log('\n3. Checking Session API Table References...');

  const sessionRouteFile = require('fs').readFileSync(
    require('path').join(process.cwd(), 'app/api/prospect-approval/session/route.ts'),
    'utf8'
  );

  if (sessionRouteFile.includes('user_organizations')) {
    console.log('   ❌ Session API uses WRONG table: user_organizations');
    console.log('   → Should use: workspace_members');
    issues.push('Session API references non-existent user_organizations table');
  } else if (sessionRouteFile.includes('workspace_members')) {
    console.log('   ✅ Session API uses correct table: workspace_members');
  }

  if (sessionRouteFile.includes('organization_id')) {
    console.log('   ⚠️  Session API references organization_id');
    console.log('   → Should use: workspace_id');
    warnings.push('Session API uses organization_id instead of workspace_id');
  }

  // Step 4: Check migration deployment
  console.log('\n4. Checking Migration Deployment...');

  const { data: sessionCheck } = await supabase
    .from('prospect_approval_sessions')
    .select('workspace_id, organization_id')
    .limit(1);

  if (sessionCheck && sessionCheck.length > 0) {
    const session = sessionCheck[0];
    if (session.workspace_id) {
      console.log('   ✅ Sessions table has workspace_id column');
    }
    if (session.organization_id) {
      console.log('   ✅ Sessions table has organization_id column');
    }
  } else {
    console.log('   ℹ️  No existing sessions to check schema');
  }

  // Step 5: Check ICP discovery integration
  console.log('\n5. Checking ICP Discovery Integration...');

  const { data: icpSessions, error: icpError } = await supabase
    .from('sam_icp_discovery_sessions')
    .select('*')
    .limit(1);

  if (icpError) {
    console.log(`   ❌ ICP discovery sessions table: ${icpError.message}`);
    issues.push('ICP discovery table missing');
  } else {
    console.log('   ✅ ICP discovery sessions table exists');
  }

  // Step 6: Check for /api/sam/approved-prospects endpoint
  console.log('\n6. Checking Campaign Integration Endpoint...');

  const approvedProspectsPath = require('path').join(
    process.cwd(),
    'app/api/sam/approved-prospects/route.ts'
  );

  if (require('fs').existsSync(approvedProspectsPath)) {
    console.log('   ✅ /api/sam/approved-prospects endpoint exists');
  } else {
    console.log('   ❌ /api/sam/approved-prospects: MISSING');
    issues.push('Campaign integration endpoint /api/sam/approved-prospects missing');
  }

  // Step 7: Check ProspectApprovalModal component
  console.log('\n7. Checking UI Components...');

  const modalPath = require('path').join(
    process.cwd(),
    'components/ProspectApprovalModal.tsx'
  );

  if (require('fs').existsSync(modalPath)) {
    console.log('   ✅ ProspectApprovalModal component exists');
  } else {
    console.log('   ⚠️  ProspectApprovalModal component missing');
    warnings.push('UI component ProspectApprovalModal missing');
  }

  // Step 8: Check workspace_members table (critical for RLS)
  console.log('\n8. Checking Workspace Members Table...');

  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('*')
    .limit(1);

  if (membersError) {
    console.log(`   ❌ workspace_members table: ${membersError.message}`);
    issues.push('workspace_members table missing - RLS will fail');
  } else {
    console.log('   ✅ workspace_members table exists');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY\n');

  if (issues.length === 0 && warnings.length === 0) {
    console.log('✅ All systems operational!');
  } else {
    if (issues.length > 0) {
      console.log(`❌ CRITICAL ISSUES (${issues.length}):\n`);
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }

    if (warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${warnings.length}):\n`);
      warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`);
      });
    }
  }

  // Recommended fixes
  console.log('\n' + '='.repeat(60));
  console.log('🔧 RECOMMENDED FIXES\n');

  if (issues.find(i => i.includes('user_organizations'))) {
    console.log('1. Fix Session API Table References:');
    console.log('   Replace: user_organizations → workspace_members');
    console.log('   Replace: organization_id → workspace_id');
    console.log('   File: app/api/prospect-approval/session/route.ts\n');
  }

  if (issues.find(i => i.includes('/api/sam/approved-prospects'))) {
    console.log('2. Create Campaign Integration Endpoint:');
    console.log('   POST /api/sam/approved-prospects');
    console.log('   → Returns approved prospects from completed sessions');
    console.log('   → Filters by workspace_id');
    console.log('   → Used by campaign creation flow\n');
  }

  if (issues.find(i => i.includes('Table') && i.includes('not deployed'))) {
    console.log('3. Deploy Missing Tables:');
    console.log('   Run migration: supabase/migrations/20251002000000_create_prospect_approval_system.sql');
    console.log('   Via Supabase Dashboard SQL Editor\n');
  }

  console.log('='.repeat(60));
}

verifyProspectApprovalSystem().catch(console.error);
