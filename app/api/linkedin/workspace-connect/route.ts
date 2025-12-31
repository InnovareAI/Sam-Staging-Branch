import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

// Simplified LinkedIn-Workspace Connection API
// This addresses the connection failures by simplifying the process

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId: authWorkspaceId, userEmail } = await verifyAuth(request);

    const body = await request.json();
    const {
      workspace_id,
      linkedin_email,
      linkedin_password,
      account_name,
      connection_type = 'new' // 'new' or 'existing'
    } = body;

    // Use workspace_id from body if provided, otherwise use from auth
    const effectiveWorkspaceId = workspace_id || authWorkspaceId;

    if (!effectiveWorkspaceId || !linkedin_email) {
      return NextResponse.json({
        error: 'Missing required fields: workspace_id, linkedin_email'
      }, { status: 400 });
    }

    // If body workspace_id differs from auth, verify access
    if (workspace_id && workspace_id !== authWorkspaceId) {
      const memberCheck = await pool.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspace_id, userId]
      );
      if (memberCheck.rows.length === 0) {
        return NextResponse.json({
          error: 'Access denied to workspace'
        }, { status: 403 });
      }
    }

    console.log(`LinkedIn workspace connection: ${linkedin_email} -> Workspace ${effectiveWorkspaceId}`);

    // Step 2: Check for existing LinkedIn connection in this workspace
    const existingResult = await pool.query(
      `SELECT * FROM workspace_accounts
       WHERE workspace_id = $1 AND account_type = 'linkedin' AND account_identifier = $2`,
      [effectiveWorkspaceId, linkedin_email]
    );

    const existingConnection = existingResult.rows[0];

    if (existingConnection && connection_type === 'new') {
      return NextResponse.json({
        error: 'LinkedIn account already connected to this workspace',
        existing_connection: existingConnection
      }, { status: 409 });
    }

    // Step 3: Connect to Unipile (simplified)
    const unipileAccountId = await connectToUnipile(linkedin_email, linkedin_password);

    if (!unipileAccountId) {
      return NextResponse.json({
        error: 'Failed to connect LinkedIn account via Unipile'
      }, { status: 500 });
    }

    // Step 4: Create or update workspace account record
    const now = new Date().toISOString();
    const accountMetadata = JSON.stringify({
      email: linkedin_email,
      connected_by: userEmail,
      connection_method: 'workspace_direct'
    });

    let workspaceAccount;
    if (existingConnection && connection_type === 'existing') {
      // Update existing connection
      const updateResult = await pool.query(
        `UPDATE workspace_accounts
         SET unipile_account_id = $1, connection_status = 'connected',
             connected_at = $2, last_verified_at = $3, account_metadata = $4, updated_at = $5
         WHERE id = $6
         RETURNING *`,
        [unipileAccountId, now, now, accountMetadata, now, existingConnection.id]
      );

      if (updateResult.rows.length === 0) {
        return NextResponse.json({
          error: 'Failed to update workspace connection'
        }, { status: 500 });
      }
      workspaceAccount = updateResult.rows[0];
    } else {
      // Create new connection
      const insertResult = await pool.query(
        `INSERT INTO workspace_accounts (
          workspace_id, user_id, account_type, account_identifier, account_name,
          unipile_account_id, connection_status, connected_at, last_verified_at, account_metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          effectiveWorkspaceId,
          userId,
          'linkedin',
          linkedin_email,
          account_name || linkedin_email,
          unipileAccountId,
          'connected',
          now,
          now,
          accountMetadata
        ]
      );

      if (insertResult.rows.length === 0) {
        return NextResponse.json({
          error: 'Failed to create workspace connection'
        }, { status: 500 });
      }
      workspaceAccount = insertResult.rows[0];
    }

    // Step 5: Verify connection works
    const connectionValid = await verifyLinkedInConnection(unipileAccountId);

    if (!connectionValid) {
      // Mark as needs attention but don't fail
      await pool.query(
        `UPDATE workspace_accounts SET connection_status = 'needs_verification', updated_at = $1 WHERE id = $2`,
        [now, workspaceAccount.id]
      );

      console.warn(`LinkedIn connection needs verification: ${unipileAccountId}`);
    }

    console.log(`LinkedIn workspace connection successful: ${linkedin_email} -> ${effectiveWorkspaceId}`);

    return NextResponse.json({
      success: true,
      workspace_account_id: workspaceAccount.id,
      unipile_account_id: unipileAccountId,
      connection_status: connectionValid ? 'connected' : 'needs_verification',
      account_details: {
        workspace_id: effectiveWorkspaceId,
        account_type: 'linkedin',
        account_identifier: linkedin_email,
        account_name: workspaceAccount.account_name,
        connected_at: workspaceAccount.connected_at
      },
      next_steps: connectionValid ? [
        'LinkedIn account ready for Sam Funnel campaigns',
        'Test connection with a small campaign',
        'Set up campaign templates and prospects'
      ] : [
        'LinkedIn connection needs verification',
        'Check account credentials',
        'Contact support if issues persist'
      ]
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('LinkedIn workspace connection error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Helper function to connect to Unipile
async function connectToUnipile(email: string, password: string): Promise<string | null> {
  try {
    const unipileUrl = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;

    if (!unipileUrl || !unipileApiKey) {
      console.error('Unipile configuration missing');
      return null;
    }

    // Create Unipile account
    const response = await fetch(`${unipileUrl}/api/v1/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': unipileApiKey
      },
      body: JSON.stringify({
        provider: 'linkedin',
        credentials: {
          email,
          password
        },
        name: `LinkedIn-${email}`,
        metadata: {
          connected_via: 'sam_funnel_workspace',
          connected_at: new Date().toISOString()
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Unipile connection failed:', response.status, errorText);
      return null;
    }

    const result = await response.json();
    console.log('Unipile connection successful:', result.account_id);

    return result.account_id;

  } catch (error) {
    console.error('Unipile connection error:', error);
    return null;
  }
}

// Helper function to verify LinkedIn connection
async function verifyLinkedInConnection(unipileAccountId: string): Promise<boolean> {
  try {
    const unipileUrl = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;

    if (!unipileUrl || !unipileApiKey) {
      return false;
    }

    // Test connection by getting account info
    const response = await fetch(`${unipileUrl}/api/v1/accounts/${unipileAccountId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': unipileApiKey
      }
    });

    if (!response.ok) {
      console.error('LinkedIn verification failed:', response.status);
      return false;
    }

    const account = await response.json();
    console.log('LinkedIn verification successful:', account.status);

    return account.status === 'connected' || account.status === 'active';

  } catch (error) {
    console.error('LinkedIn verification error:', error);
    return false;
  }
}

// GET method to check workspace LinkedIn connections
export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId: authWorkspaceId } = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const workspace_id = searchParams.get('workspace_id') || authWorkspaceId;

    if (!workspace_id) {
      return NextResponse.json({
        error: 'workspace_id parameter required'
      }, { status: 400 });
    }

    // If query workspace_id differs from auth, verify access
    if (workspace_id !== authWorkspaceId) {
      const memberCheck = await pool.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspace_id, userId]
      );
      if (memberCheck.rows.length === 0) {
        return NextResponse.json({
          error: 'Access denied to workspace'
        }, { status: 403 });
      }
    }

    // Get all LinkedIn connections for this workspace
    const accountsResult = await pool.query(
      `SELECT * FROM workspace_accounts
       WHERE workspace_id = $1 AND account_type = 'linkedin'
       ORDER BY connected_at DESC`,
      [workspace_id]
    );

    const linkedinAccounts = accountsResult.rows;

    // Count connected and needs_verification accounts
    const connectedCount = linkedinAccounts.filter(
      acc => VALID_CONNECTION_STATUSES.includes(acc.connection_status as any)
    ).length;
    const needsVerificationCount = linkedinAccounts.filter(
      acc => acc.connection_status === 'needs_verification'
    ).length;

    return NextResponse.json({
      success: true,
      workspace_id,
      linkedin_accounts: linkedinAccounts || [],
      total_accounts: linkedinAccounts?.length || 0,
      connected_accounts: connectedCount,
      needs_verification: needsVerificationCount
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Error fetching workspace LinkedIn accounts:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
