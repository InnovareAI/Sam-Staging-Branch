import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔍 INVESTIGATING DUPLICATE MESSAGE ISSUE\n');

// 1. Find Thorsten's LinkedIn account
console.log('1️⃣ Finding Thorsten Linz LinkedIn account...');
const { data: thorsten, error: thorstenError } = await supabase
  .from('user_unipile_accounts')
  .select('*')
  .ilike('account_name', '%Thorsten%')
  .eq('platform', 'LINKEDIN');

if (thorstenError) {
  console.error('Error finding Thorsten:', thorstenError);
}

if (!thorsten || thorsten.length === 0) {
  console.log('No account with "Thorsten" in name. Checking all LinkedIn accounts...');
  const { data: allLinkedIn } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('platform', 'LINKEDIN');
  
  console.log('\nAll LinkedIn accounts:');
  allLinkedIn?.forEach(acc => {
    console.log(`  - ${acc.account_name} (${acc.id})`);
  });
  
  // Try finding by profile identifier
  const linzAccounts = allLinkedIn?.filter(acc => 
    acc.account_name?.toLowerCase().includes('linz') ||
    acc.linkedin_public_identifier?.toLowerCase().includes('linz')
  );
  
  if (linzAccounts && linzAccounts.length > 0) {
    console.log('\nFound accounts with "linz":');
    linzAccounts.forEach(acc => {
      console.log(`  - ${acc.account_name} (${acc.id})`);
    });
    thorsten.push(...linzAccounts);
  }
}

if (!thorsten || thorsten.length === 0) {
  console.log('\n❌ No Thorsten account found. Exiting.');
  process.exit(1);
}

console.log(`\nFound ${thorsten.length} account(s):`);
thorsten.forEach(acc => {
  console.log(`  - ${acc.account_name} (${acc.id})`);
  console.log(`    Platform: ${acc.platform}`);
  console.log(`    Profile: ${acc.linkedin_profile_url || 'N/A'}`);
  console.log(`    Workspace: ${acc.workspace_id}`);
});

const thorstenAccountId = thorsten[0].id;
console.log(`\n✅ Using account: ${thorstenAccountId}\n`);

// 2. Find campaigns for Thorsten
console.log('2️⃣ Finding campaigns for this account...');
const { data: campaigns, error: campaignsError } = await supabase
  .from('campaigns')
  .select('id, name, linkedin_account_id, created_at, status')
  .eq('linkedin_account_id', thorstenAccountId)
  .order('created_at', { ascending: false });

if (campaignsError) {
  console.error('Error finding campaigns:', campaignsError);
} else {
  console.log(`Found ${campaigns?.length || 0} campaigns:`);
  campaigns?.forEach(c => {
    console.log(`  - ${c.id}: ${c.name} (${c.status})`);
  });
}

if (!campaigns || campaigns.length === 0) {
  console.log('\n❌ No campaigns found for this account.');
  process.exit(1);
}

// 3. Check for duplicate messages in last 24 hours
console.log('\n3️⃣ Checking for duplicate messages in last 24 hours...');
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const { data: recentMessages, error: messagesError } = await supabase
  .from('send_queue')
  .select('*')
  .in('campaign_id', campaigns.map(c => c.id))
  .gte('created_at', oneDayAgo)
  .order('created_at', { ascending: false });

if (messagesError) {
  console.error('Error finding messages:', messagesError);
} else {
  console.log(`Found ${recentMessages?.length || 0} queue entries in last 24 hours`);
  
  // Group by linkedin_user_id to find duplicates
  const byLinkedInUser = {};
  recentMessages?.forEach(msg => {
    if (!msg.linkedin_user_id) return;
    
    if (!byLinkedInUser[msg.linkedin_user_id]) {
      byLinkedInUser[msg.linkedin_user_id] = [];
    }
    byLinkedInUser[msg.linkedin_user_id].push(msg);
  });
  
  console.log('\n🔍 Checking for duplicates by linkedin_user_id...');
  let foundDuplicates = false;
  
  Object.entries(byLinkedInUser).forEach(([linkedInUserId, messages]) => {
    if (messages.length > 1) {
      foundDuplicates = true;
      console.log(`\n⚠️ DUPLICATE FOUND for LinkedIn User: ${linkedInUserId}`);
      console.log(`   ${messages.length} messages sent to same person:\n`);
      
      messages.forEach((msg, idx) => {
        console.log(`   Message ${idx + 1}:`);
        console.log(`     - Queue ID: ${msg.id}`);
        console.log(`     - Campaign: ${msg.campaign_id}`);
        console.log(`     - Prospect: ${msg.prospect_id}`);
        console.log(`     - Status: ${msg.status}`);
        console.log(`     - Created: ${msg.created_at}`);
        console.log(`     - Scheduled: ${msg.scheduled_at}`);
        console.log(`     - Sent: ${msg.sent_at}`);
        console.log(`     - Message Type: ${msg.message_type}`);
        console.log('');
      });
      
      // Time difference
      if (messages.length === 2 && messages[0].sent_at && messages[1].sent_at) {
        const time1 = new Date(messages[0].sent_at);
        const time2 = new Date(messages[1].sent_at);
        const diffMinutes = Math.abs(time1 - time2) / 1000 / 60;
        console.log(`   ⏱️ Time difference: ${diffMinutes.toFixed(2)} minutes\n`);
      }
    }
  });
  
  if (!foundDuplicates) {
    console.log('✅ No duplicates found by linkedin_user_id');
  }
  
  // Check for duplicate (campaign_id, prospect_id) pairs
  console.log('\n🔍 Checking for duplicate (campaign_id, prospect_id) pairs...');
  const prospectGroups = {};
  recentMessages?.forEach(msg => {
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
      console.log(`\n⚠️ DUPLICATE (campaign_id, prospect_id) pair:`);
      console.log(`   Campaign: ${campaignId}`);
      console.log(`   Prospect: ${prospectId}`);
      console.log(`   ${messages.length} queue entries:\n`);
      
      messages.forEach((msg, idx) => {
        console.log(`   Entry ${idx + 1}:`);
        console.log(`     - Queue ID: ${msg.id}`);
        console.log(`     - Status: ${msg.status}`);
        console.log(`     - Created: ${msg.created_at}`);
        console.log(`     - LinkedIn User: ${msg.linkedin_user_id}`);
        console.log(`     - Message Type: ${msg.message_type}`);
      });
    }
  });
  
  if (!foundProspectDups) {
    console.log('✅ No duplicate (campaign_id, prospect_id) pairs found');
  }
}

// 4. Check for Gilad specifically
console.log('\n4️⃣ Searching for Gilad in prospects...');
const { data: giladProspects, error: giladError } = await supabase
  .from('campaign_prospects')
  .select('*')
  .in('campaign_id', campaigns.map(c => c.id))
  .or('first_name.ilike.%Gilad%,last_name.ilike.%Gilad%,full_name.ilike.%Gilad%');

if (giladError) {
  console.error('Error finding Gilad:', giladError);
} else if (giladProspects && giladProspects.length > 0) {
  console.log(`Found ${giladProspects.length} prospect(s) named Gilad:`);
  giladProspects.forEach(p => {
    console.log(`  - ${p.first_name} ${p.last_name} (${p.id})`);
    console.log(`    Campaign: ${p.campaign_id}`);
    console.log(`    LinkedIn: ${p.linkedin_user_id}`);
  });
  
  // Check queue entries for Gilad
  const giladProspectIds = giladProspects.map(p => p.id);
  const { data: giladQueue } = await supabase
    .from('send_queue')
    .select('*')
    .in('prospect_id', giladProspectIds)
    .order('created_at', { ascending: false });
  
  console.log(`\n📬 Queue entries for Gilad (${giladQueue?.length || 0} total):`);
  giladQueue?.forEach(q => {
    console.log(`  - ${q.id}: ${q.status} (${q.message_type})`);
    console.log(`    Created: ${q.created_at}`);
    console.log(`    Sent: ${q.sent_at || 'not sent'}`);
  });
}

console.log('\n✅ Investigation complete');
