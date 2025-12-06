/**
 * Admin API to run database migrations
 *
 * POST /api/admin/run-migration
 * Body: { migration: "add-country-filtering" }
 *
 * Requires CRON_SECRET header for authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CRON_SECRET = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  // Auth check
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await request.json();
    const { migration } = body;

    if (migration === 'add-country-filtering') {
      // Check if columns exist
      const { data: monitorTest, error: monitorError } = await supabase
        .from('linkedin_post_monitors')
        .select('id, target_countries')
        .limit(1);

      const { data: postTest, error: postError } = await supabase
        .from('linkedin_posts_discovered')
        .select('id, author_country')
        .limit(1);

      // If columns don't exist, we can't add them via Supabase client
      // But we CAN check if they exist and report status
      const monitorHasColumn = !monitorError || !monitorError.message.includes('target_countries');
      const postHasColumn = !postError || !postError.message.includes('author_country');

      if (!monitorHasColumn || !postHasColumn) {
        return NextResponse.json({
          success: false,
          message: 'Columns need to be added via Supabase SQL Editor',
          columns_status: {
            'linkedin_post_monitors.target_countries': monitorHasColumn ? 'EXISTS' : 'MISSING',
            'linkedin_posts_discovered.author_country': postHasColumn ? 'EXISTS' : 'MISSING'
          },
          sql_to_run: `
-- Run this in Supabase SQL Editor:
ALTER TABLE linkedin_post_monitors ADD COLUMN IF NOT EXISTS target_countries TEXT[] DEFAULT NULL;
ALTER TABLE linkedin_posts_discovered ADD COLUMN IF NOT EXISTS author_country TEXT DEFAULT NULL;
`
        });
      }

      return NextResponse.json({
        success: true,
        message: 'All columns exist',
        columns_status: {
          'linkedin_post_monitors.target_countries': 'EXISTS',
          'linkedin_posts_discovered.author_country': 'EXISTS'
        }
      });
    }

    return NextResponse.json({ error: 'Unknown migration' }, { status: 400 });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    available_migrations: ['add-country-filtering'],
    usage: 'POST /api/admin/run-migration with { migration: "name" } and x-cron-secret header'
  });
}
