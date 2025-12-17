import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  const wsId = 'c3100bea-82a6-4365-b159-6581f1be9be3'; // Sebastian Henkel

  // Get all campaigns
  const { data: camps } = await supabase
    .from('campaigns')
    .select('id, name, campaign_type, status, linkedin_account_id')
    .eq('workspace_id', wsId);

  console.log('=== SEBASTIAN CAMPAIGNS ===');
  if (camps) {
    camps.forEach(c => {
      console.log('  -', c.name);
      console.log('    Type:', c.campaign_type || 'null (connection request)');
      console.log('    Status:', c.status);
      console.log('    Account:', c.linkedin_account_id?.substring(0,8));
    });
  }

  // Check if there's a messenger campaign
  const messengerCamp = camps?.find(c => c.campaign_type === 'messenger');
  if (!messengerCamp) {
    console.log('\nNo messenger campaign found for Sebastian - need to create one!');
  }
}

check().catch(console.error);
