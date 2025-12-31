import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

/**
 * POST /api/user/update-timezone
 * Save user's timezone preference to their profile
 * Called after first campaign creation to remember their timezone choice
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate with Firebase
    const { userId, userEmail } = await verifyAuth(request);

    const body = await request.json();
    const { timezone } = body;

    if (!timezone) {
      return NextResponse.json(
        { error: 'Timezone is required' },
        { status: 400 }
      );
    }

    // Update user's timezone preference
    const result = await pool.query(
      'UPDATE users SET profile_timezone = $1 WHERE id = $2',
      [timezone, userId]
    );

    if (result.rowCount === 0) {
      console.error('Failed to update timezone: user not found');
      return NextResponse.json(
        { error: 'Failed to update timezone preference' },
        { status: 500 }
      );
    }

    console.log(`✅ Updated timezone for user ${userEmail}: ${timezone}`);

    return NextResponse.json({
      success: true,
      timezone
    });

  } catch (error) {
    console.error('Update timezone error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
