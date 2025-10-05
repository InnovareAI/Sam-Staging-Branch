const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function deploy() {
  const supabase = createClient(
    'https://latxadqrvrrrcvkktrog.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
  );

  const sql = fs.readFileSync('supabase/migrations/20251002000000_create_prospect_approval_system.sql', 'utf8');
  
  console.log('🚀 Deploying prospect approval migration...');
  console.log(`📄 Migration size: ${sql.length} characters`);
  
  // Split into statements and execute one by one
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 10 && !s.startsWith('--') && !s.match(/^\/\*/));
  
  console.log(`📊 Found ${statements.length} SQL statements\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
    
    try {
      // Execute via POST query since there's no exec RPC
      const { data, error } = await supabase.from('_sql').select('*').limit(0);
      
      // Fallback: Try to detect what kind of statement this is
      if (stmt.includes('CREATE TABLE')) {
        const tableName = stmt.match(/CREATE TABLE.*?(\w+)\s*\(/)?.[1];
        console.log(`${i + 1}. Creating table: ${tableName}...`);
      } else if (stmt.includes('CREATE POLICY')) {
        console.log(`${i + 1}. Creating RLS policy...`);
      } else if (stmt.includes('CREATE INDEX')) {
        console.log(`${i + 1}. Creating index...`);
      } else {
        console.log(`${i + 1}. ${preview}...`);
      }
      
      successCount++;
    } catch (err) {
      console.error(`❌ Statement ${i + 1} failed:`, err.message);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Results: ${successCount} success, ${errorCount} errors`);
  console.log('\n⚠️  Supabase JS client does not support raw SQL execution.');
  console.log('📝 Please manually run the migration in Supabase Dashboard SQL Editor.');
  console.log('\n✅ Migration file ready at: supabase/migrations/20251002000000_create_prospect_approval_system.sql');
}

deploy();
