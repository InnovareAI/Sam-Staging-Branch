import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error('Error:', error)
  } else if (data && data.length > 0) {
    console.log('Users table columns:', Object.keys(data[0]))
    console.log('\nChecking for current_workspace_id:', 'current_workspace_id' in data[0])
  }
}

check()
