const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  // Get one existing approval data to see its structure
  const { data: approvalData } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('workspace_id', wsId)
    .limit(1);

  if (approvalData && approvalData.length > 0) {
    console.log('Existing prospect_approval_data structure:');
    console.log(JSON.stringify(approvalData[0], null, 2));
    console.log('\nColumn names:');
    console.log(Object.keys(approvalData[0]));
  } else {
    console.log('No approval data found');
  }
}

checkSchema().catch(console.error);
