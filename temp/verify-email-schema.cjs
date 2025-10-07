const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function verifySchema() {
  console.log('🔍 Verifying email system schema...\n')

  // Check email_responses table
  console.log('📋 Checking email_responses table...')
  const { data: emailData, error: emailError } = await supabase
    .from('email_responses')
    .select('*')
    .limit(1)

  if (emailError) {
    console.log('❌ email_responses table does not exist')
    console.log('   Error:', emailError.message)
  } else {
    console.log('✅ email_responses table exists')
    const { count } = await supabase
      .from('email_responses')
      .select('*', { count: 'exact', head: true })
    console.log(`   Records: ${count}`)
  }

  // Check message_outbox table
  console.log('\n📋 Checking message_outbox table...')
  const { data: outboxData, error: outboxError } = await supabase
    .from('message_outbox')
    .select('*')
    .limit(1)

  if (outboxError) {
    console.log('❌ message_outbox table does not exist')
    console.log('   Error:', outboxError.message)
  } else {
    console.log('✅ message_outbox table exists')
    const { count } = await supabase
      .from('message_outbox')
      .select('*', { count: 'exact', head: true })
    console.log(`   Records: ${count}`)
  }

  // Check campaign_replies columns
  console.log('\n📋 Checking campaign_replies HITL columns...')
  const { data: replyData, error: replyError } = await supabase
    .from('campaign_replies')
    .select('id, status, ai_suggested_response, final_message, priority, reviewed_by, reviewed_at')
    .limit(1)

  if (replyError) {
    console.log('❌ campaign_replies HITL columns missing')
    console.log('   Error:', replyError.message)
  } else {
    console.log('✅ campaign_replies HITL columns exist')
    const { count } = await supabase
      .from('campaign_replies')
      .select('*', { count: 'exact', head: true })
    console.log(`   Total replies: ${count}`)
  }

  console.log('\n' + '='.repeat(50))

  if (!emailError && !outboxError && !replyError) {
    console.log('✅ ALL TABLES AND COLUMNS EXIST')
    console.log('✅ Email system schema is ready!')
  } else {
    console.log('⚠️  MIGRATIONS NEEDED')
    console.log('\n📝 To apply migrations:')
    console.log('1. Open Supabase Dashboard SQL Editor')
    console.log('2. Copy and paste these migration files:')
    if (emailError) {
      console.log('   - supabase/migrations/20251007000001_create_email_responses_fixed.sql')
    }
    if (outboxError || replyError) {
      console.log('   - supabase/migrations/20251007000002_create_message_outbox_and_update_replies.sql')
    }
    console.log('3. Run each migration')
  }
}

verifySchema().catch(console.error)
