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
  .select('id, user_id, account_data, created_at')
  .ilike('account_data->>display_name', '%Thorsten%')
  .eq('provider', 'LINKEDIN');

if (thorstenError) {
  console.error('Error finding Thorsten:', thorstenError);
} else {
  console.log('Found Thorsten accounts:', thorsten?.length);
  thorsten?.forEach(acc => {
    const data = acc.account_data;
    console.log(`  - ID: ${acc.id}`);
    console.log(`    Name: ${data.display_name}`);
    console.log(`    User ID: ${acc.user_id}`);
  });
}

if (!thorsten || thorsten.length === 0) {
  console.log('\n❌ No Thorsten account found. Exiting.');
  process.exit(1);
}

const thorstenAccountId = thorsten[0].id;
console.log(`\n✅ Using Thorsten account: ${thorstenAccountId}\n`);

// 2. Find campaigns for Thorsten
console.log('2️⃣ Finding campaigns for Thorsten...');
const { data: campaigns, error: campaignsError } = await supabase
  .from('campaigns')
  .select('id, name, linkedin_account_id, created_at')
  .eq('linkedin_account_id', thorstenAccountId)
  .order('created_at', { ascending: false });

if (campaignsError) {
  console.error('Error finding campaigns:', campaignsError);
} else {
  console.log(`Found ${campaigns?.length || 0} campaigns for Thorsten:`);
  campaigns?.forEach(c => {
    console.log(`  - ${c.id}: ${c.name}`);
  });
}

// 3. Check for duplicate messages in last 24 hours
console.log('\n3️⃣ Checking for duplicate messages in last 24 hours...');
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const { data: recentMessages, error: messagesError } = await supabase
  .from('send_queue')
  .select('id, campaign_id, prospect_id, linkedin_user_id, status, scheduled_at, sent_at, created_at')
  .in('campaign_id', campaigns?.map(c => c.id) || [])
  .gte('created_at', oneDayAgo)
  .order('created_at', { ascending: false });

if (messagesError) {
  console.error('Error finding messages:', messagesError);
} else {
  console.log(`Found ${recentMessages?.length || 0} messages in last 24 hours`);
  
  // Group by linkedin_user_id to find duplicates
  const byLinkedInUser = {};
  recentMessages?.forEach(msg => {
    if (!msg.linkedin_user_id) return;
    
    if (!byLinkedInUser[msg.linkedin_user_id]) {
      byLinkedInUser[msg.linkedin_user_id] = [];
    }
    byLinkedInUser[msg.linkedin_user_id].push(msg);
  });
  
  console.log('\n🔍 Checking for duplicates...');
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
        console.log('');
      });
    }
  });
  
  if (!foundDuplicates) {
    console.log('✅ No duplicates found in last 24 hours');
  }
}

// 4. Check unique constraint
console.log('\n4️⃣ Checking unique constraint on send_queue...');
const { data: constraints, error: constraintsError } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT 
      conname AS constraint_name,
      pg_get_constraintdef(oid) AS constraint_def
    FROM pg_constraint
    WHERE conrelid = 'send_queue'::regclass
      AND contype = 'u';
  `
});

if (constraintsError) {
  console.log('Using alternative method to check constraints...');
  const { data: indexes } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'send_queue'
        AND indexdef LIKE '%UNIQUE%';
    `
  });
  console.log('Unique indexes:', JSON.stringify(indexes, null, 2));
} else {
  console.log('Unique constraints:', JSON.stringify(constraints, null, 2));
}

// 5. Check for prospect duplicates in send_queue
console.log('\n5️⃣ Checking for prospect_id duplicates in send_queue...');
const { data: prospectDuplicates, error: prospectDupError } = await supabase
  .from('send_queue')
  .select('prospect_id, campaign_id, count')
  .in('campaign_id', campaigns?.map(c => c.id) || [])
  .gte('created_at', oneDayAgo);

if (prospectDupError) {
  console.error('Error checking prospect duplicates:', prospectDupError);
}

// Group by prospect_id and campaign_id
const prospectGroups = {};
recentMessages?.forEach(msg => {
  const key = `${msg.campaign_id}_${msg.prospect_id}`;
  if (!prospectGroups[key]) {
    prospectGroups[key] = [];
  }
  prospectGroups[key].push(msg);
});

console.log('\nChecking for duplicate (campaign_id, prospect_id) pairs:');
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
    });
  }
});

if (!foundProspectDups) {
  console.log('✅ No duplicate (campaign_id, prospect_id) pairs found');
}

console.log('\n✅ Investigation complete');
