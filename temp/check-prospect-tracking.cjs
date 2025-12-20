require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('CAMPAIGN_PROSPECTS COLUMNS:');
  console.log('='.repeat(60) + '\n');

  // Get one record to see columns
  const { data, error } = await supabase
    .from('campaign_prospects')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  if (data && data[0]) {
    const columns = Object.keys(data[0]).sort();
    console.log('All columns:\n');
    columns.forEach(c => console.log('  -', c));
    
    // Check for date-related columns
    console.log('\n\nDate/timestamp columns:');
    columns.filter(c => 
      c.includes('_at') || c.includes('date') || c.includes('sent') || c.includes('replied')
    ).forEach(c => console.log('  -', c, ':', data[0][c]));
  }

})();
