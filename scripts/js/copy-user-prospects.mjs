#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const INNOVARE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'

const { data: members } = await supabase
  .from('workspace_members')
  .select('user_id')
  .eq('workspace_id', INNOVARE_ID)

for (const m of members) {
  const { data: user } = await supabase.from('users').select('email').eq('id', m.user_id).single()
  const { data: userWsList } = await supabase.from('workspaces').select('id').eq('owner_id', m.user_id)
  
  const userWs = userWsList?.find(w => w.id !== INNOVARE_ID)
  if (!userWs) continue
  
  const { data: userProspects } = await supabase
    .from('workspace_prospects')
    .select('*')
    .eq('workspace_id', INNOVARE_ID)
    .eq('added_by', m.user_id)
  
  console.log(`\n▶ ${user.email}`)
  console.log(`  Workspace: ${userWs.id}`)
  console.log(`  Prospects: ${userProspects?.length || 0}`)
  
  if (userProspects && userProspects.length > 0) {
    const toInsert = userProspects.map(p => {
      const { id, created_at, updated_at, ...rest } = p
      return { ...rest, workspace_id: userWs.id }
    })
    
    const { error } = await supabase.from('workspace_prospects').insert(toInsert)
    
    if (!error) {
      console.log(`  ✅ Copied`)
    } else {
      console.log(`  ❌ ${error.message}`)
    }
  }
}

console.log(`\n✅ Done`)
