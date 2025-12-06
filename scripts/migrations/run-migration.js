/**
 * Run SQL migration directly using pg library
 * Usage: node scripts/migrations/run-migration.js
 */

import pg from 'pg';
const { Client } = pg;

// Connection string from Supabase pooler (transaction mode)
const connectionString = 'postgresql://postgres.latxadqrvrrrcvkktrog:Vu7J3J5YU6L7LpDF@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

// SSL config for Supabase
const ssl = {
  rejectUnauthorized: false
};

const migration = `
-- Add target_countries to monitors (NULL means all countries)
ALTER TABLE linkedin_post_monitors ADD COLUMN IF NOT EXISTS target_countries TEXT[] DEFAULT NULL;

-- Add author_country to discovered posts
ALTER TABLE linkedin_posts_discovered ADD COLUMN IF NOT EXISTS author_country TEXT DEFAULT NULL;
`;

async function runMigration() {
  const client = new Client({ connectionString, ssl });

  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected');

    console.log('\n📝 Running migration...');
    await client.query(migration);
    console.log('✅ Migration completed successfully!');

    // Verify
    console.log('\n🔍 Verifying columns...');
    const res1 = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'linkedin_post_monitors' AND column_name = 'target_countries'");
    console.log('   linkedin_post_monitors.target_countries:', res1.rows.length > 0 ? '✅ EXISTS' : '❌ NOT FOUND');

    const res2 = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'linkedin_posts_discovered' AND column_name = 'author_country'");
    console.log('   linkedin_posts_discovered.author_country:', res2.rows.length > 0 ? '✅ EXISTS' : '❌ NOT FOUND');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 Connection closed');
  }
}

runMigration();
