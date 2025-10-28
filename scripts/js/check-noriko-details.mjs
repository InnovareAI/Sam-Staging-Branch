import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking Noriko\'s (3cubed) campaign delivery details...\\n');

const workspaceId = 'ecb08e55-2b7e-4d49-8f50-d38e39ce2482'; // 3cubed workspace
const activeCampaignId = 'ba20c801-74ad-461f-960f-020d79091973'; // Most recent scheduled

// Get campaign details
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('id', activeCampaignId)
  .single();

console.log(`📊 Campaign: ${campaign.name}`);
console.log(`   Status: ${campaign.status}`);
console.log(`   Created: ${new Date(campaign.created_at).toLocaleString()}`);
console.log(`   Updated: ${new Date(campaign.updated_at).toLocaleString()}\\n`);

// Get ALL prospects with details
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', activeCampaignId)
  .order('contacted_at', { ascending: false });

console.log(`Total prospects: ${prospects?.length || 0}\\n`);

// Breakdown by status
const statusCounts = {};
let withLinkedIn = 0;
let sent = 0;

for (const p of prospects || []) {
  statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  if (p.linkedin_url) withLinkedIn++;
  if (p.contacted_at) sent++;
}

console.log('📈 Status Breakdown:');
for (const [status, count] of Object.entries(statusCounts)) {
  console.log(`   ${status}: ${count}`);
}
console.log(`   With LinkedIn URL: ${withLinkedIn}`);
console.log(`   Already sent: ${sent}\\n`);

// Show sent prospects
const sentProspects = prospects.filter(p => p.contacted_at);
if (sentProspects.length > 0) {
  console.log(`✅ Sent Connection Requests (${sentProspects.length} total):\\n`);
  for (const p of sentProspects) {
    console.log(`   ${p.first_name} ${p.last_name} at ${p.company_name}`);
    console.log(`      Status: ${p.status}`);
    console.log(`      Sent: ${new Date(p.contacted_at).toLocaleString()}`);
    console.log(`      LinkedIn: ${p.linkedin_url ? 'YES' : 'NO'}`);
    console.log('');
  }
}

// Show pending (eligible for sending)
const pendingProspects = prospects.filter(p =>
  ['pending', 'approved', 'ready_to_message'].includes(p.status) &&
  p.linkedin_url &&
  !p.contacted_at
);

if (pendingProspects.length > 0) {
  console.log(`⏳ Pending (Ready to Send) - ${pendingProspects.length} prospects:\\n`);
  for (const p of pendingProspects.slice(0, 5)) {
    console.log(`   - ${p.first_name} ${p.last_name} at ${p.company_name}`);
    console.log(`     LinkedIn: ${p.linkedin_url}`);
  }
  if (pendingProspects.length > 5) {
    console.log(`   ... and ${pendingProspects.length - 5} more\\n`);
  }

  console.log(`\\n🤖 Cron job should process these automatically every 2 minutes`);
  console.log(`   Campaign status: ${campaign.status} (must be 'active' or 'scheduled')`);
  console.log(`   Next cron run: within 2 minutes\\n`);
}

// Check when cron last ran
console.log('\\n🔍 Checking recent cron activity...\\n');

// Get recent sends across ALL campaigns (to verify cron is working)
const { data: recentSends } = await supabase
  .from('campaign_prospects')
  .select(`
    first_name,
    last_name,
    company_name,
    contacted_at,
    status,
    campaigns (
      name,
      workspace_id
    )
  `)
  .not('contacted_at', 'is', null)
  .gte('contacted_at', new Date(Date.now() - 600000).toISOString()) // Last 10 minutes
  .order('contacted_at', { ascending: false })
  .limit(10);

if (recentSends && recentSends.length > 0) {
  console.log(`✅ Cron is ACTIVE - ${recentSends.length} connection requests sent in last 10 minutes:\\n`);
  for (const p of recentSends) {
    console.log(`   ✅ ${p.first_name} ${p.last_name} at ${p.company_name}`);
    console.log(`      Campaign: ${p.campaigns.name}`);
    console.log(`      Sent: ${new Date(p.contacted_at).toLocaleString()}\\n`);
  }
} else {
  console.log(`⚠️  No connection requests sent in last 10 minutes`);
  console.log(`   Cron may not be running, or no prospects were ready\\n`);
}

console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Delivery check complete');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');
