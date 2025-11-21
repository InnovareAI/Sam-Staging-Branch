import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, campaign_name, linkedin_account_id, workspace_accounts!linkedin_account_id(id, account_name, unipile_account_id, is_active)')
  .eq('id', '02c9d97e-ae70-4be1-bc1a-9b086a767d56')
  .single();

console.log('Campaign:', campaign.campaign_name || 'null');
console.log('LinkedIn Account ID:', campaign.linkedin_account_id);
console.log('Account:', JSON.stringify(campaign.workspace_accounts, null, 2));
