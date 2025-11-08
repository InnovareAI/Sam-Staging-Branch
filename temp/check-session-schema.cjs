const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  // Get one existing session to see its structure
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', wsId)
    .limit(1);

  if (sessions && sessions.length > 0) {
    console.log('Existing session structure:');
    console.log(JSON.stringify(sessions[0], null, 2));
    console.log('\nColumn names:');
    console.log(Object.keys(sessions[0]));
  } else {
    console.log('No sessions found');
  }
}

checkSchema().catch(console.error);
