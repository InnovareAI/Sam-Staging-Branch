import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔍 INVESTIGATING DUPLICATE MESSAGE ISSUE (EXTENDED)\n');

// 1. Find Thorsten's LinkedIn account
const { data: thorsten } = await supabase
  .from('user_unipile_accounts')
  .select('*')
  .ilike('account_name', '%Thorsten%')
  .eq('platform', 'LINKEDIN');

const thorstenAccountId = thorsten[0].id;
console.log(`Using Thorsten account: ${thorstenAccountId}\n`);

// 2. Find campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status')
  .eq('linkedin_account_id', thorstenAccountId)
  .order('created_at', { ascending: false });

console.log(`Found ${campaigns.length} campaigns\n`);

// 3. Check for messages in last 72 hours (3 days)
console.log('🔍 Checking for messages in last 72 hours...');
const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

const { data: recentMessages } = await supabase
  .from('send_queue')
  .select('*')
  .in('campaign_id', campaigns.map(c => c.id))
  .gte('created_at', threeDaysAgo)
  .order('created_at', { ascending: false });

console.log(`Found ${recentMessages?.length || 0} queue entries in last 72 hours\n`);

if (recentMessages && recentMessages.length > 0) {
  // Group by linkedin_user_id
  const byLinkedInUser = {};
  recentMessages.forEach(msg => {
    if (!msg.linkedin_user_id) return;
    
    if (!byLinkedInUser[msg.linkedin_user_id]) {
      byLinkedInUser[msg.linkedin_user_id] = [];
    }
    byLinkedInUser[msg.linkedin_user_id].push(msg);
  });
  
  console.log('🔍 Checking for duplicates by linkedin_user_id...');
  let foundDuplicates = false;
  
  Object.entries(byLinkedInUser).forEach(([linkedInUserId, messages]) => {
    if (messages.length > 1) {
      foundDuplicates = true;
      console.log(`\n⚠️⚠️⚠️ DUPLICATE FOUND ⚠️⚠️⚠️`);
      console.log(`LinkedIn User ID: ${linkedInUserId}`);
      console.log(`${messages.length} messages sent to same person:\n`);
      
      messages.forEach((msg, idx) => {
        console.log(`Message ${idx + 1}:`);
        console.log(`  Queue ID: ${msg.id}`);
        console.log(`  Campaign: ${msg.campaign_id}`);
        console.log(`  Prospect: ${msg.prospect_id}`);
        console.log(`  Status: ${msg.status}`);
        console.log(`  Created: ${msg.created_at}`);
        console.log(`  Scheduled: ${msg.scheduled_at}`);
        console.log(`  Sent: ${msg.sent_at}`);
        console.log(`  Message Type: ${msg.message_type}`);
        console.log('');
      });
      
      // Calculate time difference
      if (messages.length >= 2) {
        const sortedBySent = messages.filter(m => m.sent_at).sort((a, b) => 
          new Date(a.sent_at) - new Date(b.sent_at)
        );
        
        if (sortedBySent.length >= 2) {
          const time1 = new Date(sortedBySent[0].sent_at);
          const time2 = new Date(sortedBySent[1].sent_at);
          const diffMinutes = Math.abs(time2 - time1) / 1000 / 60;
          console.log(`⏱️ Time between sends: ${diffMinutes.toFixed(2)} minutes`);
          console.log(`   First sent: ${sortedBySent[0].sent_at}`);
          console.log(`   Second sent: ${sortedBySent[1].sent_at}\n`);
        }
      }
      
      // Get prospect details
      const prospectIds = messages.map(m => m.prospect_id).filter(Boolean);
      if (prospectIds.length > 0) {
        console.log('Fetching prospect details...');
      }
    }
  });
  
  if (!foundDuplicates) {
    console.log('✅ No duplicates found by linkedin_user_id\n');
  }
  
  // Check for duplicate (campaign_id, prospect_id) pairs
  console.log('🔍 Checking for duplicate (campaign_id, prospect_id) pairs...');
  const prospectGroups = {};
  recentMessages.forEach(msg => {
    const key = `${msg.campaign_id}_${msg.prospect_id}`;
    if (!prospectGroups[key]) {
      prospectGroups[key] = [];
    }
    prospectGroups[key].push(msg);
  });
  
  let foundProspectDups = false;
  Object.entries(prospectGroups).forEach(([key, messages]) => {
    if (messages.length > 1) {
      foundProspectDups = true;
      const [campaignId, prospectId] = key.split('_');
      console.log(`\n⚠️ DUPLICATE (campaign_id, prospect_id):`);
      console.log(`   Campaign: ${campaignId}`);
      console.log(`   Prospect: ${prospectId}`);
      console.log(`   ${messages.length} queue entries`);
    }
  });
  
  if (!foundProspectDups) {
    console.log('✅ No duplicate (campaign_id, prospect_id) pairs\n');
  }
}

// 4. Search for Gilad
console.log('🔍 Searching for Gilad in prospects...');
const { data: giladProspects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .in('campaign_id', campaigns.map(c => c.id))
  .or('first_name.ilike.%Gilad%,last_name.ilike.%Gilad%');

if (giladProspects && giladProspects.length > 0) {
  console.log(`\nFound ${giladProspects.length} prospect(s) named Gilad:`);
  
  for (const p of giladProspects) {
    console.log(`\n  Prospect: ${p.first_name} ${p.last_name}`);
    console.log(`  ID: ${p.id}`);
    console.log(`  Campaign: ${p.campaign_id}`);
    console.log(`  LinkedIn User ID: ${p.linkedin_user_id}`);
    
    // Get ALL queue entries for this prospect (no time limit)
    const { data: prospectQueue } = await supabase
      .from('send_queue')
      .select('*')
      .eq('prospect_id', p.id)
      .order('created_at', { ascending: false });
    
    console.log(`  Queue entries: ${prospectQueue?.length || 0}`);
    prospectQueue?.forEach(q => {
      console.log(`    - ${q.id}: ${q.status} (${q.message_type})`);
      console.log(`      Created: ${q.created_at}`);
      console.log(`      Sent: ${q.sent_at || 'not sent'}`);
    });
  }
} else {
  console.log('No prospects named Gilad found');
}

// 5. Check all sent messages (no time filter)
console.log('\n🔍 Checking ALL sent messages for duplicates...');
const { data: allSent } = await supabase
  .from('send_queue')
  .select('*')
  .in('campaign_id', campaigns.map(c => c.id))
  .eq('status', 'sent')
  .order('sent_at', { ascending: false })
  .limit(100);

console.log(`Found ${allSent?.length || 0} sent messages (last 100)\n`);

// Group by linkedin_user_id
const sentByUser = {};
allSent?.forEach(msg => {
  if (!msg.linkedin_user_id) return;
  if (!sentByUser[msg.linkedin_user_id]) {
    sentByUser[msg.linkedin_user_id] = [];
  }
  sentByUser[msg.linkedin_user_id].push(msg);
});

console.log('Checking for any duplicates in sent messages:');
let foundAnyDups = false;
Object.entries(sentByUser).forEach(([linkedInUserId, messages]) => {
  if (messages.length > 1) {
    foundAnyDups = true;
    console.log(`\n⚠️ User ${linkedInUserId}: ${messages.length} messages`);
    messages.forEach((msg, idx) => {
      console.log(`  ${idx + 1}. ${msg.sent_at} - ${msg.message_type} (${msg.status})`);
    });
  }
});

if (!foundAnyDups) {
  console.log('✅ No duplicates in last 100 sent messages');
}

console.log('\n✅ Investigation complete');
