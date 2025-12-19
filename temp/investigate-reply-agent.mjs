import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
)

console.log('=== LINKEDIN REPLY AGENT INVESTIGATION ===\n')

// 1. Check reply_agent_queue for pending/failed entries
console.log('1. REPLY AGENT QUEUE STATUS:')
const { data: queueData, error: queueError } = await supabase
  .from('reply_agent_queue')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(20)

if (queueError) {
  console.error('Error fetching queue:', queueError)
} else {
  console.log(`Total entries: ${queueData.length}`)

  const pending = queueData.filter(q => q.status === 'pending')
  const processing = queueData.filter(q => q.status === 'processing')
  const completed = queueData.filter(q => q.status === 'completed')
  const failed = queueData.filter(q => q.status === 'failed')

  console.log(`- Pending: ${pending.length}`)
  console.log(`- Processing: ${processing.length}`)
  console.log(`- Completed: ${completed.length}`)
  console.log(`- Failed: ${failed.length}\n`)

  if (pending.length > 0) {
    console.log('PENDING ENTRIES:')
    pending.forEach(entry => {
      console.log(`- ID: ${entry.id}`)
      console.log(`  LinkedIn Account: ${entry.linkedin_account_id}`)
      console.log(`  Message ID: ${entry.unipile_message_id}`)
      console.log(`  Created: ${entry.created_at}`)
      console.log(`  Last Error: ${entry.last_error || 'None'}\n`)
    })
  }

  if (failed.length > 0) {
    console.log('FAILED ENTRIES:')
    failed.forEach(entry => {
      console.log(`- ID: ${entry.id}`)
      console.log(`  LinkedIn Account: ${entry.linkedin_account_id}`)
      console.log(`  Message ID: ${entry.unipile_message_id}`)
      console.log(`  Created: ${entry.created_at}`)
      console.log(`  Failed At: ${entry.failed_at}`)
      console.log(`  Error: ${entry.last_error}\n`)
    })
  }
}

// 2. Check recent LinkedIn messages from send_queue
console.log('\n2. RECENT LINKEDIN MESSAGES (from send_queue):')
const { data: sentMessages, error: sentError } = await supabase
  .from('send_queue')
  .select('*, campaign_prospects(*)')
  .eq('status', 'sent')
  .not('unipile_message_id', 'is', null)
  .order('sent_at', { ascending: false })
  .limit(10)

if (sentError) {
  console.error('Error fetching sent messages:', sentError)
} else {
  console.log(`Recent sent messages: ${sentMessages.length}`)
  sentMessages.forEach(msg => {
    console.log(`- Campaign Prospect: ${msg.campaign_prospect_id}`)
    console.log(`  LinkedIn Account: ${msg.linkedin_account_id}`)
    console.log(`  Unipile Message ID: ${msg.unipile_message_id}`)
    console.log(`  Sent At: ${msg.sent_at}`)
    console.log(`  Message Type: ${msg.message_type}\n`)
  })
}

// 3. Check campaign_prospects for reply_received = true
console.log('\n3. PROSPECTS WITH REPLIES RECEIVED:')
const { data: repliedProspects, error: repliedError } = await supabase
  .from('campaign_prospects')
  .select('*, campaigns(name), user_unipile_accounts(account_username)')
  .eq('reply_received', true)
  .order('reply_received_at', { ascending: false })
  .limit(10)

if (repliedError) {
  console.error('Error fetching replied prospects:', repliedError)
} else {
  console.log(`Prospects with replies: ${repliedProspects.length}`)
  repliedProspects.forEach(prospect => {
    console.log(`- Prospect: ${prospect.first_name} ${prospect.last_name}`)
    console.log(`  Campaign: ${prospect.campaigns?.name}`)
    console.log(`  LinkedIn Account: ${prospect.user_unipile_accounts?.account_username}`)
    console.log(`  Reply Received At: ${prospect.reply_received_at}`)
    console.log(`  Latest Unipile Message ID: ${prospect.latest_unipile_message_id}`)
    console.log(`  Reply Agent Status: ${prospect.reply_agent_status || 'None'}\n`)
  })
}

// 4. Check for LinkedIn accounts
console.log('\n4. LINKEDIN ACCOUNTS:')
const { data: accounts, error: accountsError } = await supabase
  .from('user_unipile_accounts')
  .select('id, account_username, workspace_id')
  .eq('provider', 'LINKEDIN')

if (accountsError) {
  console.error('Error fetching accounts:', accountsError)
} else {
  console.log(`Total LinkedIn accounts: ${accounts.length}`)
  accounts.forEach(acc => {
    console.log(`- ${acc.account_username} (${acc.id})`)
    console.log(`  Workspace: ${acc.workspace_id}\n`)
  })
}

// 5. Check for very recent campaign_prospects updates
console.log('\n5. MOST RECENT PROSPECT UPDATES:')
const { data: recentUpdates, error: updatesError } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, reply_received, reply_received_at, updated_at')
  .order('updated_at', { ascending: false })
  .limit(10)

if (updatesError) {
  console.error('Error fetching recent updates:', updatesError)
} else {
  recentUpdates.forEach(prospect => {
    console.log(`- ${prospect.first_name} ${prospect.last_name} (${prospect.id})`)
    console.log(`  Status: ${prospect.status}`)
    console.log(`  Reply Received: ${prospect.reply_received}`)
    console.log(`  Reply Received At: ${prospect.reply_received_at}`)
    console.log(`  Updated At: ${prospect.updated_at}\n`)
  })
}
