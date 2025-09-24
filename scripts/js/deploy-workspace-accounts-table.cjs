const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deployWorkspaceAccountsTable() {
  try {
    console.log('🚀 Creating workspace_accounts table...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '../../supabase/migrations/20250924_create_workspace_accounts_table.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📝 Executing workspace_accounts table creation...');
    
    // Create a client with elevated permissions
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      body: JSON.stringify({
        query: schema
      })
    });
    
    if (!response.ok) {
      // Alternative approach - try individual table creation
      console.log('⚡ Trying alternative table creation approach...');
      
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS workspace_accounts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          user_id UUID NOT NULL,
          account_type TEXT NOT NULL CHECK (account_type IN ('linkedin', 'email', 'twitter', 'facebook')),
          account_identifier TEXT NOT NULL,
          account_name TEXT,
          unipile_account_id TEXT,
          platform_account_id TEXT,
          connection_status TEXT DEFAULT 'pending' CHECK (connection_status IN ('pending', 'connected', 'failed', 'needs_verification', 'disconnected')),
          connected_at TIMESTAMP WITH TIME ZONE,
          last_verified_at TIMESTAMP WITH TIME ZONE,
          account_metadata JSONB DEFAULT '{}',
          capabilities JSONB DEFAULT '{}',
          limitations JSONB DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          error_details JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(workspace_id, account_type, account_identifier),
          UNIQUE(unipile_account_id)
        );
      `;
      
      const { error } = await supabase.rpc('exec_sql', { 
        sql: createTableSQL 
      }).single();
      
      if (error) {
        console.error('❌ Table creation failed:', error);
        console.log('\n📋 MANUAL ACTION REQUIRED:');
        console.log('Go to Supabase Dashboard → SQL Editor');
        console.log('Execute the contents of: /supabase/migrations/20250924_create_workspace_accounts_table.sql');
        return;
      }
    }
    
    console.log('✅ workspace_accounts table creation attempted');
    
    // Verify table was created
    console.log('🔍 Verifying table creation...');
    
    try {
      const { error: testError } = await supabase
        .from('workspace_accounts')
        .select('count')
        .limit(1);
        
      if (testError) {
        console.log('❌ Table verification failed:', testError.message);
        console.log('\n📋 MANUAL DEPLOYMENT REQUIRED:');
        console.log('1. Go to Supabase Dashboard → SQL Editor');
        console.log('2. Execute: /supabase/migrations/20250924_create_workspace_accounts_table.sql');
      } else {
        console.log('✅ workspace_accounts table is accessible!');
        console.log('🎉 LinkedIn integration should now work properly');
      }
    } catch (err) {
      console.log('❌ Table verification error:', err.message);
    }
    
  } catch (error) {
    console.error('💥 Deployment failed:', error);
    console.log('\n📋 MANUAL ACTION REQUIRED:');
    console.log('Deploy workspace_accounts table manually in Supabase Dashboard');
  }
}

// Run deployment
deployWorkspaceAccountsTable()
  .then(() => {
    console.log('\n🏁 workspace_accounts table deployment completed');
  })
  .catch((error) => {
    console.error('💥 Deployment process failed:', error);
    process.exit(1);
  });