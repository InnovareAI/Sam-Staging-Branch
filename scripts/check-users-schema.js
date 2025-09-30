import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: 'public' }
  }
)

async function checkSchema() {
  console.log('🔍 Checking users table schema...\n')
  
  // Query the information schema to see columns
  const { data, error } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position;
      `
    })
    .catch(async () => {
      // If RPC doesn't exist, try direct query
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .limit(1)
      
      if (userError) {
        console.error('Error:', userError)
        return { data: null, error: userError }
      }
      
      console.log('Sample user record keys:', Object.keys(userData[0] || {}))
      return { data: userData, error: null }
    })
  
  if (error) {
    console.error('Error:', error)
  } else if (data) {
    console.log('Users table columns:')
    console.log(data)
  }
}

checkSchema()
