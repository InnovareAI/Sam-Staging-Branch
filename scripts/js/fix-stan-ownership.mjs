#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BLUE_LABEL_ID = '014509ba-226e-43ee-ba58-ab5f20d2ed08'
const STAN_ID = '6a927440-ebe1-49b4-ae5e-fbee5d27944d'

console.log('🔧 Fixing Stan ownership\n')

// Set workspace owner
const { error: wsError } = await supabase
  .from('workspaces')
  .update({ owner_id: STAN_ID })
  .eq('id', BLUE_LABEL_ID)

// Update role
const { error: roleError } = await supabase
  .from('workspace_members')
  .update({ role: 'owner' })
  .eq('workspace_id', BLUE_LABEL_ID)
  .eq('user_id', STAN_ID)

if (!wsError && !roleError) {
  console.log('✅ Stan is now owner of Blue Label Labs')
} else {
  console.log('❌ Error:', wsError || roleError)
}
