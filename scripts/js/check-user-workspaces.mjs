#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking workspace memberships for tl@innovareai.com...\n');

// Get user ID
const { data: user } = await supabase
  .from('users')
  .select('id, email')
  .eq('email', 'tl@innovareai.com')
  .single();

console.log(`User: ${user.email} (${user.id})\n`);

// Get workspace memberships
const { data: memberships } = await supabase
  .from('workspace_members')
  .select('workspace_id, role, workspaces(id, name)')
  .eq('user_id', user.id);

console.log(`Found ${memberships.length} workspace memberships:\n`);

memberships.forEach((m, idx) => {
  console.log(`${idx + 1}. Workspace: ${m.workspaces.name} (${m.workspace_id})`);
  console.log(`   Role: ${m.role}\n`);
});
