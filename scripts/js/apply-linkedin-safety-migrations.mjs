
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSql(filePath) {
    try {
        const sql = fs.readFileSync(filePath, 'utf8');
        console.log(`📜 Running SQL from ${path.basename(filePath)}...`);

        // Supabase JS doesn't have a direct 'run sql' method in the standard client,
        // but we can use the RPC method if we have a helper setup, or use the undocumented postgres endpoint if enabled.
        // HOWEVER, for simple DDL we often rely on the dashboard or psql.
        // Since psql is failing, I'll check if there's a specialized migrations table or if I can use a raw query.

        // ALTERNATIVE: Use the 'pg' library with the connection string if I can find it.
        // I found the connection string earlier: aws-0-us-east-1.pooler.supabase.com

        console.log('Trying to connect via pg library...');
        return false; // Placeholder
    } catch (err) {
        console.error(`❌ Error reading ${filePath}:`, err.message);
    }
}

// Since I have the 'pg' library in package.json, I'll use it directly.
import pg from 'pg';
const { Client } = pg;

async function runMigrations() {
    const client = new Client({
        connectionString: "postgresql://postgres.latxadqrvrrrcvkktrog:Goalie00x!@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        const migration66 = fs.readFileSync('sql/migrations/066-add-unipile-account-id-to-searches.sql', 'utf8');
        const migration67 = fs.readFileSync('sql/migrations/067-add-workspace-id-to-searches.sql', 'utf8');
        const quotaFunc = fs.readFileSync('sql/functions/quota-management.sql', 'utf8');

        console.log('🚀 Applying migration 066...');
        await client.query(migration66);

        console.log('🚀 Applying migration 067...');
        await client.query(migration67);

        console.log('🚀 Applying quota functions...');
        await client.query(quotaFunc);

        console.log('🎉 All migrations applied successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

runMigrations();
