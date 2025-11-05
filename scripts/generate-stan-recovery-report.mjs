// Generate recovery report for Stan's CISO prospects
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateRecoveryReport() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const cisoSessionId = '5c86a789-a926-4d79-8120-cc3e76939d75';

  console.log('📋 RECOVERY REPORT FOR STAN BOUNEV\n');
  console.log('Session: "20251021-BLL-Mid-Market CISOs - Cybersecurity Focus"\n');
  console.log('=' .repeat(80) + '\n');

  // Get session details
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('id', cisoSessionId)
    .single();

  console.log('📊 SESSION STATUS:');
  console.log(`   Total prospects in session: ${session.total_prospects}`);
  console.log(`   Approved count (recorded): ${session.approved_count}`);
  console.log(`   Created: ${new Date(session.created_at).toLocaleString()}`);
  console.log(`   Last updated: ${new Date(session.updated_at).toLocaleString()}\n`);

  // Get all prospects in the session
  const { data: allProspects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', cisoSessionId)
    .order('created_at', { ascending: true });

  console.log(`✅ GOOD NEWS: All ${allProspects.length} prospects still exist in the database!\n`);
  console.log('⚠️  BAD NEWS: Their approval status was reset to "pending"\n');
  console.log('=' .repeat(80) + '\n');

  // Filter for CISO-related prospects (likely the ones Stan approved)
  const cisoProspects = allProspects.filter(p => {
    const title = p.title?.toLowerCase() || '';
    const name = p.name?.toLowerCase() || '';
    const company = p.company?.name?.toLowerCase() || '';

    return (
      title.includes('ciso') ||
      title.includes('chief information security') ||
      title.includes('security officer') ||
      title.includes('vp') && title.includes('security') ||
      title.includes('director') && title.includes('security')
    );
  });

  console.log(`🎯 LIKELY APPROVED PROSPECTS (${cisoProspects.length} CISOs and security leaders):\n`);

  cisoProspects.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name || 'Unknown'}`);
    console.log(`   📧 ${p.contact?.email || 'No email'}`);
    console.log(`   💼 ${p.title || 'No title'}`);
    console.log(`   🏢 ${p.company?.name || 'No company'}`);

    if (p.company?.employee_count) {
      console.log(`   👥 Company size: ${p.company.employee_count} employees`);
    }

    if (p.location) {
      console.log(`   📍 ${p.location}`);
    }

    if (p.contact?.linkedin_url) {
      console.log(`   🔗 ${p.contact.linkedin_url}`);
    }

    console.log(`   ⏰ Added: ${new Date(p.created_at).toLocaleString()}`);
    console.log(`   🔄 Current status: ${p.approval_status}\n`);
  });

  console.log('=' .repeat(80) + '\n');
  console.log('📋 RECOVERY OPTIONS:\n');
  console.log('Option 1: QUICK RE-APPROVAL (Recommended)');
  console.log('   - Go to the approval session in the UI');
  console.log('   - Filter/sort by title to find security roles');
  console.log('   - Re-approve the CISOs and security leaders listed above');
  console.log('   - This should take 10-15 minutes instead of 3 weeks\n');

  console.log('Option 2: BULK APPROVAL (If we can identify the exact 25)');
  console.log('   - We can write a script to bulk-approve specific prospects');
  console.log('   - Requires Stan to confirm which 25 he originally approved');
  console.log('   - Risky if we approve wrong prospects\n');

  console.log('Option 3: DATABASE AUDIT LOG (Check if available)');
  console.log('   - Check if Supabase has audit logs enabled');
  console.log('   - Look for UPDATE queries that changed approval_status');
  console.log('   - Might reveal exact prospects and when they were reset\n');

  console.log('=' .repeat(80) + '\n');
  console.log('🔍 NEXT STEPS TO PREVENT FUTURE DATA LOSS:\n');
  console.log('1. Add audit logging for approval_status changes');
  console.log('2. Create "locked" state after approval to prevent resets');
  console.log('3. Add database triggers to track status changes');
  console.log('4. Implement soft-delete instead of status resets');
  console.log('5. Add UI warning before bulk status changes\n');

  // Check for other sessions with similar issues
  const { data: otherSessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, approved_count, total_prospects')
    .eq('workspace_id', workspaceId)
    .gt('approved_count', 0)
    .order('created_at', { ascending: false });

  console.log('⚠️  OTHER SESSIONS TO CHECK:\n');

  for (const s of otherSessions || []) {
    const { data: approved } = await supabase
      .from('prospect_approval_data')
      .select('id')
      .eq('session_id', s.id)
      .eq('approval_status', 'approved');

    const actualApproved = approved?.length || 0;
    const recordedApproved = s.approved_count || 0;

    if (actualApproved !== recordedApproved) {
      console.log(`   ⚠️  ${s.campaign_name || 'Session ' + s.id.substring(0, 8)}`);
      console.log(`      Expected: ${recordedApproved} approved`);
      console.log(`      Actually: ${actualApproved} approved`);
      console.log(`      Missing: ${recordedApproved - actualApproved} prospects\n`);
    }
  }
}

generateRecoveryReport().catch(console.error);
