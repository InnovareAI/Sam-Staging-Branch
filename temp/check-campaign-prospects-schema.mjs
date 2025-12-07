import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 CHECKING campaign_prospects SCHEMA\n');

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .limit(1);

if (prospects && prospects.length > 0) {
  const columns = Object.keys(prospects[0]).sort();
  console.log(`Found ${columns.length} columns:\n`);

  for (const col of columns) {
    const value = prospects[0][col];
    const type = value === null ? 'null' : typeof value;
    console.log(`  ${col.padEnd(30)} (${type})`);
  }

  // Check for name-related columns
  console.log('\n📋 Name-related columns:');
  const nameColumns = columns.filter(c =>
    c.includes('name') || c.includes('first') || c.includes('last')
  );
  if (nameColumns.length > 0) {
    nameColumns.forEach(c => console.log(`  - ${c}`));
  } else {
    console.log('  (none found)');
  }
}

console.log('\n');
