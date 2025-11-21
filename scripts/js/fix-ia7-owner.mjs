#!/usr/bin/env node
/**
 * Fix IA7 workspace access by setting correct owner
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = '85e80099-12f9-491a-a0a1-ad48d086a9f0'; // IA7
const NEW_OWNER_ID = '59b1063e-672c-49c6-b3b7-02081a500209'; // tbslinz@icloud.com

console.log('🔧 FIXING IA7 WORKSPACE OWNERSHIP...\n');

// 1. Update workspace owner
const { error: updateError } = await supabase
  .from('workspaces')
  .update({ owner_id: NEW_OWNER_ID })
  .eq('id', WORKSPACE_ID);

if (updateError) {
  console.error('❌ Error updating workspace owner:', updateError.message);
  process.exit(1);
}

console.log('✅ Workspace owner updated to tbslinz@icloud.com');

// 2. Ensure user is still in workspace_members as admin
const { data: existingMember } = await supabase
  .from('workspace_members')
  .select('*')
  .eq('workspace_id', WORKSPACE_ID)
  .eq('user_id', NEW_OWNER_ID)
  .single();

if (!existingMember) {
  console.log('\n➕ Adding owner to workspace_members...');

  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: WORKSPACE_ID,
      user_id: NEW_OWNER_ID,
      role: 'admin'
    });

  if (memberError) {
    console.error('❌ Error:', memberError.message);
  } else {
    console.log('✅ Owner added to workspace_members');
  }
} else {
  console.log('\n✅ Owner already in workspace_members');
}

// 3. Verify access
const { data: verification } = await supabase
  .from('workspace_members')
  .select('workspace_id, role, workspaces(name)')
  .eq('user_id', NEW_OWNER_ID);

console.log('\n🔍 Verification:');
if (verification && verification.length > 0) {
  console.log('✅ User can now access workspace:');
  verification.forEach(v => {
    console.log(`   - ${v.workspaces?.name || 'Unknown'} (${v.role})`);
  });
} else {
  console.log('⚠️  Still having issues - check RLS policies');
}

console.log('\n📋 Login again at: https://app.meet-sam.com');
console.log('   Email: tbslinz@icloud.com');
console.log('   Password: TempPass123!');
