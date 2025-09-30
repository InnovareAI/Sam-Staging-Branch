import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function check() {
  console.log('Checking workspace_members table...\n')
  
  const { data, error, count } = await supabase
    .from('workspace_members')
    .select('*', { count: 'exact' })
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log(`Total memberships: ${count}`)
    console.log('Sample data:', data?.slice(0, 3))
  }
}

check()
