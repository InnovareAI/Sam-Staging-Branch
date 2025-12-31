import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);

    // Get all LinkedIn accounts for this user
    const { rows: accounts } = await pool.query(
      `SELECT * FROM user_unipile_accounts
       WHERE user_id = $1 AND platform = 'LINKEDIN'
       ORDER BY created_at ASC`,
      [userId]
    );

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch accounts'
      }, { status: 500 });
    }

    if (accounts.length <= 1) {
      return NextResponse.json({
        success: true,
        message: 'No duplicates found',
        total_accounts: accounts.length
      });
    }

    // Keep the oldest account, delete the rest
    const keepAccount = accounts[0];
    const duplicates = accounts.slice(1);

    // Delete from database
    const duplicateIds = duplicates.map((d: any) => d.id);
    await pool.query(
      `DELETE FROM user_unipile_accounts WHERE id = ANY($1)`,
      [duplicateIds]
    );

    // Delete from Unipile
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;

    if (unipileDsn && unipileApiKey) {
      for (const dup of duplicates) {
        try {
          await fetch(`https://${unipileDsn}/api/v1/accounts/${dup.unipile_account_id}`, {
            method: 'DELETE',
            headers: {
              'X-API-KEY': unipileApiKey,
              'Accept': 'application/json'
            }
          });
        } catch (err) {
          console.error(`Failed to delete ${dup.unipile_account_id} from Unipile:`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${duplicates.length} duplicate account(s)`,
      kept_account: {
        id: keepAccount.unipile_account_id,
        name: keepAccount.account_name,
        created_at: keepAccount.created_at
      },
      deleted_count: duplicates.length
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
