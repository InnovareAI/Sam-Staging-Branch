#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 Checking knowledge_base table schema\n')

  // Try to select all columns
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ Error:', error.message)
    return
  }

  if (data && data.length > 0) {
    console.log('✅ Columns found in knowledge_base table:')
    console.log(Object.keys(data[0]).join(', '))
  } else {
    console.log('⚠️  Table exists but has no data')
    console.log('Attempting to get schema via INSERT attempt...')
    
    // This will fail but show us what columns exist
    const { error: insertError } = await supabase
      .from('knowledge_base')
      .insert({ test: 'value' })
    
    if (insertError) {
      console.log('\nError message:', insertError.message)
    }
  }
}

main().catch(console.error)
