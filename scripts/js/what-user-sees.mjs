#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function whatUserSees() {
  const workspaceId = '96c03b38-a2f4-40de-9e16-43098599e1d4';
  
  console.log('\n🔍 SIMULATING WHAT USER SEES IN UI\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // This is EXACTLY what the /api/campaigns endpoint does
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select(`
      id,
      name,
      description,
      campaign_type,
      type,
      status,
      launched_at,
      created_at,
      updated_at
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching campaigns:', error.message);
    return;
  }

  console.log(`Total campaigns fetched: ${campaigns.length}\n`);

  // Filter for ACTIVE campaigns (what user should see in Active Campaigns tab)
  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  console.log(`Active campaigns: ${activeCampaigns.length}\n`);

  activeCampaigns.forEach((c, i) => {
    const isMexico = c.name.includes('Mexico');
    console.log(`${i + 1}. ${isMexico ? '👉 ' : '   '}${c.name}`);
    console.log(`      Status: ${c.status}`);
    console.log(`      Created: ${new Date(c.created_at).toLocaleString()}\n`);
  });

  const mexicoCampaign = activeCampaigns.find(c => c.name.includes('Mexico'));
  console.log('═══════════════════════════════════════════════════════════════');
  if (mexicoCampaign) {
    console.log('✅ Mexico campaign SHOULD be visible in Active Campaigns tab');
    console.log(`   It has status: "${mexicoCampaign.status}"`);
    console.log(`   Created: ${new Date(mexicoCampaign.created_at).toLocaleString()}`);
  } else {
    console.log('❌ Mexico campaign NOT in active campaigns');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('💡 USER ACTION REQUIRED:');
  console.log('   1. Go to Campaign Hub page');
  console.log('   2. Look for tabs at the top (Active | Paused | Completed | etc)');
  console.log('   3. Click "Active Campaigns" tab');
  console.log('   4. Mexico campaign should appear there');
  console.log('\n   If not visible, open browser console (F12) and check for errors\n');
}

whatUserSees();
