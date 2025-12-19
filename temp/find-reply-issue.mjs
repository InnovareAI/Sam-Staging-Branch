import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
)

console.log('=== INVESTIGATING LINKEDIN REPLY DETECTION ===\n')

// 1. Check recent prospects with last_processed_message_id
console.log('1. PROSPECTS WITH RECENT MESSAGE ACTIVITY:')
const { data: recentProspects, error: prospectError } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, last_processed_message_id, responded_at, meeting_booked, meeting_scheduled_at, updated_at')
  .not('last_processed_message_id', 'is', null)
  .order('updated_at', { ascending: false })
  .limit(10)

if (prospectError) {
  console.error('Error:', prospectError)
} else {
  console.log(`Found ${recentProspects.length} prospects with messages`)
  recentProspects.forEach(p => {
    console.log(`\n- ${p.first_name} ${p.last_name} (${p.id})`)
    console.log(`  Status: ${p.status}`)
    console.log(`  Last Message ID: ${p.last_processed_message_id}`)
    console.log(`  Responded At: ${p.responded_at}`)
    console.log(`  Meeting Booked: ${p.meeting_booked}`)
    console.log(`  Meeting Scheduled: ${p.meeting_scheduled_at}`)
    console.log(`  Updated: ${p.updated_at}`)
  })
}

// 2. Check send_queue for recent activity
console.log('\n\n2. RECENT SEND QUEUE ACTIVITY:')
const { data: sentMessages, error: sentError } = await supabase
  .from('send_queue')
  .select('id, prospect_id, message_type, status, sent_at, error_message')
  .eq('status', 'sent')
  .order('sent_at', { ascending: false })
  .limit(10)

if (sentError) {
  console.error('Error:', sentError)
} else {
  console.log(`Recent sent messages: ${sentMessages.length}`)
  sentMessages.forEach(msg => {
    console.log(`\n- Queue ID: ${msg.id}`)
    console.log(`  Prospect: ${msg.prospect_id}`)
    console.log(`  Type: ${msg.message_type}`)
    console.log(`  Sent: ${msg.sent_at}`)
  })
}

// 3. Look for prospects that changed status recently
console.log('\n\n3. PROSPECTS WITH RECENT STATUS CHANGES:')
const { data: statusChanges, error: statusError } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, responded_at, updated_at, unipile_account_id')
  .order('updated_at', { ascending: false })
  .limit(15)

if (statusError) {
  console.error('Error:', statusError)
} else {
  statusChanges.forEach(p => {
    console.log(`\n- ${p.first_name} ${p.last_name}`)
    console.log(`  Status: ${p.status}`)
    console.log(`  Responded: ${p.responded_at}`)
    console.log(`  Updated: ${p.updated_at}`)
    console.log(`  Unipile Account: ${p.unipile_account_id}`)
  })
}

// 4. Check for prospects marked as "responded"
console.log('\n\n4. PROSPECTS WHO RESPONDED (responded_at is set):')
const { data: responded, error: respondedError } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, responded_at, last_processed_message_id, meeting_booked, meeting_scheduled_at')
  .not('responded_at', 'is', null)
  .order('responded_at', { ascending: false })
  .limit(5)

if (respondedError) {
  console.error('Error:', respondedError)
} else {
  console.log(`Found ${responded.length} prospects who responded`)
  responded.forEach(p => {
    console.log(`\n- ${p.first_name} ${p.last_name} (${p.id})`)
    console.log(`  Status: ${p.status}`)
    console.log(`  Responded At: ${p.responded_at}`)
    console.log(`  Last Message ID: ${p.last_processed_message_id}`)
    console.log(`  Meeting Booked: ${p.meeting_booked}`)
    console.log(`  Meeting Scheduled: ${p.meeting_scheduled_at}`)
  })
}

// 5. Check user_unipile_accounts
console.log('\n\n5. LINKEDIN ACCOUNTS:')
const { data: accounts, error: accountsError } = await supabase
  .from('user_unipile_accounts')
  .select('id, account_name, linkedin_public_identifier, workspace_id')
  .eq('platform', 'LINKEDIN')

if (accountsError) {
  console.error('Error:', accountsError)
} else {
  console.log(`Total LinkedIn accounts: ${accounts.length}`)
  accounts.forEach(acc => {
    console.log(`\n- ${acc.account_name}`)
    console.log(`  ID: ${acc.id}`)
    console.log(`  LinkedIn: ${acc.linkedin_public_identifier}`)
    console.log(`  Workspace: ${acc.workspace_id}`)
  })
}
