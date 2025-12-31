/**
 * Test Thread Creation Diagnostic Endpoint
 *
 * This endpoint helps diagnose why thread creation is failing for a specific user
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuth, pool } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      deployment_commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_REF || 'unknown',
      deployment_env: process.env.NETLIFY ? 'netlify' : process.env.VERCEL ? 'vercel' : 'local',
      auth: {
        hasUser: false,
        userId: null,
        userEmail: null,
        authError: null
      },
      cookies: cookieStore.getAll().map(c => ({ name: c.name, hasValue: !!c.value })),
      user_profile: null,
      workspace_membership: null,
      workspace_details: null,
      existing_threads: null,
      can_create_thread: false,
      errors: []
    };

    // Try to verify auth
    let userId: string | null = null;
    let userEmail: string | null = null;

    try {
      const authResult = await verifyAuth(request);
      userId = authResult.userId;
      userEmail = authResult.userEmail;
      diagnostics.auth = {
        hasUser: true,
        userId: userId,
        userEmail: userEmail,
        authError: null
      };
    } catch (authError: any) {
      diagnostics.auth.authError = authError.message || 'Authentication failed';
      return NextResponse.json({
        success: false,
        message: 'Not authenticated',
        diagnostics
      }, { status: 401 });
    }

    // Check user profile
    try {
      const profileResult = await pool.query(
        'SELECT id, email, current_workspace_id, created_at FROM users WHERE id = $1',
        [userId]
      );
      const profile = profileResult.rows[0];

      diagnostics.user_profile = {
        exists: !!profile,
        current_workspace_id: profile?.current_workspace_id,
        error: null
      };
    } catch (error: any) {
      diagnostics.errors.push(`Profile check failed: ${error.message}`);
    }

    // Check workspace membership
    try {
      const membershipsResult = await pool.query(
        'SELECT workspace_id, role, joined_at FROM workspace_members WHERE user_id = $1',
        [userId]
      );
      const memberships = membershipsResult.rows;

      diagnostics.workspace_membership = {
        count: memberships?.length || 0,
        memberships: memberships,
        error: null
      };

      // Get workspace details
      if (memberships && memberships.length > 0) {
        const workspaceIds = memberships.map(m => m.workspace_id);
        const workspacesResult = await pool.query(
          'SELECT id, name, owner_id FROM workspaces WHERE id = ANY($1)',
          [workspaceIds]
        );

        diagnostics.workspace_details = {
          workspaces: workspacesResult.rows,
          error: null
        };
      }
    } catch (error: any) {
      diagnostics.errors.push(`Workspace check failed: ${error.message}`);
    }

    // Check existing threads
    try {
      const threadsResult = await pool.query(
        `SELECT id, title, created_at, workspace_id
         FROM sam_conversation_threads
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [userId]
      );

      diagnostics.existing_threads = {
        count: threadsResult.rows?.length || 0,
        recent_threads: threadsResult.rows,
        error: null
      };
    } catch (error: any) {
      diagnostics.errors.push(`Thread check failed: ${error.message}`);
    }

    // Test thread creation capability
    try {
      // Try to check if we can query the table (without actually inserting)
      const testResult = await pool.query(
        'SELECT id FROM sam_conversation_threads WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      diagnostics.can_create_thread = true;
    } catch (error: any) {
      diagnostics.errors.push(`Thread creation test error: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Diagnostics complete',
      diagnostics
    });

  } catch (error) {
    console.error('Diagnostic endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
