import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWorkspaces() {
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', 'tl@innovareai.com')
    .single();

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log('User:', user.email, user.id);

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(name)')
    .eq('user_id', user.id);

  console.log('\nWorkspaces:', JSON.stringify(memberships, null, 2));
}

checkWorkspaces();
