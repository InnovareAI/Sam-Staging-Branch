require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('REPLY AGENT DRAFTS TABLE SCHEMA:');
  console.log('='.repeat(60) + '\n');

  // Get one record to see columns
  const { data, error } = await supabase
    .from('reply_agent_drafts')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  if (data && data[0]) {
    console.log('Columns:', Object.keys(data[0]).join(', '));
    console.log('\nSample record:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('No records found');
  }

  // Check for any approved/sent drafts
  console.log('\n' + '='.repeat(60));
  console.log('DRAFTS BY STATUS:');
  
  const { data: allDrafts } = await supabase
    .from('reply_agent_drafts')
    .select('status')
    .limit(100);

  const counts = {};
  (allDrafts || []).forEach(d => {
    counts[d.status] = (counts[d.status] || 0) + 1;
  });
  console.log(counts);

})();
