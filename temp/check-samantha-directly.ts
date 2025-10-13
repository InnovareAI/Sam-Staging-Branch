import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkSamantha() {
  const userId = '1d1004ef-3cc7-47b3-942d-58c86f0a27c2'

  // Direct query to users table
  const { data, error } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Samantha user record:')
  console.log(JSON.stringify(data, null, 2))
}

checkSamantha().catch(console.error)
