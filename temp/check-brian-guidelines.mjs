import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BRIAN_WORKSPACE_ID = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

async function checkGuidelines() {
  console.log('BRIAN\'S BRAND GUIDELINES');
  console.log('='.repeat(60));

  const { data, error } = await supabase
    .from('linkedin_brand_guidelines')
    .select('*')
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .single();

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('\nFULL GUIDELINES:');
  console.log(JSON.stringify(data, null, 2));
}

checkGuidelines().catch(console.error);
