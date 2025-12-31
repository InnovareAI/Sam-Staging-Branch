import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

/**
 * GET /api/user/get-timezone
 * Fetch user's saved timezone preference
 * Returns null if never set (first campaign creation)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate with Firebase
    const { userId } = await verifyAuth(request);

    // Get user's timezone preference
    const { rows } = await pool.query(
      'SELECT profile_timezone FROM users WHERE id = $1',
      [userId]
    );

    if (rows.length === 0) {
      console.error('Failed to fetch timezone: user not found');
      return NextResponse.json(
        { timezone: null }, // Return null on error, will use default
        { status: 200 }
      );
    }

    return NextResponse.json({
      timezone: rows[0]?.profile_timezone || null
    });

  } catch (error) {
    console.error('Get timezone error:', error);
    return NextResponse.json(
      { timezone: null }, // Return null on error, will use default
      { status: 200 }
    );
  }
}
