#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('➕ Adding tl@innovareai.com to IA1 workspace...\n');

const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // IA1

// Add user to workspace_members
const { data, error } = await supabase
  .from('workspace_members')
  .insert({
    workspace_id: workspaceId,
    user_id: userId,
    role: 'admin'
  })
  .select()
  .single();

if (error) {
  console.error('❌ Error:', error);
} else {
  console.log('✅ Successfully added user to IA1 workspace');
  console.log(`   Workspace: ${data.workspace_id}`);
  console.log(`   User: ${data.user_id}`);
  console.log(`   Role: ${data.role}`);
}
