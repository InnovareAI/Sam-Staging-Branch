const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function deployStripeTables() {
  console.log('🚀 Deploying Stripe Tables via PostgreSQL\n');

  // Direct PostgreSQL connection using Supabase pooler
  const client = new Client({
    host: 'aws-0-us-west-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.latxadqrvrrrcvkktrog',
    password: 'Innovareeai2024!!',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL\n');

    // Read migration
    const migrationSQL = fs.readFileSync(
      'supabase/migrations/20251006000000_add_tenant_and_stripe_tables.sql',
      'utf8'
    );

    console.log('📄 Executing migration...\n');

    // Execute the entire migration
    await client.query(migrationSQL);

    console.log('✅ Migration executed successfully\n');

    // Verify tables
    console.log('🔍 Verifying tables...');

    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('workspace_stripe_customers', 'workspace_subscriptions')
      ORDER BY table_name;
    `);

    result.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    // Check workspace tenant column
    const tenantCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'workspaces'
      AND column_name = 'tenant';
    `);

    if (tenantCheck.rows.length > 0) {
      console.log('   ✅ workspaces.tenant column');
    }

    await client.end();
    console.log('\n✅ Stripe tables deployment complete!');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    await client.end();
    process.exit(1);
  }
}

deployStripeTables().catch(console.error);
