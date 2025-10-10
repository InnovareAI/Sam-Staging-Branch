#!/usr/bin/env node

require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

async function checkWorkspaces() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Check workspaces table
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .limit(1);

  if (workspaces && workspaces.length > 0) {
    console.log('📋 Workspaces table fields:\n');
    Object.keys(workspaces[0]).forEach(field => {
      console.log(`  - ${field}`);
    });
  }

  // Get all workspaces with tag-like fields
  const { data: allWorkspaces } = await supabase
    .from('workspaces')
    .select('*');

  console.log('\n📊 All workspaces:\n');
  allWorkspaces?.forEach(ws => {
    console.log(`Workspace: ${ws.name || ws.id}`);
    Object.keys(ws).forEach(key => {
      if (key.includes('tag') || key.includes('reseller') || key.includes('affiliation') || key.includes('company')) {
        console.log(`  ${key}: ${ws[key]}`);
      }
    });
    console.log('');
  });
}

checkWorkspaces().then(() => process.exit(0));
