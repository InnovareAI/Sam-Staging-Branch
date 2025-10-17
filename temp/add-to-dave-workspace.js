#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addToWorkspace() {
  const yourEmail = process.argv[2];
  
  if (!yourEmail) {
    console.error('Usage: node temp/add-to-dave-workspace.js YOUR_EMAIL');
    process.exit(1);
  }

  // Find Dave's workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name')
    .or('name.ilike.%sendingcell%,name.ilike.%stuteville%')
    .single();

  if (wsError || !workspace) {
    console.error('Error finding workspace:', wsError);
    process.exit(1);
  }

  console.log(`Found workspace: ${workspace.name} (${workspace.id})`);

  // Find your user ID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', yourEmail)
    .single();

  if (userError || !user) {
    console.error('Error finding user:', userError);
    process.exit(1);
  }

  console.log(`Found user: ${user.email} (${user.id})`);

  // Add to workspace
  const { error: addError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'admin'
    });

  if (addError) {
    console.error('Error adding to workspace:', addError);
    process.exit(1);
  }

  console.log(`✅ Successfully added ${yourEmail} to ${workspace.name} as admin`);
}

addToWorkspace();
