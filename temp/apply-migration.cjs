const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🔄 Applying LinkedIn account migration...\n');

  // Read the SQL file
  const sql = fs.readFileSync('./sql/add_linkedin_account_to_campaigns.sql', 'utf8');

  // Split by semicolons and filter out empty statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip comment-only statements and SELECT statements
    if (statement.startsWith('COMMENT ON') || statement.startsWith('SELECT')) {
      console.log(`${i + 1}. Skipping: ${statement.substring(0, 50)}...`);
      continue;
    }

    console.log(`${i + 1}. Executing: ${statement.substring(0, 80)}...`);

    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      });

      if (error) {
        // Try direct approach if RPC fails
        console.log('   RPC failed, trying direct query...');

        // For ALTER TABLE, use the from() method with raw SQL
        if (statement.includes('ALTER TABLE')) {
          console.log('   ⚠️  Please run this manually in Supabase SQL Editor:');
          console.log('   ' + statement + ';');
        } else if (statement.includes('UPDATE')) {
          console.log('   ⚠️  Please run this manually in Supabase SQL Editor:');
          console.log('   ' + statement + ';');
        }
      } else {
        console.log('   ✅ Success');
      }
    } catch (err) {
      console.log(`   ⚠️  Error: ${err.message}`);
      console.log('   Please run manually in Supabase SQL Editor');
    }
  }

  console.log('\n✅ Migration prepared. Please run the SQL file in Supabase SQL Editor if any statements failed.');
  console.log('\nSQL file location: sql/add_linkedin_account_to_campaigns.sql');
}

applyMigration().catch(console.error);
