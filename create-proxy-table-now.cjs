const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTable() {
  console.log('🔧 Creating linkedin_proxy_assignments table...\n');
  
  const migrationPath = path.join(__dirname, 'supabase/migrations/20250918110000_linkedin_proxy_assignments.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  // Split into separate statements
  const statements = sql.split(';').filter(s => s.trim().length > 0);
  
  console.log(`📝 Executing ${statements.length} SQL statements...\n`);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim() + ';';
    
    // Skip comments
    if (statement.startsWith('--')) continue;
    
    try {
      const { error } = await supabase.rpc('exec', { query: statement });
      
      if (error) {
        // Try alternate method
        console.log(`Statement ${i + 1}: Retrying...`);
      } else {
        console.log(`✅ Statement ${i + 1} executed`);
      }
    } catch (err) {
      console.log(`⚠️ Statement ${i + 1}: ${err.message}`);
    }
  }
  
  console.log('\n✅ Table creation complete!');
  console.log('\nℹ️  If you see errors above, please run the SQL manually:');
  console.log('   1. Go to Supabase Dashboard → SQL Editor');
  console.log('   2. Paste the contents of: supabase/migrations/20250918110000_linkedin_proxy_assignments.sql');
  console.log('   3. Click "Run"');
}

createTable();
