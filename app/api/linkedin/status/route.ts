import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

// Enhanced LinkedIn connection status with comprehensive diagnostics
export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId, userEmail } = await verifyAuth(request);

    // Get Unipile configuration
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;
    const configurationReady = !!(unipileDsn && unipileApiKey);

    // Legacy integrations table (backwards compatibility)
    // Note: integrations table doesn't have workspace_id column, workspace is stored in settings.workspace_id
    const { rows: legacyGlobalIntegrations } = await pool.query(
      "SELECT * FROM integrations WHERE user_id = $1 AND provider = 'linkedin'",
      [userId]
    );

    // Filter integrations by workspace from settings
    const legacyWorkspaceIntegrations = legacyGlobalIntegrations?.filter(
      (integration: any) => integration.settings?.workspace_id === workspaceId
    ) || [];

    // New workspace_accounts table (per-workspace associations)
    const { rows: workspaceAccountRows } = await pool.query(
      "SELECT * FROM workspace_accounts WHERE workspace_id = $1 AND user_id = $2 AND account_type = 'linkedin'",
      [workspaceId, userId]
    );

    const { rows: globalAccountRows } = await pool.query(
      "SELECT * FROM workspace_accounts WHERE user_id = $1 AND account_type = 'linkedin'",
      [userId]
    );

    const workspaceAccounts = [
      ...(legacyWorkspaceIntegrations || []).map((row: any) => ({
        source: 'integrations',
        id: row.id,
        workspace_id: row.settings?.workspace_id || workspaceId,
        user_id: row.user_id,
        account_identifier: row.credentials?.account_email || row.credentials?.linkedin_public_identifier || row.account_identifier,
        account_name: row.credentials?.account_name || row.account_name,
        unipile_account_id: row.credentials?.unipile_account_id,
        connection_status: row.status || 'connected'
      })),
      ...(workspaceAccountRows || []).map((row: any) => ({
        source: 'workspace_accounts',
        id: row.id,
        workspace_id: row.workspace_id,
        user_id: row.user_id,
        account_identifier: row.account_identifier,
        account_name: row.account_name,
        unipile_account_id: row.unipile_account_id,
        connection_status: row.connection_status || 'connected'
      }))
    ];

    const globalAccounts = [
      ...(legacyGlobalIntegrations || []).map((row: any) => ({
        source: 'integrations',
        id: row.id,
        workspace_id: row.settings?.workspace_id,
        user_id: row.user_id,
        account_identifier: row.credentials?.account_email || row.credentials?.linkedin_public_identifier || row.account_identifier,
        account_name: row.credentials?.account_name || row.account_name,
        unipile_account_id: row.credentials?.unipile_account_id,
        connection_status: row.status || 'connected'
      })),
      ...(globalAccountRows || []).map((row: any) => ({
        source: 'workspace_accounts',
        id: row.id,
        workspace_id: row.workspace_id,
        user_id: row.user_id,
        account_identifier: row.account_identifier,
        account_name: row.account_name,
        unipile_account_id: row.unipile_account_id,
        connection_status: row.connection_status || 'connected'
      }))
    ];

    let unipileStatus: {
      connected: boolean;
      accounts: any[];
      all_accounts: any[];
      error: string | null;
    } = {
      connected: false,
      accounts: [],
      all_accounts: [],
      error: null
    };

    // Check Unipile accounts if configuration is ready
    if (configurationReady) {
      try {
        const unipileUrl = `https://${unipileDsn}/api/v1/accounts`;
        const response = await fetch(unipileUrl, {
          headers: {
            'X-API-KEY': unipileApiKey!,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const allLinkedinAccounts = data.items?.filter((acc: any) => acc.type === 'LINKEDIN') || [];
          const activeLinkedinAccounts = allLinkedinAccounts.filter((acc: any) => acc.sources?.[0]?.status === 'OK');

          unipileStatus = {
            connected: true,
            accounts: activeLinkedinAccounts.map((acc: any) => ({
              id: acc.id,
              name: acc.name,
              status: acc.sources?.[0]?.status || 'unknown',
              email: acc.connection_params?.im?.email || acc.connection_params?.im?.username,
              created_at: acc.created_at,
              has_2fa: acc.connection_params?.im?.two_factor_enabled || false,
              product_type: acc.connection_params?.product_type,
              linkedin_id: acc.connection_params?.im?.id
            })),
            all_accounts: allLinkedinAccounts.map((acc: any) => ({
              id: acc.id,
              name: acc.name,
              status: acc.sources?.[0]?.status || 'unknown',
              email: acc.connection_params?.im?.email || acc.connection_params?.im?.username,
              created_at: acc.created_at,
              has_2fa: acc.connection_params?.im?.two_factor_enabled || false,
              product_type: acc.connection_params?.product_type,
              linkedin_id: acc.connection_params?.im?.id
            })),
            error: null
          };
        } else {
          unipileStatus.error = `Unipile API error: ${response.status}`;
        }
      } catch (error) {
        unipileStatus.error = error instanceof Error ? error.message : 'Network error';
      }
    } else {
      unipileStatus.error = 'Unipile configuration missing';
    }

    // Determine overall connection status
    const hasWorkspaceConnections = workspaceAccounts && workspaceAccounts.length > 0;
    const hasGlobalConnections = globalAccounts && globalAccounts.length > 0;
    const hasActiveUnipileAccounts = unipileStatus.accounts.length > 0;
    const hasAnyUnipileAccounts = unipileStatus.all_accounts.length > 0;

    // Auto-link Unipile accounts if webhook failed but we see accounts via API
    if (!workspaceAccounts.length && hasAnyUnipileAccounts) {
      const primaryAccount: any = unipileStatus.accounts[0] || unipileStatus.all_accounts[0];
      if (primaryAccount) {
        try {
          const accountIdentifier = primaryAccount.email || primaryAccount.linkedin_id || primaryAccount.name || primaryAccount.id;
          const accountName = primaryAccount.name || accountIdentifier;
          const connectionStatus = primaryAccount.status === 'OK' ? 'connected' : (primaryAccount.status || 'error');

          // Save to workspace_accounts
          const { rows: upsertedRows } = await pool.query(
            `INSERT INTO workspace_accounts
             (workspace_id, user_id, account_type, account_identifier, account_name, unipile_account_id, connection_status, is_active, is_primary, connection_details)
             VALUES ($1, $2, 'linkedin', $3, $4, $5, $6, true, true, $7)
             ON CONFLICT (workspace_id, user_id, account_type, account_identifier)
             DO UPDATE SET
               account_name = EXCLUDED.account_name,
               unipile_account_id = EXCLUDED.unipile_account_id,
               connection_status = EXCLUDED.connection_status,
               connection_details = EXCLUDED.connection_details
             RETURNING *`,
            [
              workspaceId,
              userId,
              accountIdentifier,
              accountName,
              primaryAccount.id,
              connectionStatus,
              JSON.stringify({
                unipile_instance: unipileDsn,
                product_type: primaryAccount.product_type || null
              })
            ]
          );
          const upsertedAccount = upsertedRows[0];

          // ALSO save to user_unipile_accounts for diagnostic API
          await pool.query(
            `INSERT INTO user_unipile_accounts
             (user_id, unipile_account_id, platform, account_name, account_email, linkedin_public_identifier, linkedin_profile_url, connection_status)
             VALUES ($1, $2, 'LINKEDIN', $3, $4, $5, $6, 'active')
             ON CONFLICT (unipile_account_id)
             DO UPDATE SET
               account_name = EXCLUDED.account_name,
               account_email = EXCLUDED.account_email`,
            [
              userId,
              primaryAccount.id,
              accountName,
              primaryAccount.email,
              primaryAccount.linkedin_id,
              primaryAccount.linkedin_id ? `https://www.linkedin.com/in/${primaryAccount.linkedin_id}` : null
            ]
          );

          const linkedAccount = {
            source: 'workspace_accounts',
            id: upsertedAccount?.id || primaryAccount.id,
            workspace_id: workspaceId,
            user_id: userId,
            account_identifier: accountIdentifier,
            account_name: accountName,
            unipile_account_id: primaryAccount.id,
            connection_status: connectionStatus
          };
          workspaceAccounts.push(linkedAccount);
          globalAccounts.push(linkedAccount);
          console.log('Auto-linked LinkedIn account from Unipile polling', {
            workspace_id: workspaceId,
            user_id: userId,
            unipile_account_id: primaryAccount.id
          });
        } catch (autoLinkError) {
          console.error('Auto-link attempt failed', autoLinkError);
        }
      }
    }

    // Diagnose potential issues
    const diagnostics = {
      association_gap: hasAnyUnipileAccounts && !hasWorkspaceConnections,
      duplicate_accounts: unipileStatus.all_accounts.length > 1,
      inactive_accounts: unipileStatus.all_accounts.filter((acc: any) => acc.status !== 'OK').length,
      needs_2fa: unipileStatus.all_accounts.some((acc: any) => acc.has_2fa),
      workspace_mismatch: hasGlobalConnections && !hasWorkspaceConnections,
      configuration_issues: !configurationReady,
      total_unipile_accounts: unipileStatus.all_accounts.length,
      active_unipile_accounts: unipileStatus.accounts.length
    };

    // Generate client-friendly recommendations
    const recommendations: any[] = [];

    if (diagnostics.association_gap) {
      recommendations.push({
        type: 'action',
        priority: 'high',
        message: 'LinkedIn account found but not linked to your workspace',
        action: 'run_auto_association',
        description: 'Click to automatically link your existing LinkedIn account'
      });
    }

    if (diagnostics.inactive_accounts > 0) {
      recommendations.push({
        type: 'error',
        priority: 'high',
        message: `${diagnostics.inactive_accounts} LinkedIn account(s) need re-authentication`,
        action: 'reconnect_accounts',
        description: 'These accounts may be blocked or require 2FA verification'
      });
    }

    if (diagnostics.duplicate_accounts) {
      recommendations.push({
        type: 'warning',
        priority: 'medium',
        message: `${unipileStatus.all_accounts.length} LinkedIn accounts detected`,
        action: 'review_accounts',
        description: 'Multiple accounts may cause 2FA conflicts'
      });
    }

    if (diagnostics.workspace_mismatch) {
      recommendations.push({
        type: 'info',
        priority: 'medium',
        message: 'LinkedIn connected in other workspace but not this one',
        action: 'link_to_workspace',
        description: 'Your LinkedIn account is available but not linked to this workspace'
      });
    }

    if (diagnostics.configuration_issues) {
      recommendations.push({
        type: 'error',
        priority: 'critical',
        message: 'LinkedIn integration not configured',
        action: 'contact_support',
        description: 'Please contact support to enable LinkedIn integration'
      });
    }

    // Calculate connection health score (0-100)
    let healthScore = 0;
    if (hasWorkspaceConnections) healthScore += 50;
    if (hasActiveUnipileAccounts) healthScore += 30;
    if (!diagnostics.association_gap) healthScore += 10;
    if (diagnostics.inactive_accounts === 0) healthScore += 10;

    // FIXED: Prioritize database integration over Unipile API check
    // If we have a database integration, trust it regardless of Unipile API status
    const overallStatus = hasWorkspaceConnections ? 'connected'
      : hasAnyUnipileAccounts ? 'connected'
        : 'disconnected';

    console.log(`LinkedIn status for ${userEmail}:`, {
      overall: overallStatus,
      workspace_accounts: workspaceAccounts?.length || 0,
      unipile_accounts: unipileStatus.accounts.length,
      health_score: healthScore
    });

    return NextResponse.json({
      success: true,
      has_linkedin: overallStatus === 'connected',
      connection_status: {
        overall: overallStatus,
        health_score: healthScore,
        workspace_accounts: workspaceAccounts?.length || 0,
        global_accounts: globalAccounts?.length || 0,
        active_unipile_accounts: unipileStatus.accounts.length,
        total_unipile_accounts: unipileStatus.all_accounts.length
      },
      accounts: {
        workspace: workspaceAccounts || [],
        unipile_active: unipileStatus.accounts,
        unipile_all: unipileStatus.all_accounts
      },
      associations: workspaceAccounts || [],
      diagnostics,
      recommendations,
      configuration: {
        ready: configurationReady,
        unipile_status: unipileStatus.connected ? 'connected' : 'error',
        unipile_error: unipileStatus.error
      },
      workspace_id: workspaceId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('LinkedIn status check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      has_linkedin: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// POST method for status-based actions
export async function POST(request: NextRequest) {
  try {
    const { userId, userEmail } = await verifyAuth(request);

    const body = await request.json();
    const { action, account_id } = body;

    switch (action) {
      case 'refresh_status':
        // Trigger a fresh status check by redirecting to GET
        const url = new URL('/api/linkedin/status', request.url);
        return NextResponse.redirect(url);

      case 'run_auto_association':
        // Trigger auto-association for this user
        const autoResponse = await fetch(`${request.nextUrl.origin}/api/linkedin/auto-associate`, {
          method: 'POST',
          headers: {
            'Cookie': request.headers.get('Cookie') || '',
            'Content-Type': 'application/json'
          }
        });
        const autoData = await autoResponse.json();

        return NextResponse.json({
          success: autoData.success,
          message: autoData.success
            ? `Successfully linked ${autoData.associations_created} account(s)`
            : 'No accounts were linked',
          data: autoData,
          timestamp: new Date().toISOString()
        });

      case 'force_reconnect':
        // Force reconnection flow
        const connectResponse = await fetch(`${request.nextUrl.origin}/api/linkedin/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || ''
          }
        });
        const connectData = await connectResponse.json();

        return NextResponse.json({
          success: connectData.success,
          auth_url: connectData.auth_url,
          message: 'Reconnection initiated',
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('LinkedIn status action error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
