require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFunnelStages() {
  console.log('🔍 Checking Current Funnel Stage Tracking\n');
  console.log('='.repeat(70));

  // 1. Check all distinct statuses in campaign_prospects
  const { data: statuses } = await supabase
    .from('campaign_prospects')
    .select('status');

  const uniqueStatuses = [...new Set(statuses.map(s => s.status))];

  console.log('\n📊 Current Prospect Statuses in Database:\n');

  const statusCounts = {};
  statuses.forEach(s => {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  });

  Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`   ${status.padEnd(30)} : ${count} prospects`);
    });

  // 2. Expected funnel stages
  console.log('\n\n📋 Expected Funnel Stages:\n');

  const expectedStages = [
    { status: 'pending', description: 'Prospect added to campaign' },
    { status: 'approved', description: 'Approved for messaging' },
    { status: 'ready_to_message', description: 'Ready to send connection request' },
    { status: 'connection_requested', description: 'Connection request sent' },
    { status: 'connection_accepted', description: 'Connection request accepted' },
    { status: 'acceptance_message_sent', description: 'Acceptance message sent' },
    { status: 'fu1_sent', description: 'Follow-up 1 sent' },
    { status: 'fu2_sent', description: 'Follow-up 2 sent' },
    { status: 'fu3_sent', description: 'Follow-up 3 sent' },
    { status: 'fu4_sent', description: 'Follow-up 4 sent' },
    { status: 'gb_sent', description: 'Give & Get sent (final message)' },
    { status: 'replied', description: 'Prospect replied' },
    { status: 'completed', description: 'Funnel completed' },
    { status: 'failed', description: 'Failed to process' },
    { status: 'connection_rejected', description: 'Connection request rejected' }
  ];

  expectedStages.forEach(stage => {
    const exists = uniqueStatuses.includes(stage.status);
    const count = statusCounts[stage.status] || 0;
    console.log(`   ${exists ? '✅' : '❌'} ${stage.status.padEnd(30)} - ${stage.description} ${count > 0 ? `(${count})` : ''}`);
  });

  // 3. Check campaigns table for flow settings
  console.log('\n\n🔧 Campaign Flow Settings:\n');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, flow_settings, campaign_type')
    .eq('status', 'active')
    .limit(3);

  campaigns.forEach((c, index) => {
    console.log(`\n${index + 1}. ${c.name}`);
    console.log(`   Campaign Type: ${c.campaign_type || 'NOT SET'}`);
    if (c.flow_settings) {
      console.log(`   Flow Settings: ${JSON.stringify(c.flow_settings, null, 2)}`);
    } else {
      console.log(`   Flow Settings: NOT CONFIGURED ❌`);
    }
  });

  // 4. Check for status tracking in personalization_data
  console.log('\n\n📝 Checking personalization_data for stage tracking:\n');

  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('status, personalization_data, contacted_at, last_message_sent_at')
    .not('contacted_at', 'is', null)
    .order('contacted_at', { ascending: false })
    .limit(5);

  prospects.forEach((p, index) => {
    console.log(`\n${index + 1}. Status: ${p.status}`);
    console.log(`   Contacted: ${p.contacted_at}`);
    console.log(`   Last Message: ${p.last_message_sent_at || 'NONE'}`);
    if (p.personalization_data) {
      const trackingFields = Object.keys(p.personalization_data).filter(k =>
        k.includes('stage') ||
        k.includes('status') ||
        k.includes('_sent') ||
        k.includes('accepted') ||
        k.includes('n8n')
      );
      if (trackingFields.length > 0) {
        console.log(`   Tracking Fields: ${trackingFields.join(', ')}`);
        trackingFields.forEach(field => {
          console.log(`     - ${field}: ${p.personalization_data[field]}`);
        });
      } else {
        console.log(`   Tracking Fields: NONE FOUND ❌`);
      }
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n🎯 SUMMARY:\n');

  const missingStages = expectedStages.filter(s => !uniqueStatuses.includes(s.status));

  if (missingStages.length > 0) {
    console.log('⚠️  Missing Stages (never used):');
    missingStages.forEach(s => {
      console.log(`   - ${s.status} (${s.description})`);
    });
  } else {
    console.log('✅ All expected stages have been used at least once');
  }

  console.log('\n💡 Next Steps:');
  console.log('   1. Check N8N workflow to ensure it sends status updates');
  console.log('   2. Verify status update webhook endpoint exists');
  console.log('   3. Update execute-via-n8n to track all stages');
  console.log('   4. Add flow_settings to campaigns table\n');
}

checkFunnelStages().catch(console.error);
