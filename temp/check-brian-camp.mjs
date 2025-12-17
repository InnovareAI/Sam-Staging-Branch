import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  const campId = '64c672da-fb0c-42f3-861e-a47fa29ac06b';

  const { data: camp, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campId)
    .single();

  console.log('Error:', error);
  console.log('Campaign exists:', camp ? 'YES' : 'NO');
  if (camp) {
    console.log('Name:', camp.name);
    console.log('Status:', camp.status);
    console.log('linkedin_account_id:', camp.linkedin_account_id);
    console.log('workspace_id:', camp.workspace_id);
    console.log('initial_message:', camp.initial_message ? camp.initial_message.substring(0, 100) : 'NONE');
  }
}

check().catch(console.error);
