import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
)

// Check campaign_prospects columns
console.log('=== CHECKING ACTUAL SCHEMA ===\n')

console.log('1. Campaign Prospects (first row):')
const { data: prospect, error: prospectError } = await supabase
  .from('campaign_prospects')
  .select('*')
  .limit(1)

if (prospectError) {
  console.error('Error:', prospectError)
} else if (prospect && prospect.length > 0) {
  console.log('Columns:', Object.keys(prospect[0]).join(', '))
}

console.log('\n2. Send Queue (first row):')
const { data: queue, error: queueError } = await supabase
  .from('send_queue')
  .select('*')
  .limit(1)

if (queueError) {
  console.error('Error:', queueError)
} else if (queue && queue.length > 0) {
  console.log('Columns:', Object.keys(queue[0]).join(', '))
}

console.log('\n3. User Unipile Accounts (first row):')
const { data: account, error: accountError } = await supabase
  .from('user_unipile_accounts')
  .select('*')
  .limit(1)

if (accountError) {
  console.error('Error:', accountError)
} else if (account && account.length > 0) {
  console.log('Columns:', Object.keys(account[0]).join(', '))
}

console.log('\n4. Check for messaging_queue table:')
const { data: msgQueue, error: msgError } = await supabase
  .from('messaging_queue')
  .select('*')
  .limit(1)

if (msgError) {
  console.error('Error:', msgError)
} else if (msgQueue) {
  console.log('messaging_queue exists')
  if (msgQueue.length > 0) {
    console.log('Columns:', Object.keys(msgQueue[0]).join(', '))
  }
}

console.log('\n5. Check for linkedin_replies table:')
const { data: replies, error: repliesError } = await supabase
  .from('linkedin_replies')
  .select('*')
  .limit(1)

if (repliesError) {
  console.error('Error:', repliesError)
} else if (replies) {
  console.log('linkedin_replies exists')
  if (replies.length > 0) {
    console.log('Columns:', Object.keys(replies[0]).join(', '))
  }
}
