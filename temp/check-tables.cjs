const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function checkTables() {
  const tables = [
    'workspaces',
    'workspace_members',
    'workspace_prospects',
    'campaigns',
    'campaign_replies',
    'users',
    'email_responses',
    'message_outbox'
  ]

  console.log('🔍 Checking database tables...\n')

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1)

    if (error) {
      console.log(`❌ ${table} - NOT EXISTS`)
    } else {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
      console.log(`✅ ${table} - EXISTS (${count || 0} records)`)
    }
  }
}

checkTables().catch(console.error)
