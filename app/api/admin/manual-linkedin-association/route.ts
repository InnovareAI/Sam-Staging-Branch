import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/route-auth';
import { pool } from '@/lib/auth';

// Admin endpoint to manually associate LinkedIn accounts with users
export async function POST(request: NextRequest) {
  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { user_email, unipile_account_id, account_name, linkedin_username, public_identifier } = await request.json();

    if (!user_email || !unipile_account_id) {
      return NextResponse.json({
        success: false,
        error: 'user_email and unipile_account_id are required'
      }, { status: 400 });
    }

    // Find the user by email
    const usersResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1 LIMIT 1',
      [user_email]
    );
    const users = usersResult.rows;

    let userId = users?.[0]?.id;

    // If not found in users table
    if (!userId) {
      console.log(`User not found in users table, searching by email: ${user_email}`);

      // Check if we have any existing associations
      const existingAssocResult = await pool.query(
        'SELECT user_id FROM user_unipile_accounts LIMIT 1'
      );

      if (existingAssocResult.rows?.length > 0) {
        return NextResponse.json({
          success: false,
          error: `Cannot automatically find user ID for ${user_email}. Please provide the user_id directly.`,
          debug_info: {
            searched_email: user_email,
            found_in_users_table: !!users?.length,
            existing_associations_count: existingAssocResult.rows?.length || 0
          }
        }, { status: 404 });
      }
    }

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: `User not found with email: ${user_email}`
      }, { status: 404 });
    }

    console.log(`Creating LinkedIn association for user ${user_email} (${userId}) with account ${unipile_account_id}`);

    // Create the association
    const insertResult = await pool.query(`
      INSERT INTO user_unipile_accounts
      (user_id, unipile_account_id, platform, account_name, account_email, linkedin_public_identifier, linkedin_profile_url, connection_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      userId,
      unipile_account_id,
      'LINKEDIN',
      account_name || 'LinkedIn Account',
      linkedin_username,
      public_identifier,
      public_identifier ? `https://linkedin.com/in/${public_identifier}` : null,
      'active'
    ]);

    if (insertResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create association',
        debug_info: {
          user_id: userId,
          unipile_account_id: unipile_account_id
        }
      }, { status: 500 });
    }

    console.log(`✅ Successfully created LinkedIn association for ${user_email}`);

    return NextResponse.json({
      success: true,
      message: 'LinkedIn account successfully associated',
      association: insertResult.rows[0],
      user_info: {
        user_id: userId,
        user_email: user_email
      },
      account_info: {
        unipile_account_id: unipile_account_id,
        account_name: account_name,
        public_identifier: public_identifier,
        platform: 'LINKEDIN'
      }
    });

  } catch (error: any) {
    console.error('Manual LinkedIn association error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

// GET method to check existing associations
export async function GET(request: NextRequest) {
  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const user_email = url.searchParams.get('user_email');

    if (user_email) {
      // Find user and their associations
      const usersResult = await pool.query(
        'SELECT id, email FROM users WHERE email = $1 LIMIT 1',
        [user_email]
      );

      if (!usersResult.rows?.length) {
        return NextResponse.json({
          success: false,
          error: `User not found: ${user_email}`
        }, { status: 404 });
      }

      const userId = usersResult.rows[0].id;

      const associationsResult = await pool.query(
        'SELECT * FROM user_unipile_accounts WHERE user_id = $1',
        [userId]
      );

      return NextResponse.json({
        success: true,
        user: usersResult.rows[0],
        associations: associationsResult.rows || []
      });
    } else {
      // Get all associations
      const associationsResult = await pool.query(
        'SELECT * FROM user_unipile_accounts ORDER BY created_at DESC LIMIT 20'
      );

      return NextResponse.json({
        success: true,
        associations: associationsResult.rows || []
      });
    }

  } catch (error) {
    console.error('Error checking associations:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
