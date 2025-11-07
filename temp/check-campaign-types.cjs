const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCampaignTypes() {
  console.log('🔍 Checking campaign structure and types...\n');

  // Get recent campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('📋 Recent Campaigns:\n');

  campaigns.forEach((c, index) => {
    console.log(`${index + 1}. ${c.name}`);
    console.log(`   Fields:`);
    console.log(`   - id: ${c.id}`);
    console.log(`   - status: ${c.status}`);
    console.log(`   - connection_message: ${c.connection_message ? 'YES' : 'NO'}`);
    console.log(`   - follow_up_message: ${c.follow_up_message ? 'YES' : 'NO'}`);

    // Check for campaign type indicators
    const keys = Object.keys(c);
    const typeIndicators = keys.filter(k =>
      k.includes('type') ||
      k.includes('mode') ||
      k.includes('flow') ||
      k.includes('connection') ||
      k.includes('direct')
    );

    if (typeIndicators.length > 0) {
      console.log(`   - Type indicators: ${typeIndicators.join(', ')}`);
      typeIndicators.forEach(key => {
        console.log(`     ${key}: ${c[key]}`);
      });
    }

    console.log('');
  });

  // Check schema for campaigns table
  console.log('\n🔍 Checking for campaign_type or similar fields...\n');

  const { data: schemaData, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'campaigns'
      ORDER BY ordinal_position;
    `
  }).catch(() => null);

  if (!schemaData) {
    console.log('⚠️  Could not query schema directly');
    console.log('Showing available fields from sample campaign:');
    if (campaigns.length > 0) {
      console.log(Object.keys(campaigns[0]).sort().join('\n'));
    }
  }
}

checkCampaignTypes().catch(console.error);
