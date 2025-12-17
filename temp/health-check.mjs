import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function healthCheck() {
  const now = new Date();
  console.log('=== SYSTEM HEALTH CHECK ===');
  console.log('Time:', now.toISOString());
  console.log('');

  // 1. Queue status
  console.log('📬 SEND QUEUE:');
  const { count: overdue } = await supabase
    .from('send_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('scheduled_for', now.toISOString());
  console.log('  Overdue:', overdue || 0, overdue > 0 ? '⚠️' : '✅');

  const { count: pending } = await supabase
    .from('send_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  console.log('  Pending:', pending || 0);

  const { count: failed } = await supabase
    .from('send_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed');
  console.log('  Failed:', failed || 0, failed > 10 ? '⚠️' : '');

  // 2. Recent failures (last 24h)
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const { data: recentFailures } = await supabase
    .from('send_queue')
    .select('error_message')
    .eq('status', 'failed')
    .gte('updated_at', yesterday.toISOString())
    .limit(20);

  if (recentFailures && recentFailures.length > 0) {
    console.log('');
    console.log('❌ RECENT FAILURES (24h):');
    const errorCounts = {};
    recentFailures.forEach(f => {
      const msg = (f.error_message || 'Unknown').substring(0, 60);
      errorCounts[msg] = (errorCounts[msg] || 0) + 1;
    });
    Object.entries(errorCounts).forEach(([msg, count]) => {
      console.log('  ', count + 'x:', msg);
    });
  }

  // 3. Reply drafts
  console.log('');
  console.log('📝 REPLY DRAFTS:');
  const { count: pendingDrafts } = await supabase
    .from('reply_agent_drafts')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending_approval', 'pending_generation'])
    .gt('expires_at', now.toISOString());
  console.log('  Awaiting approval:', pendingDrafts || 0);

  const { count: expiredDrafts } = await supabase
    .from('reply_agent_drafts')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending_approval', 'pending_generation'])
    .lt('expires_at', now.toISOString());
  console.log('  Expired:', expiredDrafts || 0, expiredDrafts > 5 ? '⚠️ (consider cleanup)' : '');

  // 4. Active campaigns check
  console.log('');
  console.log('📊 ACTIVE CAMPAIGNS:');
  const { data: activeCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, linkedin_account_id, campaign_type')
    .eq('status', 'active');

  if (activeCampaigns) {
    console.log('  Count:', activeCampaigns.length);
    let missingAccount = 0;
    for (const c of activeCampaigns) {
      const isEmailOnly = c.campaign_type === 'email_only';
      const hasLinkedIn = c.linkedin_account_id;
      if (!isEmailOnly && !hasLinkedIn) {
        missingAccount++;
        console.log('  ⚠️ Missing LinkedIn account:', c.name);
      }
    }
    if (missingAccount === 0) {
      console.log('  All LinkedIn campaigns have accounts ✅');
    }
  }

  // 5. Unipile accounts status
  console.log('');
  console.log('🔗 UNIPILE ACCOUNTS:');
  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('account_name, connection_status, platform')
    .eq('platform', 'LINKEDIN');

  if (accounts) {
    const active = accounts.filter(a => a.connection_status === 'active').length;
    const inactive = accounts.filter(a => a.connection_status !== 'active').length;
    console.log('  Active:', active, '✅');
    if (inactive > 0) {
      console.log('  Inactive:', inactive, '⚠️');
      accounts.filter(a => a.connection_status !== 'active').forEach(a => {
        console.log('    -', a.account_name, '(' + a.connection_status + ')');
      });
    }
  }

  // 6. Email queue
  console.log('');
  console.log('📧 EMAIL QUEUE:');
  const { count: emailPending, error: emailErr } = await supabase
    .from('email_send_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (emailErr) {
    console.log('  (table may not exist)');
  } else {
    console.log('  Pending:', emailPending || 0);
  }

  // 7. Stuck campaigns (active with no recent queue activity)
  console.log('');
  console.log('🔍 STUCK CAMPAIGN CHECK:');
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  
  if (activeCampaigns) {
    let stuck = 0;
    for (const c of activeCampaigns) {
      // Skip email-only campaigns
      if (c.campaign_type === 'email_only') continue;
      
      const { count: recentQueue } = await supabase
        .from('send_queue')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', c.id)
        .gte('created_at', threeDaysAgo.toISOString());
      
      if (!recentQueue || recentQueue === 0) {
        const { count: totalQueue } = await supabase
          .from('send_queue')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', c.id);
        
        if (!totalQueue || totalQueue === 0) {
          stuck++;
          console.log('  ⚠️ No queue items:', c.name);
        }
      }
    }
    if (stuck === 0) {
      console.log('  All active campaigns have queue items ✅');
    }
  }

  console.log('');
  console.log('=== END HEALTH CHECK ===');
}

healthCheck().catch(console.error);
