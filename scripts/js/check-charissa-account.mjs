import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const IA4_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';

async function check() {
  // Get LinkedIn account details
  const { data: account } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', IA4_ID)
    .eq('account_type', 'linkedin')
    .single();

  console.log('=== CHARISSA LINKEDIN ACCOUNT ===');
  console.log('Account ID:', account?.id);
  console.log('Unipile Account ID:', account?.unipile_account_id);
  console.log('Connection Status:', account?.connection_status);
  console.log('Account Name:', account?.account_name || account?.display_name);
  console.log('Profile URL:', account?.profile_url || account?.linkedin_url);
  console.log('');

  // Get all campaigns for this workspace
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, linkedin_account_id, created_at')
    .eq('workspace_id', IA4_ID)
    .order('created_at', { ascending: false });

  console.log('=== CAMPAIGNS ===');
  for (const c of campaigns || []) {
    const isLinked = c.linkedin_account_id === account?.id;
    console.log(c.name);
    console.log('  Status:', c.status);
    console.log('  Linked to account:', isLinked ? '✅ YES' : '❌ NO');
    console.log('');
  }

  // Check workspace details
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', IA4_ID)
    .single();

  console.log('=== WORKSPACE ===');
  console.log('Name:', workspace?.name);
  console.log('Created:', workspace?.created_at);
}

check().catch(console.error);
