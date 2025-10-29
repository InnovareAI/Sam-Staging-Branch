#!/usr/bin/env node
/**
 * Check campaign test 12 status
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Get campaign ID for test 12
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('name', '20251029-IAI-test 12')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Campaign error:', error.message);
    process.exit(1);
  }

  console.log('Campaign: 20251029-IAI-test 12');
  console.log('Campaign ID:', campaign.id);
  console.log('Status:', campaign.status);
  console.log('');

  // Get prospects for this campaign
  const { data: prospects, error: prospError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, company_name, status, linkedin_url, contacted_at')
    .eq('campaign_id', campaign.id)
    .order('created_at', { ascending: false });

  if (prospError) {
    console.error('Prospects error:', prospError.message);
    process.exit(1);
  }

  console.log('Total prospects:', prospects.length);

  // Group by status
  const statusCounts = {};
  let pendingCount = 0;
  let missingNames = 0;
  let missingLinkedIn = 0;

  prospects.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    if (['pending', 'approved', 'ready_to_message'].includes(p.status) && !p.contacted_at) {
      pendingCount++;
    }
    if (!p.first_name || !p.last_name) {
      missingNames++;
    }
    if (!p.linkedin_url) {
      missingLinkedIn++;
    }
  });

  console.log('\nStatus breakdown:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log('\nReady to send:', pendingCount);
  console.log('Missing names:', missingNames);
  console.log('Missing LinkedIn URL:', missingLinkedIn);

  if (prospects.length > 0) {
    console.log('\nFirst 5 prospects:');
    prospects.slice(0, 5).forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.first_name || '[NO NAME]'} ${p.last_name || ''} at ${p.company_name || '[NO COMPANY]'}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   LinkedIn: ${p.linkedin_url ? 'Yes' : 'NO'}`);
      console.log(`   Contacted: ${p.contacted_at || 'Never'}`);
    });
  }
}

main().catch(console.error);
