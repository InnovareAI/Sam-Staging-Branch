import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId, userEmail } = await verifyAuth(request);

    console.log(`SIMPLE LinkedIn association for user ${userEmail} (${userId})`);
    console.log(`User workspace: ${workspaceId}`);

    // Try to create just one account first to test
    const testAccount = {
      id: '3Zj8ks8aSrKg0ySaLQo_8A',
      name: 'Irish Cita De Ade'
    };

    console.log(`Testing single account creation: ${testAccount.name}`);

    // First check what's already in workspace_accounts
    const { rows: existingAccounts } = await pool.query(
      `SELECT * FROM workspace_accounts
       WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );

    console.log(`Existing accounts in workspace: ${existingAccounts?.length || 0}`);

    // Try the minimal insert with all required fields
    const now = new Date().toISOString();

    try {
      const { rows: insertedRows } = await pool.query(
        `INSERT INTO workspace_accounts
         (workspace_id, user_id, account_type, account_identifier, account_name, unipile_account_id, connection_status, created_at, updated_at, metadata)
         VALUES ($1, $2, 'linkedin', $3, $4, $5, 'connected', $6, $7, $8)
         RETURNING *`,
        [
          workspaceId,
          userId,
          testAccount.name,
          testAccount.name,
          testAccount.id,
          now,
          now,
          JSON.stringify({
            linkedin_experience: 'classic',
            connection_method: 'simple_test',
            test_account: true,
            timestamp: now
          })
        ]
      );
      const newAccount = insertedRows[0];

      console.log(`Successfully created account:`, newAccount);

      return NextResponse.json({
        success: true,
        message: 'Simple association test successful',
        account_created: newAccount,
        workspace_id: workspaceId,
        user_email: userEmail
      });
    } catch (insertError: any) {
      console.error(`Insert failed:`, insertError);
      return NextResponse.json({
        success: false,
        error: `Database insert failed: ${insertError.message || JSON.stringify(insertError)}`,
        details: insertError,
        error_code: insertError.code,
        error_hint: insertError.hint
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Simple association error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Simple association failed',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
