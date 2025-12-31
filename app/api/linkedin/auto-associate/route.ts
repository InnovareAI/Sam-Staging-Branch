import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

// Auto-associate existing Unipile LinkedIn accounts with SAM AI workspaces
export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId, userEmail } = await verifyAuth(request);

    console.log(`Auto-association request from user: ${userEmail}`);

    // Get Unipile configuration
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;

    if (!unipileDsn || !unipileApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Unipile configuration missing',
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }

    // Fetch all Unipile accounts
    const unipileResponse = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': unipileApiKey
      }
    });

    if (!unipileResponse.ok) {
      throw new Error(`Unipile API error: ${unipileResponse.status}`);
    }

    const unipileData = await unipileResponse.json();
    const linkedinAccounts = unipileData.items?.filter((account: any) => account.type === 'LINKEDIN') || [];

    console.log(`Found ${linkedinAccounts.length} LinkedIn accounts in Unipile`);

    // Check existing associations in this workspace
    const { rows: existingAssociations } = await pool.query(
      `SELECT unipile_account_id
       FROM workspace_accounts
       WHERE workspace_id = $1 AND user_id = $2 AND account_type = 'linkedin'`,
      [workspaceId, userId]
    );

    const existingAccountIds = new Set(existingAssociations?.map((a: any) => a.unipile_account_id) || []);

    let associatedCount = 0;
    const newAssociations: any[] = [];

    // Process each LinkedIn account for potential association
    for (const account of linkedinAccounts) {
      // Skip if already associated
      if (existingAccountIds.has(account.id)) {
        console.log(`Skipping ${account.name} - already associated`);
        continue;
      }

      // Get user's email domain for matching
      const userEmailDomain = userEmail?.split('@')[1]?.toLowerCase();

      // Check if account has InnovareAI organization (primary matching criteria)
      const hasInnovareOrg = account.connection_params?.im?.organizations?.some((org: any) =>
        org.name?.toLowerCase().includes('innovareai') ||
        org.name?.toLowerCase().includes('innovare')
      );

      // Additional matching criteria
      const accountEmail = account.connection_params?.im?.username || account.name;
      const accountEmailDomain = accountEmail?.includes('@') ? accountEmail.split('@')[1]?.toLowerCase() : null;
      const emailDomainMatch = accountEmailDomain && userEmailDomain && accountEmailDomain === userEmailDomain;

      // Match logic: InnovareAI organization OR email domain match
      if (hasInnovareOrg || emailDomainMatch) {
        const now = new Date().toISOString();
        newAssociations.push({
          workspace_id: workspaceId,
          user_id: userId,
          unipile_account_id: account.id,
          account_type: 'linkedin',
          account_name: account.name,
          account_identifier: account.connection_params?.im?.publicIdentifier || account.name,
          connection_status: 'active',
          created_at: now,
          updated_at: now
        });

        associatedCount++;

        console.log(`Will associate ${account.name} (${account.id})`);
        console.log(`   - InnovareAI org: ${hasInnovareOrg}`);
        console.log(`   - Email domain match: ${emailDomainMatch}`);
      } else {
        console.log(`No match for ${account.name} - skipping`);
      }
    }

    // Insert new associations if any found
    if (newAssociations.length > 0) {
      for (const assoc of newAssociations) {
        try {
          await pool.query(
            `INSERT INTO workspace_accounts
             (workspace_id, user_id, unipile_account_id, account_type, account_name, account_identifier, connection_status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              assoc.workspace_id,
              assoc.user_id,
              assoc.unipile_account_id,
              assoc.account_type,
              assoc.account_name,
              assoc.account_identifier,
              assoc.connection_status,
              assoc.created_at,
              assoc.updated_at
            ]
          );
        } catch (insertError: any) {
          console.error('Error inserting association:', insertError);
          // Continue with other associations
        }
      }

      console.log(`Successfully associated ${associatedCount} LinkedIn accounts`);
    }

    return NextResponse.json({
      success: true,
      message: `Auto-association complete`,
      total_unipile_accounts: linkedinAccounts.length,
      existing_associations: existingAssociations?.length || 0,
      new_associations: associatedCount,
      workspace_id: workspaceId,
      user_email: userEmail,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in auto-association:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET method to preview potential associations without creating them
export async function GET(request: NextRequest) {
  try {
    const { userEmail } = await verifyAuth(request);

    // Get Unipile configuration
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;

    if (!unipileDsn || !unipileApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Unipile configuration missing',
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }

    // Fetch all Unipile accounts
    const unipileResponse = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': unipileApiKey
      }
    });

    if (!unipileResponse.ok) {
      throw new Error(`Unipile API error: ${unipileResponse.status}`);
    }

    const unipileData = await unipileResponse.json();
    const linkedinAccounts = unipileData.items?.filter((account: any) => account.type === 'LINKEDIN') || [];

    // Get user's email domain for matching
    const userEmailDomain = userEmail?.split('@')[1]?.toLowerCase();

    const potentialMatches = linkedinAccounts.map((account: any) => {
      const hasInnovareOrg = account.connection_params?.im?.organizations?.some((org: any) =>
        org.name?.toLowerCase().includes('innovareai') ||
        org.name?.toLowerCase().includes('innovare')
      );

      const accountEmail = account.connection_params?.im?.username || account.name;
      const accountEmailDomain = accountEmail?.includes('@') ? accountEmail.split('@')[1]?.toLowerCase() : null;
      const emailDomainMatch = accountEmailDomain && userEmailDomain && accountEmailDomain === userEmailDomain;

      return {
        account_id: account.id,
        account_name: account.name,
        account_identifier: account.connection_params?.im?.publicIdentifier,
        status: account.sources?.[0]?.status,
        match_criteria: {
          innovare_org: hasInnovareOrg,
          email_domain_match: emailDomainMatch,
          would_associate: hasInnovareOrg || emailDomainMatch
        },
        organizations: account.connection_params?.im?.organizations?.map((org: any) => org.name) || []
      };
    });

    return NextResponse.json({
      success: true,
      user_email: userEmail,
      user_domain: userEmailDomain,
      total_accounts: linkedinAccounts.length,
      potential_matches: potentialMatches,
      associable_count: potentialMatches.filter((m: any) => m.match_criteria.would_associate).length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error previewing associations:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
