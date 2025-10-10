#!/usr/bin/env node

require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

async function findResellerField() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Check workspace_tiers table
  console.log('🔍 Checking workspace_tiers table...\n');
  const { data: tiers } = await supabase
    .from('workspace_tiers')
    .select('*')
    .limit(1);

  if (tiers && tiers.length > 0) {
    console.log('📋 workspace_tiers fields:');
    Object.keys(tiers[0]).forEach(field => {
      console.log(`  - ${field}`);
    });
  } else {
    console.log('⚠️ workspace_tiers table empty or not found\n');
  }

  // Get all tiers with potential reseller fields
  const { data: allTiers } = await supabase
    .from('workspace_tiers')
    .select('*');

  if (allTiers) {
    console.log('\n📊 All workspace tiers:\n');
    allTiers.forEach(tier => {
      console.log(`Workspace ID: ${tier.workspace_id}`);
      Object.keys(tier).forEach(key => {
        console.log(`  ${key}: ${tier[key]}`);
      });
      console.log('');
    });
  }
}

findResellerField().then(() => process.exit(0));
