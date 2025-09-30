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

async function addMembership() {
  console.log('➕ Adding InnovareAI Workspace membership...\n')
  
  try {
    const userId = '2197f460-2078-44b5-9bf8-bbfb2dd5d23c'
    const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
    
    // Check if membership already exists
    const { data: existing } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (existing) {
      console.log('✅ Membership already exists!')
      console.log('   Role:', existing.role)
      console.log('   Status:', existing.status)
      return
    }
    
    // Add membership as owner
    const { data, error } = await supabase
      .from('workspace_members')
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        role: 'owner',
        status: 'active'
      })
      .select()
    
    if (error) {
      console.error('❌ Failed to add membership:', error)
    } else {
      console.log('✅ Successfully added membership!')
      console.log('   User: tl@innovareai.com')
      console.log('   Workspace: InnovareAI Workspace')
      console.log('   Role: owner')
      console.log('   Status: active')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

addMembership()
