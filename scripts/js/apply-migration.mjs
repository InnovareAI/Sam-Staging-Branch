import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const { Client } = pg;

async function applyMigration() {
    console.log('🚀 Applying migration...');

    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
        console.error('❌ DATABASE_URL or POSTGRES_URL not found in .env.local');
        process.exit(1);
    }

    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false } // Required for Supabase in many environments
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        const sql = `
      -- Add schedule_settings column to campaigns table
      ALTER TABLE campaigns 
      ADD COLUMN IF NOT EXISTS schedule_settings JSONB DEFAULT NULL;

      -- Comment on column
      COMMENT ON COLUMN campaigns.schedule_settings IS 'Configuration for campaign schedule: timezone, working_hours, skip_weekends, etc.';
    `;

        await client.query(sql);
        console.log('✅ Migration applied successfully!');

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await client.end();
    }
}

applyMigration();
