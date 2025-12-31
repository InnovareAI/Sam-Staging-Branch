import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate with Firebase
    await verifyAuth(request);

    // Delete all LinkedIn accounts from user_unipile_accounts
    const result = await pool.query(
      "DELETE FROM user_unipile_accounts WHERE platform = 'LINKEDIN' RETURNING id"
    );

    // Also delete from workspace_accounts
    await pool.query(
      "DELETE FROM workspace_accounts WHERE account_type = 'linkedin'"
    );

    return NextResponse.json({
      success: true,
      message: 'All LinkedIn accounts deleted from database',
      deleted_count: result.rowCount
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Delete error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
