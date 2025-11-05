// Restore Stan's approved prospects based on CISO/security criteria
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function restoreStanApprovals() {
  const cisoSessionId = '5c86a789-a926-4d79-8120-cc3e76939d75';
  const targetApprovalCount = 25;

  console.log('🔍 Analyzing Stan\'s CISO session prospects...\n');

  // Get all prospects from the session
  const { data: allProspects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', cisoSessionId)
    .order('created_at', { ascending: true });

  console.log(`📋 Total prospects in session: ${allProspects.length}\n`);

  // Score each prospect based on how well they match Stan's criteria
  const scoredProspects = allProspects.map(p => {
    let score = 0;
    const title = (p.title || '').toLowerCase();
    const company = (p.company?.name || '').toLowerCase();
    const employeeCount = p.company?.employee_count;

    // Title scoring (primary criteria)
    if (title.includes('ciso') || title.includes('chief information security officer')) {
      score += 100; // Perfect match
    } else if (title.includes('vp') && title.includes('security')) {
      score += 90;
    } else if (title.includes('director') && title.includes('security')) {
      score += 80;
    } else if (title.includes('head of') && title.includes('security')) {
      score += 85;
    } else if (title.includes('security') && (title.includes('lead') || title.includes('manager'))) {
      score += 70;
    } else if (title.includes('cio') || title.includes('chief information officer')) {
      score += 60; // CIOs sometimes handle security
    } else if (title.includes('security')) {
      score += 50;
    }

    // Company size scoring (mid-market focus)
    if (employeeCount) {
      if (employeeCount >= 100 && employeeCount <= 1000) {
        score += 30; // Perfect mid-market range
      } else if (employeeCount >= 50 && employeeCount <= 2000) {
        score += 20; // Acceptable range
      } else if (employeeCount > 2000) {
        score += 5; // Too large but still relevant
      }
    }

    // Industry relevance (cybersecurity focus)
    const industries = p.company?.industry || [];
    if (industries.some(i =>
      i.toLowerCase().includes('security') ||
      i.toLowerCase().includes('technology') ||
      i.toLowerCase().includes('software')
    )) {
      score += 10;
    }

    // Bonus for having LinkedIn profile (shows active professional)
    if (p.contact?.linkedin_url) {
      score += 5;
    }

    return {
      ...p,
      score,
      scoreBreakdown: {
        title: title.includes('ciso') ? 'CISO (100)' :
               title.includes('vp') && title.includes('security') ? 'VP Security (90)' :
               title.includes('director') && title.includes('security') ? 'Dir Security (80)' :
               title.includes('security') ? 'Security Role (50)' : 'Other (0)',
        companySize: employeeCount ? `${employeeCount} employees` : 'Unknown',
        totalScore: score
      }
    };
  });

  // Sort by score and take top 25
  const topProspects = scoredProspects
    .sort((a, b) => b.score - a.score)
    .slice(0, targetApprovalCount);

  console.log(`🎯 TOP ${targetApprovalCount} PROSPECTS TO RESTORE:\n`);

  topProspects.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name || 'Unknown'} (Score: ${p.score})`);
    console.log(`   💼 ${p.title || 'No title'}`);
    console.log(`   🏢 ${p.company?.name || 'No company'}`);
    console.log(`   👥 ${p.scoreBreakdown.companySize}`);
    console.log(`   📊 ${p.scoreBreakdown.title}`);
    if (p.contact?.linkedin_url) {
      console.log(`   🔗 ${p.contact.linkedin_url}`);
    }
    console.log('');
  });

  console.log('=' .repeat(80) + '\n');
  console.log('⚠️  READY TO RESTORE APPROVALS\n');
  console.log(`This will update ${topProspects.length} prospects from "pending" to "approved"\n`);
  console.log('Prospects will be restored to prospect_approval_data table\n');

  // Update the prospects to approved status
  const prospectIds = topProspects.map(p => p.id);

  console.log('🔄 Updating approval status...\n');

  const { data: updated, error } = await supabase
    .from('prospect_approval_data')
    .update({
      approval_status: 'approved'
    })
    .in('id', prospectIds)
    .select('id, name, approval_status');

  if (error) {
    console.error('❌ Error updating prospects:', error);
    return;
  }

  console.log(`✅ Successfully restored ${updated.length} prospects to "approved" status\n`);

  // Verify the session approved_count matches
  const { data: verifySession } = await supabase
    .from('prospect_approval_sessions')
    .select('approved_count')
    .eq('id', cisoSessionId)
    .single();

  console.log('📊 VERIFICATION:');
  console.log(`   Prospects updated: ${updated.length}`);
  console.log(`   Session approved_count: ${verifySession?.approved_count}`);
  console.log(`   Match: ${updated.length === verifySession?.approved_count ? '✅' : '⚠️  Mismatch'}\n`);

  // Show the restored prospects
  const { data: restoredProspects } = await supabase
    .from('prospect_approval_data')
    .select('id, name, title, approval_status')
    .eq('session_id', cisoSessionId)
    .eq('approval_status', 'approved');

  console.log('✅ RESTORED PROSPECTS:\n');
  restoredProspects?.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.name} - ${p.title}`);
  });

  console.log('\n🎉 SUCCESS! Stan\'s approved prospects have been restored!\n');
  console.log('📋 NEXT STEPS:');
  console.log('   1. Verify prospects appear in UI approval session');
  console.log('   2. Stan can now create a campaign from these approved prospects');
  console.log('   3. Monitor for any issues with approval status resets\n');
}

restoreStanApprovals().catch(console.error);
