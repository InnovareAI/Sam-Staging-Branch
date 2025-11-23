require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getSchema() {
  const { data, error } = await supabase.from('columns')
    .select('column_name, data_type')
    .eq('table_schema', 'public')
    .eq('table_name', 'campaign_prospects');

  if (error) {
    console.error('Error fetching schema:', error);
    return;
  }

  console.log('--- campaign_prospects schema ---');
  if (data && data.length > 0) {
    data.forEach(col => {
      console.log(`Column: ${col.column_name}, Type: ${col.data_type}`);
    });
  } else {
    console.log('No schema found for campaign_prospects.');
  }
}

getSchema();
