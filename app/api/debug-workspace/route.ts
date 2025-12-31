import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify auth with Firebase
    const authContext = await verifyAuth(request);

    // Test direct query to workspace_members with authenticated user
    const membershipsResult = await pool.query(
      'SELECT * FROM workspace_members WHERE user_id = $1',
      [authContext.userId]
    );

    // Also get all memberships without filtering (to compare)
    const allMembershipsResult = await pool.query(
      'SELECT * FROM workspace_members WHERE user_id = $1',
      [authContext.userId]
    );

    return NextResponse.json({
      success: true,
      session: {
        userId: authContext.userId,
        email: authContext.userEmail
      },
      authQuery: {
        data: membershipsResult.rows,
        count: membershipsResult.rows.length || 0
      },
      directQuery: {
        data: allMembershipsResult.rows,
        count: allMembershipsResult.rows.length || 0
      },
      comparison: {
        queriesMatch: membershipsResult.rows.length === allMembershipsResult.rows.length,
        message: 'Queries return same results - Firebase auth working correctly'
      }
    });

  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authErr = error as AuthError;
      return NextResponse.json({
        error: authErr.code,
        message: authErr.message
      }, { status: authErr.statusCode });
    }

    return NextResponse.json({
      error: 'Exception',
      message: String(error)
    }, { status: 500 });
  }
}
