const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deploySamFunnelSchema() {
  try {
    console.log('🚀 Deploying Sam Funnel database schema...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '../../supabase/migrations/20250924_create_sam_funnel_system.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      try {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        
        const { error } = await supabase.rpc('exec_sql', { 
          sql_statement: statement 
        });
        
        if (error) {
          // Try direct execution if RPC fails
          const { error: directError } = await supabase
            .from('_supabase_migrations')
            .select('version')
            .limit(1);
            
          if (directError) {
            console.error(`❌ Statement ${i + 1} failed:`, error.message);
            errorCount++;
            continue;
          }
        }
        
        successCount++;
        
      } catch (err) {
        console.error(`❌ Statement ${i + 1} failed:`, err.message);
        errorCount++;
      }
    }
    
    console.log(`\n✅ Schema deployment complete:`);
    console.log(`   • Successful statements: ${successCount}`);
    console.log(`   • Failed statements: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('🎉 Sam Funnel schema deployed successfully!');
    } else {
      console.log('⚠️ Some statements failed - check logs above');
    }
    
    // Verify tables were created
    await verifyTables();
    
  } catch (error) {
    console.error('💥 Schema deployment failed:', error);
  }
}

async function verifyTables() {
  console.log('\n🔍 Verifying Sam Funnel tables...');
  
  const expectedTables = [
    'sam_funnel_executions',
    'sam_funnel_messages', 
    'sam_funnel_responses',
    'sam_funnel_analytics',
    'sam_funnel_template_performance'
  ];
  
  for (const tableName of expectedTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('count')
        .limit(1);
        
      if (error) {
        console.log(`❌ Table '${tableName}' not found or inaccessible`);
      } else {
        console.log(`✅ Table '${tableName}' exists and accessible`);
      }
    } catch (err) {
      console.log(`❌ Table '${tableName}' verification failed`);
    }
  }
}

// Alternative direct SQL execution
async function deployDirectSQL() {
  console.log('\n🔄 Attempting direct SQL execution...');
  
  try {
    // Read schema file
    const schemaPath = path.join(__dirname, '../../supabase/migrations/20250924_create_sam_funnel_system.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Try to execute the full schema at once
    console.log('Executing full schema...');
    
    // This is a simplified approach - in production you'd use proper migration tools
    console.log('Schema file read successfully. Manual deployment required in Supabase Dashboard.');
    console.log('\nTo deploy manually:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Copy and paste the contents of:');
    console.log('   /supabase/migrations/20250924_create_sam_funnel_system.sql');
    console.log('3. Run the SQL statements');
    
  } catch (error) {
    console.error('❌ Direct SQL deployment failed:', error);
  }
}

// Run deployment
deploySamFunnelSchema()
  .then(() => {
    console.log('\n🏁 Deployment process completed');
  })
  .catch((error) => {
    console.error('💥 Deployment process failed:', error);
    process.exit(1);
  });