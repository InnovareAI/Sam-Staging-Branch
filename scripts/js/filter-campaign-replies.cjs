const https = require('https');

const req = https.request({
  hostname: 'latxadqrvrrrcvkktrog.supabase.co',
  path: '/rest/v1/reply_agent_drafts?select=*&order=created_at.desc',
  method: 'GET',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const drafts = JSON.parse(data);

    // Filter to only those with a linked campaign prospect
    const campaignReplies = drafts.filter(d => d.prospect_id && d.campaign_id);
    const inboxOnly = drafts.filter(d => d.prospect_id === null || d.campaign_id === null);

    console.log('📊 DRAFT BREAKDOWN:');
    console.log('   Campaign replies (prospect_id + campaign_id):', campaignReplies.length);
    console.log('   Inbox messages (no campaign link):', inboxOnly.length);
    console.log('   Total:', drafts.length);

    if (campaignReplies.length > 0) {
      console.log('\n========================================');
      console.log('🎯 CAMPAIGN REPLY DRAFTS ONLY');
      console.log('========================================\n');

      // Group by status
      const pending = campaignReplies.filter(d => d.status === 'pending_approval');
      const sent = campaignReplies.filter(d => d.status === 'sent');
      const rejected = campaignReplies.filter(d => d.status === 'rejected');

      console.log('By status:');
      console.log('  🔴 Pending approval:', pending.length);
      console.log('  ✅ Sent:', sent.length);
      console.log('  ❌ Rejected:', rejected.length);

      console.log('\n--- PENDING APPROVAL ---\n');
      pending.forEach((d, i) => {
        console.log((i + 1) + '. ' + d.prospect_name + ' (' + d.prospect_company + ')');
        console.log('   Campaign ID: ' + d.campaign_id);
        console.log('   Created: ' + d.created_at);
        console.log('   Inbound: "' + (d.inbound_message_text || '').substring(0, 100) + '"');
        console.log('   Draft: "' + (d.draft_text || '').substring(0, 100) + '"');
        console.log('');
      });

      console.log('\n--- SENT ---\n');
      sent.forEach((d, i) => {
        console.log((i + 1) + '. ' + d.prospect_name + ' (' + d.prospect_company + ')');
        console.log('   Sent at: ' + d.sent_at);
        console.log('');
      });
    }

    if (inboxOnly.length > 0) {
      console.log('\n========================================');
      console.log('📬 INBOX MESSAGES (not campaign-linked)');
      console.log('========================================\n');

      inboxOnly.forEach((d, i) => {
        console.log((i + 1) + '. ' + d.prospect_name + ' (' + d.prospect_company + ')');
        console.log('   Status: ' + d.status);
        console.log('   Campaign ID: ' + (d.campaign_id || 'NULL'));
        console.log('   Prospect ID: ' + (d.prospect_id || 'NULL'));
        console.log('');
      });
    }
  });
});
req.end();
