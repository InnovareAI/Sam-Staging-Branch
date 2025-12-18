import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function report() {
  // Get all LinkedIn accounts
  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('id, account_name, workspace_id')
    .eq('platform', 'LINKEDIN');

  console.log('=== CAMPAIGN STATS BY LINKEDIN ACCOUNT ===');
  console.log('');

  for (const acc of accounts) {
    // Get campaigns for this account
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, status')
      .eq('linkedin_account_id', acc.id);

    if (!campaigns || campaigns.length === 0) continue;

    console.log('📊', acc.account_name);
    console.log('─'.repeat(50));

    let totalSent = 0;
    let totalAccepted = 0;
    let totalReplied = 0;
    let totalPending = 0;
    let hasActivity = false;

    for (const camp of campaigns) {
      // Get queue stats (CRs sent)
      const { count: sentC } = await supabase
        .from('send_queue')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', camp.id)
        .eq('status', 'sent');

      const { count: pendC } = await supabase
        .from('send_queue')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', camp.id)
        .eq('status', 'pending');

      // Get prospect stats (accepted, replied)
      const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('status, replied_at')
        .eq('campaign_id', camp.id);

      const accepted = prospects ? prospects.filter(p => p.status === 'connected' || p.status === 'accepted').length : 0;
      const replied = prospects ? prospects.filter(p => p.replied_at != null).length : 0;

      if (sentC > 0 || pendC > 0 || accepted > 0) {
        hasActivity = true;
        console.log('  Campaign:', camp.name, '(' + camp.status + ')');
        console.log('    CRs Sent:', sentC || 0);
        console.log('    Pending:', pendC || 0);
        console.log('    Accepted:', accepted);
        console.log('    Replied:', replied);
        console.log('');

        totalSent += sentC || 0;
        totalPending += pendC || 0;
        totalAccepted += accepted;
        totalReplied += replied;
      }
    }

    if (hasActivity) {
      console.log('  TOTAL: Sent=' + totalSent + ', Pending=' + totalPending + ', Accepted=' + totalAccepted + ', Replied=' + totalReplied);
      console.log('');
    }
  }
}

report().catch(console.error);
