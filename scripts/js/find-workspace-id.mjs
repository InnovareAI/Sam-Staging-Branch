#!/usr/bin/env node
/**
 * Find the correct workspace ID for a campaign
 */

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

const CAMPAIGN_ID = '73bedc34-3b24-4315-8cf1-043e454019af';

async function findWorkspaceId() {
  console.log('🔍 Finding workspace ID...\n');

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id, workspaces(name)')
    .eq('id', CAMPAIGN_ID)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('Campaign:', campaign.name);
  console.log('Campaign ID:', campaign.id);
  console.log('Workspace ID:', campaign.workspace_id);
  console.log('Workspace Name:', campaign.workspaces.name);

  // Now get all campaigns for this workspace
  const { data: allCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .eq('workspace_id', campaign.workspace_id)
    .order('created_at', { ascending: false });

  console.log(`\n📊 Found ${allCampaigns.length} campaigns in this workspace:\n`);

  allCampaigns.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name}`);
    console.log(`   ID: ${c.id}`);
    console.log(`   Status: ${c.status}`);
    console.log(`   Created: ${new Date(c.created_at).toLocaleDateString()}`);
    console.log('');
  });
}

findWorkspaceId().catch(console.error);
