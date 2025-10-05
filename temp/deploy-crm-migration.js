/**
 * Deploy CRM Integration Migration to Supabase
 * Run with: node temp/deploy-crm-migration.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Database connection details
const DB_HOST = 'aws-0-us-west-1.pooler.supabase.com';
const DB_PORT = '6543';
const DB_USER = 'postgres.latxadqrvrrrcvkktrog';
const DB_NAME = 'postgres';
const DB_PASSWORD = 'Innovareeai2024!!';

// Migration file
const MIGRATION_FILE = path.join(__dirname, '../supabase/migrations/20251005000004_create_crm_integration_tables.sql');

console.log('🚀 Deploying CRM Integration Migration to Supabase...\n');

// Check if migration file exists
if (!fs.existsSync(MIGRATION_FILE)) {
  console.error('❌ Error: Migration file not found:', MIGRATION_FILE);
  process.exit(1);
}

console.log('📋 Migration file:', MIGRATION_FILE);
console.log('🗄️  Database:', `${DB_HOST}:${DB_PORT}/${DB_NAME}\n`);

try {
  console.log('🔧 Applying migration...\n');

  // Execute migration
  const command = `PGPASSWORD="${DB_PASSWORD}" psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -f "${MIGRATION_FILE}"`;

  const output = execSync(command, {
    encoding: 'utf8',
    stdio: 'inherit'
  });

  console.log('\n✅ CRM Integration migration deployed successfully!\n');

  // Verify tables were created
  console.log('📊 Verifying tables...\n');

  const verifyCommand = `PGPASSWORD="${DB_PASSWORD}" psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -c "\\dt crm_*"`;

  execSync(verifyCommand, {
    encoding: 'utf8',
    stdio: 'inherit'
  });

  console.log('\n✨ Deployment complete!\n');
  console.log('Next steps:');
  console.log('1. Configure OAuth credentials in .env.local');
  console.log('2. Test CRM Integration tile in workspace dashboard');
  console.log('3. Connect a test HubSpot account\n');

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}
