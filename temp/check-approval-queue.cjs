require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkApprovalQueue() {
  console.log('🔍 CHECKING PROSPECT APPROVAL QUEUE\n');
  console.log('=' .repeat(70));

  // Get recent prospect approval data
  const { data: approvals } = await supabase
    .from('prospect_approval_data')
    .select('id, search_criteria, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n📋 Recent Prospect Approval Searches:\n');

  if (!approvals || approvals.length === 0) {
    console.log('   No approval data found\n');
    return;
  }

  approvals.forEach((a, i) => {
    const criteria = a.search_criteria || {};
    console.log(`${i + 1}. Search ID: ${a.id}`);
    console.log(`   Criteria: ${JSON.stringify(criteria)}`);
    console.log(`   Status: ${a.status}`);
    console.log(`   Created: ${new Date(a.created_at).toLocaleString()}`);
    console.log('');
  });

  // Look for one that matches BLL/CISO/cybersecurity
  console.log('=' .repeat(70));
  console.log('\n🔍 Looking for BLL CISO cybersecurity search...\n');

  const bllSearch = approvals.find(a => {
    const criteria = JSON.stringify(a.search_criteria || {}).toLowerCase();
    return criteria.includes('cybersecurity') ||
           criteria.includes('ciso') ||
           criteria.includes('mid-market');
  });

  if (bllSearch) {
    console.log(`✅ Found matching search: ${bllSearch.id}`);
    console.log(`   Criteria: ${JSON.stringify(bllSearch.search_criteria, null, 2)}\n`);

    // Get approved prospects for this search
    const { data: prospects, count } = await supabase
      .from('workspace_prospects')
      .select('id, first_name, last_name, company, title, approval_status', { count: 'exact' })
      .eq('approval_data_id', bllSearch.id)
      .order('approval_status', { ascending: true })
      .order('last_name', { ascending: true });

    console.log(`📊 PROSPECTS IN THIS SEARCH: ${count || 0}\n`);

    // Status breakdown
    const statusCounts = {};
    prospects?.forEach(p => {
      const status = p.approval_status || 'pending';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('STATUS BREAKDOWN:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    // Show approved
    const approved = prospects?.filter(p => p.approval_status === 'approved');
    if (approved && approved.length > 0) {
      console.log(`\n\n✅ APPROVED (${approved.length}):\n`);
      approved.forEach((p, i) => {
        console.log(`${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name}`);
        console.log(`    ${p.title || 'No title'} at ${p.company || 'Unknown'}`);
      });
    }

    // Show rejected
    const rejected = prospects?.filter(p => p.approval_status === 'rejected');
    if (rejected && rejected.length > 0) {
      console.log(`\n\n⛔ REJECTED (${rejected.length}):\n`);
      rejected.forEach((p, i) => {
        console.log(`${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name}`);
      });
    }

    console.log('\n' + '=' .repeat(70));
    console.log(`\nSearch ID: ${bllSearch.id}`);
    console.log(`Total: ${count || 0} | Approved: ${approved?.length || 0} | Rejected: ${rejected?.length || 0}\n`);
  }
}

checkApprovalQueue().catch(console.error);
