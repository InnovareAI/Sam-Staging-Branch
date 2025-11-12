#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkNoriko() {
  console.log('🔍 Checking Noriko Yokoi\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // Find user
  const { data: authData } = await supabase.auth.admin.listUsers();
  const noriko = authData.users.find(u =>
    u.email?.toLowerCase().includes('noriko') ||
    u.email?.toLowerCase().includes('yokoi')
  );

  if (!noriko) {
    console.log('❌ Noriko Yokoi not found');
    console.log('\nSearching all users with "yokoi" or "noriko" in email...');
    const matches = authData.users.filter(u =>
      u.email?.toLowerCase().includes('yokoi') ||
      u.email?.toLowerCase().includes('noriko')
    );
    console.log('Matches:', matches.map(u => u.email));
    return;
  }

  console.log(`✅ Found: ${noriko.email} (${noriko.id})\n`);

  // Get workspaces
  const { data: workspaces } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', noriko.id);

  console.log(`Workspaces: ${workspaces?.length || 0}\n`);

  for (const ws of workspaces || []) {
    const { data: wsData } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', ws.workspace_id)
      .single();

    console.log(`📊 Workspace: ${wsData.name}`);
    console.log(`   ID: ${ws.workspace_id}`);
    console.log(`   Role: ${ws.role}\n`);

    // Get campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('workspace_id', ws.workspace_id)
      .order('created_at', { ascending: false })
      .limit(5);

    console.log(`   Campaigns: ${campaigns?.length || 0}`);
    for (const campaign of campaigns || []) {
      console.log(`   - ${campaign.name} (${campaign.status})`);

      // Get prospect count
      const { count } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);

      console.log(`     Prospects: ${count}`);
    }

    console.log('');

    // Check workspace accounts
    const { data: accounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', ws.workspace_id);

    console.log(`   Accounts: ${accounts?.length || 0}`);
    for (const acc of accounts || []) {
      const icon = acc.is_active ? '🟢' : '🔴';
      console.log(`   ${icon} ${acc.account_type}: ${acc.account_name} (${acc.connection_status})`);
    }

    console.log('\n' + '─'.repeat(60) + '\n');
  }
}

checkNoriko().catch(console.error);
