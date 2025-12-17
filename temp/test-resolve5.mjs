import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = 'XPZ7hK0rMm.0vrSxnldwYPLSDFGwmjxfgTCOMjHNkWsYI84rlRU6fqE=';

async function unipileRequest(endpoint) {
  const url = `https://${UNIPILE_DSN}${endpoint}`;
  console.log('Fetching:', url);

  const response = await fetch(url, {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    console.log('Error response:', data);
    throw new Error(JSON.stringify(data));
  }

  return data;
}

async function check() {
  // Get a failed item with campaign & account info
  const { data: failed } = await supabase
    .from('send_queue')
    .select('id, linkedin_user_id, campaign_id')
    .eq('status', 'failed')
    .limit(1)
    .single();

  if (!failed) {
    console.log('No failed items');
    return;
  }

  console.log('=== FAILED ITEM ===');
  console.log('Queue ID:', failed.id.substring(0,8));
  console.log('linkedin_user_id:', failed.linkedin_user_id);

  // Get campaign
  const { data: camp } = await supabase
    .from('campaigns')
    .select('name, linkedin_account_id')
    .eq('id', failed.campaign_id)
    .single();

  console.log('Campaign:', camp?.name);

  // Get workspace account
  const { data: wsAccount } = await supabase
    .from('workspace_accounts')
    .select('unipile_account_id, account_name')
    .eq('id', camp.linkedin_account_id)
    .single();

  console.log('Account:', wsAccount?.account_name);
  console.log('Unipile ID:', wsAccount?.unipile_account_id);

  // Now try to resolve the vanity
  const linkedinUrl = failed.linkedin_user_id;
  let vanity = linkedinUrl;

  if (linkedinUrl.includes('linkedin.com')) {
    const match = linkedinUrl.match(/linkedin\.com\/in\/([^\/\?#]+)/);
    if (match) {
      vanity = match[1];
    }
  }

  console.log('\n=== RESOLVING VANITY ===');
  console.log('Vanity:', vanity);

  try {
    const profile = await unipileRequest(
      `/api/v1/users/${encodeURIComponent(vanity)}?account_id=${wsAccount.unipile_account_id}`
    );
    console.log('SUCCESS!');
    console.log('  provider_id:', profile.provider_id);
    console.log('  first_name:', profile.first_name);
    console.log('  last_name:', profile.last_name);
  } catch (err) {
    console.log('FAILED to resolve:', err.message);
  }
}

check().catch(console.error);
