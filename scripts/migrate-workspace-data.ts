import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('--- Migration Script Initializing ---');
console.log('Supabase URL:', SUPABASE_URL);

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const CLOUD_SQL_CONFIG = {
    host: process.env.CLOUD_SQL_HOST,
    user: process.env.CLOUD_SQL_USER,
    password: process.env.CLOUD_SQL_PASSWORD,
    database: process.env.CLOUD_SQL_DATABASE,
    port: 5432,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000 // 10s timeout
};
console.log('Postgres Config Host:', CLOUD_SQL_CONFIG.host);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});
const pool = new Pool(CLOUD_SQL_CONFIG);

async function migrateTable(tableName: string, conflictColumn: string = 'id') {
    console.log(`\n--- Starting migration for ${tableName} ---`);

    let totalMigrated = 0;
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        console.log(`Fetching page ${page} from Supabase...`);
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error(`Error fetching ${tableName}:`, error);
            break;
        }

        if (!data || data.length === 0) {
            console.log('No more data from Supabase.');
            hasMore = false;
            break;
        }
        console.log(`Fetched ${data.length} rows.`);

        console.log('Connecting to Postgres...');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const row of data) {
                const columns = Object.keys(row);
                const values = Object.values(row);
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                const updates = columns.map((col) => `${col} = EXCLUDED.${col}`).join(', ');

                const query = `
           INSERT INTO ${tableName} (${columns.join(', ')})
           VALUES (${placeholders})
           ON CONFLICT (${conflictColumn}) 
           DO UPDATE SET ${updates}
         `;

                await client.query(query, values);
            }

            await client.query('COMMIT');
            totalMigrated += data.length;
            console.log(`Committed batch. Total migrated: ${totalMigrated}`);

            if (data.length < pageSize) hasMore = false;
            page++;

        } catch (err) {
            await client.query('ROLLBACK');
            console.error(`Error inserting batch for ${tableName}:`, err);
            throw err;
        } finally {
            client.release();
        }
    }

    console.log(`Finished migrating ${tableName}. Total: ${totalMigrated}`);
}

async function main() {
    try {
        // 0. Test Connection
        console.log('Testing Postgres Connection...');
        const client = await pool.connect();
        const res = await client.query('SELECT NOW()');
        console.log('Postgres Connected at:', res.rows[0].now);
        client.release();

        // 1. Workspace Members
        // await migrateTable('workspace_members', 'id');

        // 2. Workspace Accounts
        // await migrateTable('workspace_accounts', 'id');

        // 3. Campaign Prospects (The remaining task)
        console.log('Migrating campaign_prospects...');
        await migrateTable('campaign_prospects', 'id');

        console.log('\n✅ MIGRATION COMPLETED SUCCESSFULLY');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ MIGRATION FAILED:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
