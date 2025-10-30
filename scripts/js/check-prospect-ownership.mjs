#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CAMPAIGN_ID = 'ade10177-afe6-4770-a64d-b4ac0928b66a';

async function checkOwnership() {
  console.log('🔍 CHECKING PROSPECT OWNERSHIP\n');
  
  // Get campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('created_by, workspace_id')
    .eq('id', CAMPAIGN_ID)
    .single();
  
  console.log('Campaign created by:', campaign.created_by);
  
  // Get LinkedIn account for campaign owner
  const { data: linkedinAccount } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', campaign.workspace_id)
    .eq('user_id', campaign.created_by)
    .eq('account_type', 'linkedin')
    .single();
  
  console.log('LinkedIn account:', linkedinAccount?.account_name);
  console.log('Unipile account ID:', linkedinAccount?.unipile_account_id);
  
  // Get prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, added_by_unipile_account, linkedin_url, status')
    .eq('campaign_id', CAMPAIGN_ID);
  
  console.log('\n📋 PROSPECTS:\n');
  prospects.forEach(p => {
    console.log(`${p.first_name} ${p.last_name}:`);
    console.log(`  Status: ${p.status}`);
    console.log(`  LinkedIn URL: ${p.linkedin_url}`);
    console.log(`  added_by_unipile_account: ${p.added_by_unipile_account || 'NULL'}`);
    
    const matches = p.added_by_unipile_account === linkedinAccount?.unipile_account_id;
    const isLegacy = p.added_by_unipile_account === null;
    console.log(`  ✓ Matches campaign account: ${matches}`);
    console.log(`  ✓ Is legacy (NULL): ${isLegacy}`);
    console.log(`  ✅ Can message: ${matches || isLegacy}\n`);
  });
}

checkOwnership().catch(console.error);
