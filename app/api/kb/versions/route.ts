/**
 * KB Version History API
 * Get version history for KB items
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/kb/versions
 * Get version history for a KB item
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kbItemId = searchParams.get('kb_item_id');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!kbItemId) {
      return NextResponse.json({ error: 'kb_item_id required' }, { status: 400 });
    }

    // Get version history
    const { data: versions, error } = await supabase.rpc('get_kb_version_history', {
      p_kb_item_id: kbItemId,
      p_limit: limit
    });

    if (error) {
      console.error('Failed to get version history:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      versions: versions || [],
      count: versions?.length || 0
    });
  } catch (error) {
    console.error('Version history GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/kb/versions/compare
 * Compare two versions of a KB item
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kb_item_id, version_a, version_b } = body;

    if (!kb_item_id || !version_a || !version_b) {
      return NextResponse.json(
        { error: 'kb_item_id, version_a, and version_b required' },
        { status: 400 }
      );
    }

    // Compare versions
    const { data: comparison, error } = await supabase.rpc('compare_kb_versions', {
      p_kb_item_id: kb_item_id,
      p_version_a: version_a,
      p_version_b: version_b
    });

    if (error) {
      console.error('Failed to compare versions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      comparison: comparison || [],
      version_a,
      version_b
    });
  } catch (error) {
    console.error('Version comparison error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
