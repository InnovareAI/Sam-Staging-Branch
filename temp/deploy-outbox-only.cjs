const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function deploymigration() {
  console.log('🚀 Deploying message_outbox table migration...\n')

  const sql = fs.readFileSync('supabase/migrations/20251007000003_create_message_outbox_simplified.sql', 'utf8')

  // Split by statement and execute one by one
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`📝 Found ${statements.length} SQL statements to execute\n`)

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';'

    // Skip comments
    if (statement.startsWith('--') || statement.startsWith('COMMENT')) {
      console.log(`⏭️  [${i + 1}/${statements.length}] Skipping comment`)
      continue
    }

    console.log(`⚙️  [${i + 1}/${statements.length}] Executing...`)
    console.log(`   ${statement.substring(0, 60)}...`)

    try {
      const { data, error } = await supabase.rpc('query', {
        query: statement
      })

      if (error) {
        // Try alternative approach
        const response = await fetch('https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/rpc/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
          },
          body: JSON.stringify({ query: statement })
        })

        if (!response.ok) {
          console.log(`   ⚠️  Could not execute via RPC, will need manual execution`)
        }
      } else {
        console.log(`   ✅ Success`)
      }
    } catch (err) {
      console.log(`   ⚠️  ${err.message}`)
    }
  }

  console.log('\n✅ Migration deployment attempted')
  console.log('\n🔍 Verifying message_outbox table...')

  const { data, error } = await supabase
    .from('message_outbox')
    .select('*')
    .limit(1)

  if (error) {
    console.log('❌ message_outbox table NOT created')
    console.log('   Error:', error.message)
    console.log('\n📋 Manual deployment required:')
    console.log('   1. Go to Supabase Dashboard → SQL Editor')
    console.log('   2. Copy: supabase/migrations/20251007000003_create_message_outbox_simplified.sql')
    console.log('   3. Paste and run')
  } else {
    console.log('✅ message_outbox table created successfully!')
  }
}

deploymigration().catch(console.error)
