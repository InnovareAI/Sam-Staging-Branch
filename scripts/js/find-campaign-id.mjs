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

const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function findCampaign() {
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, created_by')
    .eq('workspace_id', WORKSPACE_ID)
    .like('name', '%Outreach%')
    .order('created_at', { ascending: false });

  console.log('Campaigns with "Outreach" in name:\n');
  campaigns.forEach(c => {
    console.log(`Campaign: ${c.name}`);
    console.log(`   ID: ${c.id}`);
    console.log(`   Status: ${c.status}`);
    console.log(`   Owner: ${c.created_by}`);
    console.log('');
  });
}

findCampaign().catch(console.error);
