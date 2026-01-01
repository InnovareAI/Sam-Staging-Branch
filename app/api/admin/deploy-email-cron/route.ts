import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST() {
  try {
    console.log('📧 Deploying Daily Email Cron Job...\n');

    // Step 1: Enable http extension
    console.log('1️⃣ Enabling http extension...');
    const { error: httpError } = await supabase.rpc('query', {
      query: 'CREATE EXTENSION IF NOT EXISTS http;'
    }).single();

    // The query RPC might not exist, so we'll try a different approach
    // We'll read and execute the migration file directly

    // Step 2: Read the migration SQL
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20251109_add_daily_email_cron.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split into statements (basic splitting)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && s.length > 10);

    const results = [];

    // First, try to enable http extension using a simple query
    try {
      const httpExtSQL = 'CREATE EXTENSION IF NOT EXISTS http';
      const { error: httpErr } = await supabase.rpc('exec', {
        sql: httpExtSQL
      });

      results.push({
        step: 'Enable HTTP Extension',
        status: httpErr ? 'error' : 'success',
        error: httpErr?.message
      });
    } catch (e: any) {
      results.push({
        step: 'Enable HTTP Extension',
        status: 'warning',
        message: 'Could not verify http extension, may need manual enable in SQL Editor'
      });
    }

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);

      try {
        // Use the raw SQL query approach
        const { data, error } = await supabase.rpc('exec', {
          sql: stmt + ';'
        });

        results.push({
          step: `Statement ${i + 1}`,
          status: error ? 'error' : 'success',
          error: error?.message,
          preview: stmt.substring(0, 100)
        });
      } catch (err: any) {
        results.push({
          step: `Statement ${i + 1}`,
          status: 'error',
          error: err.message,
          preview: stmt.substring(0, 100)
        });
      }
    }

    // Step 3: Verify the cron job was created
    const { data: cronJobs, error: cronError } = await supabase
      .from('cron.job')
      .select('*');

    return NextResponse.json({
      success: true,
      message: 'Email cron deployment attempted',
      results,
      cronJobs: cronJobs || [],
      note: 'If http extension or cron job creation failed, please run the SQL manually in Supabase SQL Editor'
    });

  } catch (error: any) {
    console.error('Error deploying email cron:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      note: 'Please run supabase/migrations/20251109_add_daily_email_cron.sql manually in Supabase SQL Editor'
    }, { status: 500 });
  }
}
