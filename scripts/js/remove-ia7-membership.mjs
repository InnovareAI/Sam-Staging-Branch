#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
const ia7WorkspaceId = '85e80099-12f9-491a-a0a1-ad48d086a9f0';

console.log('🗑️  Removing membership from IA7 workspace...\n');

const { error } = await supabase
  .from('workspace_members')
  .delete()
  .eq('user_id', userId)
  .eq('workspace_id', ia7WorkspaceId);

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log('✅ Successfully removed membership from IA7');
  console.log(`   User: ${userId}`);
  console.log(`   Workspace: ${ia7WorkspaceId} (IA7)`);
}
