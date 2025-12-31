/**
 * Reply Agent Settings API
 * GET/PUT settings for workspace reply agent configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { getDefaultSettings } from '@/lib/services/reply-draft-generator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Firebase auth - workspace comes from header
    let authContext;
    try {
      authContext = await verifyAuth(request);
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }

    const { workspaceId } = authContext;

    // Get settings or return defaults
    const { rows } = await pool.query(
      `SELECT * FROM reply_agent_settings WHERE workspace_id = $1`,
      [workspaceId]
    );

    const settings = rows[0] || null;

    // Merge with defaults
    const defaults = getDefaultSettings();
    const mergedSettings = {
      ...defaults,
      ...settings,
      workspace_id: workspaceId
    };

    return NextResponse.json({
      success: true,
      settings: mergedSettings,
      isDefault: !settings
    });

  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Firebase auth - workspace comes from header
    let authContext;
    try {
      authContext = await verifyAuth(request);
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }

    const { workspaceId, workspaceRole } = authContext;

    // Verify admin/owner role
    if (!['owner', 'admin'].includes(workspaceRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { workspace_id: bodyWorkspaceId, ...settingsData } = body;

    // Build dynamic upsert query
    const columns = Object.keys(settingsData);
    const values = Object.values(settingsData);
    const placeholders = columns.map((_, i) => `$${i + 2}`);

    // Upsert settings
    const { rows } = await pool.query(
      `INSERT INTO reply_agent_settings (workspace_id, ${columns.join(', ')}, updated_at)
       VALUES ($1, ${placeholders.join(', ')}, NOW())
       ON CONFLICT (workspace_id)
       DO UPDATE SET ${columns.map((col, i) => `${col} = $${i + 2}`).join(', ')}, updated_at = NOW()
       RETURNING *`,
      [workspaceId, ...values]
    );

    return NextResponse.json({
      success: true,
      settings: rows[0]
    });

  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
