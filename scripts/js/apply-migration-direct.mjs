#!/usr/bin/env node
/**
 * Apply Schema Cleanup Migration via Postgres
 * Uses connection string from environment
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env.local') });

console.log('🔧 Applying Schema Cleanup Migration via Postgres');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Read migration SQL
const migrationPath = join(__dirname, '../../sql/migrations/20251031_cleanup_campaign_prospects.sql');
const sql = readFileSync(migrationPath, 'utf8');

console.log('📄 Migration file loaded:', migrationPath);
console.log('📊 SQL size:', sql.length, 'bytes\n');

// Extract connection details from Supabase URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing Supabase credentials');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅' : '❌');
    process.exit(1);
}

// Parse Supabase URL to get project ref
const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!urlMatch) {
    console.error('❌ Error: Invalid Supabase URL format');
    process.exit(1);
}
const projectRef = urlMatch[1];

// Construct Postgres connection string
// Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;

if (!dbPassword) {
    console.error('❌ Error: Database password not set\n');
    console.error('Please add one of these to .env.local:');
    console.error('  SUPABASE_DB_PASSWORD=your_password');
    console.error('  POSTGRES_PASSWORD=your_password\n');
    console.error('Get password from:');
    console.error('  https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/settings/database\n');
    console.error('Or use the Supabase SQL Editor:');
    console.error('  https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql\n');
    process.exit(1);
}

const connectionString = `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`;

console.log('🗄️  Database host: db.' + projectRef + '.supabase.co');
console.log('🚀 Executing migration...\n');

// Create Postgres client
const client = new Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function applyMigration() {
    try {
        // Connect
        await client.connect();
        console.log('✅ Connected to database\n');

        // Execute migration
        const result = await client.query(sql);

        console.log('✅ Migration executed successfully!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Status constraint updated');
        console.log('📊 Indexes created');
        console.log('📊 Helper function mark_prospect_contacted() created');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('✅ Next step: Fix stuck prospects\n');
        console.log('Run:');
        console.log('  node scripts/js/fix-stuck-queued-prospects.mjs\n');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

applyMigration();
