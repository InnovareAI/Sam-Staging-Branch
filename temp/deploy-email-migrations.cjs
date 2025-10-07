const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function runMigration(filePath) {
  console.log(`\n📄 Running migration: ${path.basename(filePath)}`)

  const sql = fs.readFileSync(filePath, 'utf8')

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      console.error('❌ Migration failed:', error.message)
      console.error('Details:', error)
      return false
    }

    console.log('✅ Migration successful')
    return true
  } catch (err) {
    console.error('❌ Error running migration:', err.message)
    return false
  }
}

async function main() {
  console.log('🚀 Deploying email system migrations to production...\n')

  const migrations = [
    'supabase/migrations/20251007000001_create_email_responses_fixed.sql',
    'supabase/migrations/20251007000002_create_message_outbox_and_update_replies.sql'
  ]

  for (const migration of migrations) {
    const success = await runMigration(migration)
    if (!success) {
      console.error('\n❌ Migration failed. Stopping deployment.')
      process.exit(1)
    }
  }

  console.log('\n✅ All migrations deployed successfully!')

  // Verify tables exist
  console.log('\n🔍 Verifying tables...')

  const { data: emailResponses } = await supabase
    .from('email_responses')
    .select('count')
    .limit(1)

  const { data: messageOutbox } = await supabase
    .from('message_outbox')
    .select('count')
    .limit(1)

  console.log('✅ email_responses table:', emailResponses ? 'exists' : 'NOT FOUND')
  console.log('✅ message_outbox table:', messageOutbox ? 'exists' : 'NOT FOUND')

  console.log('\n🎉 Deployment complete!')
}

main().catch(console.error)
