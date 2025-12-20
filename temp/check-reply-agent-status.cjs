require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('='.repeat(60));
  console.log('REPLY AGENT STATUS CHECK');
  console.log('='.repeat(60) + '\n');

  // 1. Check workspace reply agent config
  console.log('1. WORKSPACE REPLY AGENT CONFIG:');
  console.log('-'.repeat(40));
  
  const { data: configs, error: configError } = await supabase
    .from('workspace_reply_agent_config')
    .select('workspace_id, enabled, approval_mode, ai_model');

  if (configError) {
    console.log('Error:', configError.message);
  } else if (!configs || configs.length === 0) {
    console.log('No workspace configs found');
  } else {
    for (const cfg of configs) {
      const wsId = cfg.workspace_id ? cfg.workspace_id.substring(0, 8) : 'unknown';
      console.log('Workspace:', wsId + '...');
      console.log('  Enabled:', cfg.enabled ? 'YES' : 'NO');
      console.log('  Mode:', cfg.approval_mode);
      console.log('  Model:', cfg.ai_model || 'default');
    }
  }

  // 2. Check LinkedIn accounts being monitored
  console.log('\n2. LINKEDIN ACCOUNTS (for reply monitoring):');
  console.log('-'.repeat(40));

  const { data: accounts, error: accError } = await supabase
    .from('user_unipile_accounts')
    .select('id, account_name, unipile_account_id, provider, is_active, created_at')
    .eq('provider', 'LINKEDIN')
    .order('account_name');

  if (accError) {
    console.log('Error:', accError.message);
  } else if (!accounts || accounts.length === 0) {
    console.log('No LinkedIn accounts found');
  } else {
    const targetNames = ['thorsten', 'charissa', 'irish', 'michelle', 'jennifer'];
    for (const acc of accounts) {
      const nameLower = (acc.account_name || '').toLowerCase();
      const isTarget = targetNames.some(function(n) { return nameLower.includes(n); });
      const marker = isTarget ? '[TARGET]' : '        ';
      console.log(marker, acc.account_name);
      console.log('          Active:', acc.is_active ? 'YES' : 'NO');
      console.log('          Unipile ID:', acc.unipile_account_id);
    }
  }

  // 3. Check recent reply agent activity
  console.log('\n3. RECENT REPLY AGENT DRAFTS (last 24h):');
  console.log('-'.repeat(40));

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: drafts, error: draftError } = await supabase
    .from('reply_agent_drafts')
    .select('id, status, intent_detected, created_at, inbound_message_text')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  if (draftError) {
    console.log('Error:', draftError.message);
  } else if (!drafts || drafts.length === 0) {
    console.log('No drafts in last 24 hours');
  } else {
    console.log('Found', drafts.length, 'drafts:\n');
    for (const d of drafts) {
      const dId = d.id ? d.id.substring(0, 8) : 'unknown';
      const msgPreview = (d.inbound_message_text || '').substring(0, 50);
      console.log('ID:', dId + '...');
      console.log('  Status:', d.status);
      console.log('  Intent:', d.intent_detected || 'n/a');
      console.log('  Message:', msgPreview + '...');
      console.log('  Created:', d.created_at);
      console.log('---');
    }
  }

  // 4. Check cron job schedules
  console.log('\n4. EXPECTED CRON SCHEDULES:');
  console.log('-'.repeat(40));
  console.log('poll-message-replies: Every 2 hours (backup for webhooks)');
  console.log('reply-agent-process:  Every 5 minutes');

})();
