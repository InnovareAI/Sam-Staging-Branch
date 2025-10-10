import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Admin Route: Setup Prospect Search Jobs Tables
 *
 * Runs the migration to create prospect_search_jobs and prospect_search_results tables
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('📊 Creating prospect_search_jobs tables...');

    // Read migration file
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20251010000001_create_prospect_search_jobs.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0 && !s.startsWith('--'));

    const results = [];
    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.error('SQL error:', error);
          results.push({ statement: statement.substring(0, 100), error: error.message });
        } else {
          results.push({ statement: statement.substring(0, 100), success: true });
        }
      } catch (err) {
        console.error('Execution error:', err);
        results.push({ statement: statement.substring(0, 100), error: String(err) });
      }
    }

    // Verify tables were created
    const { data: jobsTable } = await supabase
      .from('prospect_search_jobs')
      .select('id')
      .limit(1);

    const { data: resultsTable } = await supabase
      .from('prospect_search_results')
      .select('id')
      .limit(1);

    return NextResponse.json({
      success: true,
      message: 'Prospect search jobs tables setup complete',
      tables_verified: {
        prospect_search_jobs: jobsTable !== null,
        prospect_search_results: resultsTable !== null
      },
      execution_results: results
    });

  } catch (error) {
    console.error('❌ Setup error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Setup failed'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Admin endpoint: Setup Prospect Search Jobs Tables',
    description: 'POST to this endpoint to create the prospect_search_jobs and prospect_search_results tables',
    tables: [
      'prospect_search_jobs - Tracks async search jobs',
      'prospect_search_results - Stores prospect data from searches'
    ]
  });
}
