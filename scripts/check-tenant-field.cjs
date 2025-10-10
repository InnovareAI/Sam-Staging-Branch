#!/usr/bin/env node

require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

async function checkTenantField() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, client_code, tenant')
    .order('created_at', { ascending: false });

  console.log('📋 Workspaces with tenant field:\n');
  workspaces?.forEach((ws, i) => {
    console.log(`${i + 1}. ${ws.name}`);
    console.log(`   Client Code: ${ws.client_code || 'null'}`);
    console.log(`   Tenant: ${ws.tenant || 'null'}\n`);
  });
}

checkTenantField().then(() => process.exit(0));
