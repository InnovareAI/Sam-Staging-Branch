#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function switchWorkspace() {
  // Update tl@innovareai.com to use Sendingcell workspace
  const { error } = await supabase
    .from('users')
    .update({ current_workspace_id: 'b070d94f-11e2-41d4-a913-cc5a8c017208' })
    .eq('email', 'tl@innovareai.com');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('✅ Switched tl@innovareai.com to Sendingcell Workspace');
  console.log('   Refresh your browser to see the change');
}

switchWorkspace();
