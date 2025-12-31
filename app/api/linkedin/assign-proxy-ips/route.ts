import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { AutoIPAssignmentService } from '@/lib/services/auto-ip-assignment';

// Helper function to extract country from LinkedIn account location
function detectCountryFromLinkedInAccount(account: any): string {
  // Try to get country from various Unipile fields
  const connectionParams = account.connection_params?.im || {};

  // 1. Check for explicit country field
  if (connectionParams.country) {
    return connectionParams.country;
  }

  // 2. Check location string and parse it
  const location = connectionParams.location || connectionParams.headline || '';
  if (location) {
    // Common country patterns in LinkedIn locations
    const countryPatterns = [
      { pattern: /Germany|Deutschland|Berlin|Munich|Hamburg|Frankfurt/i, country: 'Germany' },
      { pattern: /Austria|Österreich|Vienna|Wien|Salzburg/i, country: 'Austria' },
      { pattern: /Switzerland|Schweiz|Zurich|Geneva|Bern/i, country: 'Switzerland' },
      { pattern: /Philippines|Manila|Quezon|Cebu/i, country: 'Philippines' },
      { pattern: /Australia|Sydney|Melbourne|Brisbane|Perth/i, country: 'Australia' },
      { pattern: /United States|USA|US|New York|California|Texas|Florida/i, country: 'United States' },
      { pattern: /United Kingdom|UK|GB|London|Manchester|Birmingham/i, country: 'United Kingdom' },
      { pattern: /Canada|Toronto|Vancouver|Montreal|Calgary/i, country: 'Canada' },
      { pattern: /Netherlands|Amsterdam|Rotterdam|The Hague/i, country: 'Netherlands' },
      { pattern: /France|Paris|Lyon|Marseille/i, country: 'France' },
    ];

    for (const { pattern, country } of countryPatterns) {
      if (pattern.test(location)) {
        console.log(`🌍 Detected country "${country}" from location: "${location}"`);
        return country;
      }
    }
  }

  // 3. Fallback: Use account name patterns (for your specific accounts)
  const accountName = account.name || '';
  const nameFallbacks = [
    { pattern: /Thorsten.*Linz/i, country: 'Germany' },
    { pattern: /Martin.*Schechtner/i, country: 'Austria' },
    { pattern: /Peter.*Noble/i, country: 'Australia' },
    { pattern: /Irish|Charissa/i, country: 'Philippines' },
  ];

  for (const { pattern, country } of nameFallbacks) {
    if (pattern.test(accountName)) {
      console.log(`👤 Detected country "${country}" from account name: "${accountName}"`);
      return country;
    }
  }

  // Default fallback
  console.log(`⚠️  Could not detect country for account: ${accountName}, defaulting to United States`);
  return 'United States';
}

// Helper function to make Unipile API calls
async function callUnipileAPI(endpoint: string, method: string = 'GET') {
  const unipileDsn = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  if (!unipileDsn || !unipileApiKey) {
    throw new Error('Unipile API credentials not configured');
  }

  const url = `https://${unipileDsn}/api/v1/${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json',
    }
  };

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// Account country mapping (for reference)
const LINKEDIN_ACCOUNT_COUNTRIES: Record<string, string> = {
  'Thorsten Linz': 'Germany',
  'Martin Schechtner': 'Austria',
  'Peter Noble': 'Australia',
  'Irish Charissa': 'Philippines'
};

export async function POST(req: NextRequest) {
  try {
    const { userId } = await verifyAuth(req);

    const { force_update = false } = await req.json();

    // Check if BrightData is configured
    if (!process.env.BRIGHT_DATA_CUSTOMER_ID || !process.env.BRIGHT_DATA_RESIDENTIAL_PASSWORD) {
      return NextResponse.json({
        error: 'BrightData not configured',
        details: 'Missing BRIGHT_DATA_CUSTOMER_ID or BRIGHT_DATA_RESIDENTIAL_PASSWORD environment variables',
        next_steps: [
          'Add BrightData credentials to environment variables',
          'Contact BrightData support to get customer ID and password',
          'Restart the application after adding credentials'
        ]
      }, { status: 400 });
    }

    // Get LinkedIn accounts from database
    console.log('🔍 Fetching LinkedIn accounts from database...');
    const { rows: dbAccounts } = await pool.query(`
      SELECT * FROM user_unipile_accounts
      WHERE user_id = $1
      AND platform = 'LINKEDIN'
      AND connection_status = 'active'
    `, [userId]);

    if (!dbAccounts || dbAccounts.length === 0) {
      return NextResponse.json({
        error: 'No active LinkedIn accounts found',
        details: 'Please connect LinkedIn accounts first'
      }, { status: 400 });
    }

    console.log(`📊 Found ${dbAccounts.length} active LinkedIn accounts in database`);

    // Fetch full account details from Unipile for each account
    const linkedinAccounts = [];
    for (const dbAccount of dbAccounts) {
      try {
        const accountData = await callUnipileAPI(`accounts/${dbAccount.unipile_account_id}`);
        linkedinAccounts.push({
          id: dbAccount.unipile_account_id,
          name: dbAccount.account_name,
          type: 'LINKEDIN',
          connection_params: accountData.connection_params,
          sources: accountData.sources
        });
      } catch (err) {
        console.error(`Failed to fetch Unipile data for ${dbAccount.unipile_account_id}:`, err);
        // Continue with partial data
        linkedinAccounts.push({
          id: dbAccount.unipile_account_id,
          name: dbAccount.account_name,
          type: 'LINKEDIN',
          connection_params: { im: {} },
          sources: [{ status: 'OK' }]
        });
      }
    }

    const autoIPService = new AutoIPAssignmentService();
    const results = [];

    // Process each LinkedIn account
    for (const account of linkedinAccounts) {
      try {
        const accountName = account.name;
        const detectedCountry = detectCountryFromLinkedInAccount(account);

        console.log(`🔄 Processing ${accountName}: Detected country = ${detectedCountry}`);
        console.log(`📍 Account location data:`, {
          location: account.connection_params?.im?.location,
          headline: account.connection_params?.im?.headline,
          name: accountName
        });

        // Generate optimal proxy configuration for this account's country
        const proxyConfig = await autoIPService.generateOptimalProxyConfig(
          null, // No user location detection needed
          detectedCountry // Use LinkedIn profile country
        );

        console.log(`Generated proxy config for ${accountName}:`, {
          country: proxyConfig.country,
          state: proxyConfig.state,
          confidence: proxyConfig.confidence
        });

        // Test proxy connectivity
        let connectivityTest = null;
        try {
          connectivityTest = await autoIPService.testProxyConnectivity(proxyConfig);
        } catch (testError) {
          console.warn(`Connectivity test failed for ${accountName}:`, testError);
        }

        // Store account-specific proxy configuration
        await pool.query(`
          INSERT INTO linkedin_proxy_assignments (
            user_id, linkedin_account_id, linkedin_account_name, detected_country,
            proxy_country, proxy_state, proxy_city, proxy_session_id, proxy_username,
            confidence_score, connectivity_status, connectivity_details,
            is_primary_account, account_features, last_updated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (user_id, linkedin_account_id)
          DO UPDATE SET
            linkedin_account_name = EXCLUDED.linkedin_account_name,
            detected_country = EXCLUDED.detected_country,
            proxy_country = EXCLUDED.proxy_country,
            proxy_state = EXCLUDED.proxy_state,
            proxy_city = EXCLUDED.proxy_city,
            proxy_session_id = EXCLUDED.proxy_session_id,
            proxy_username = EXCLUDED.proxy_username,
            confidence_score = EXCLUDED.confidence_score,
            connectivity_status = EXCLUDED.connectivity_status,
            connectivity_details = EXCLUDED.connectivity_details,
            is_primary_account = EXCLUDED.is_primary_account,
            account_features = EXCLUDED.account_features,
            last_updated = EXCLUDED.last_updated
        `, [
          userId,
          account.id,
          accountName,
          detectedCountry,
          proxyConfig.country,
          proxyConfig.state,
          proxyConfig.city,
          proxyConfig.sessionId,
          proxyConfig.username,
          proxyConfig.confidence,
          connectivityTest?.success ? 'active' : 'untested',
          JSON.stringify(connectivityTest),
          accountName === "Thorsten Linz", // Your main account
          JSON.stringify(account.connection_params?.im?.premiumFeatures || []),
          new Date().toISOString()
        ]);

        results.push({
          account: accountName,
          status: 'success',
          detected_country: detectedCountry,
          proxy_config: {
            country: proxyConfig.country,
            state: proxyConfig.state,
            city: proxyConfig.city,
            confidence: proxyConfig.confidence,
            session_id: proxyConfig.sessionId
          },
          connectivity: connectivityTest,
          features: account.connection_params?.im?.premiumFeatures || []
        });

      } catch (error: any) {
        console.error(`Failed to assign proxy for ${account.name}:`, error);
        results.push({
          account: account.name,
          status: 'error',
          error: error.message
        });
      }
    }

    // Summary statistics
    const summary = {
      total_accounts: linkedinAccounts.length,
      successful_assignments: results.filter(r => r.status === 'success').length,
      failed_assignments: results.filter(r => r.status === 'error').length,
      accounts_with_sales_navigator: results.filter(r =>
        r.features?.includes('sales_navigator')
      ).length,
      accounts_with_premium: results.filter(r =>
        r.features?.includes('premium')
      ).length
    };

    return NextResponse.json({
      message: 'LinkedIn proxy IP assignment completed',
      summary,
      assignments: results,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('LinkedIn proxy assignment error:', error);
    return NextResponse.json(
      { error: 'Failed to assign proxy IPs', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await verifyAuth(req);

    const body = await req.json();
    const { linkedin_account_id, country, state, city } = body || {};

    if (!linkedin_account_id || !country) {
      return NextResponse.json({ error: 'linkedin_account_id and country are required' }, { status: 400 });
    }

    if (!process.env.BRIGHT_DATA_CUSTOMER_ID || !process.env.BRIGHT_DATA_RESIDENTIAL_PASSWORD) {
      return NextResponse.json({
        error: 'BrightData not configured',
        details: 'Missing BRIGHT_DATA_CUSTOMER_ID or BRIGHT_DATA_RESIDENTIAL_PASSWORD environment variables'
      }, { status: 400 });
    }

    const normalizedCountry = String(country).toLowerCase();
    const normalizedState = state ? String(state).toLowerCase() : null;
    const normalizedCity = city ? String(city) : null;

    const { rows: existingRows } = await pool.query(`
      SELECT * FROM linkedin_proxy_assignments
      WHERE user_id = $1 AND linkedin_account_id = $2
    `, [userId, linkedin_account_id]);

    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json({ error: 'Proxy assignment not found for this account' }, { status: 404 });
    }

    const existingAssignment = existingRows[0];

    const sessionId = `manual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    let username = `brd-customer-${process.env.BRIGHT_DATA_CUSTOMER_ID}-zone-residential-country-${normalizedCountry}`;

    if (normalizedState) {
      username += `-state-${normalizedState}`;
    }
    if (normalizedCity) {
      username += `-city-${normalizedCity}`;
    }

    username += `-session-${sessionId}`;

    const proxyConfig = {
      host: 'brd.superproxy.io',
      port: 22225,
      username,
      password: process.env.BRIGHT_DATA_RESIDENTIAL_PASSWORD!,
      country: normalizedCountry,
      state: normalizedState,
      city: normalizedCity,
      sessionId,
      confidence: 1.0
    };

    const autoIPService = new AutoIPAssignmentService();
    let connectivityTest = null;
    let connectivityStatus: 'active' | 'failed' | 'untested' = 'untested';
    try {
      connectivityTest = await autoIPService.testProxyConnectivity(proxyConfig);
      connectivityStatus = connectivityTest.success ? 'active' : 'failed';
    } catch (testError) {
      console.warn('Connectivity test failed during manual override:', testError);
    }

    const { rows: updatedRows } = await pool.query(`
      UPDATE linkedin_proxy_assignments SET
        proxy_country = $1,
        proxy_state = $2,
        proxy_city = $3,
        proxy_session_id = $4,
        proxy_username = $5,
        confidence_score = $6,
        connectivity_status = $7,
        connectivity_details = $8,
        last_updated = $9
      WHERE user_id = $10 AND linkedin_account_id = $11
      RETURNING *
    `, [
      normalizedCountry,
      normalizedState,
      normalizedCity,
      sessionId,
      username,
      1.0,
      connectivityStatus,
      JSON.stringify(connectivityTest),
      new Date().toISOString(),
      userId,
      linkedin_account_id
    ]);

    const updatedAssignment = updatedRows[0];

    const shouldSyncUserPreference = existingAssignment?.is_primary_account;

    if (shouldSyncUserPreference) {
      await pool.query(`
        INSERT INTO user_proxy_preferences (
          user_id, preferred_country, preferred_state, preferred_city,
          confidence_score, session_id, is_manual_selection, is_linkedin_based, last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id) DO UPDATE SET
          preferred_country = EXCLUDED.preferred_country,
          preferred_state = EXCLUDED.preferred_state,
          preferred_city = EXCLUDED.preferred_city,
          confidence_score = EXCLUDED.confidence_score,
          session_id = EXCLUDED.session_id,
          is_manual_selection = EXCLUDED.is_manual_selection,
          is_linkedin_based = EXCLUDED.is_linkedin_based,
          last_updated = EXCLUDED.last_updated
      `, [
        userId,
        normalizedCountry,
        normalizedState,
        normalizedCity,
        1.0,
        sessionId,
        true,
        true,
        new Date().toISOString()
      ]);
    } else {
      const { rows: existingPref } = await pool.query(`
        SELECT id FROM user_proxy_preferences WHERE user_id = $1
      `, [userId]);

      if (!existingPref || existingPref.length === 0) {
        await pool.query(`
          INSERT INTO user_proxy_preferences (
            user_id, preferred_country, preferred_state, preferred_city,
            confidence_score, session_id, is_manual_selection, is_linkedin_based, last_updated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          userId,
          normalizedCountry,
          normalizedState,
          normalizedCity,
          1.0,
          sessionId,
          true,
          false,
          new Date().toISOString()
        ]);
      }
    }

    return NextResponse.json({
      success: true,
      assignment: updatedAssignment,
      proxyConfig,
      connectivityTest
    });

  } catch (error: any) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Failed to override LinkedIn proxy assignment:', error);
    return NextResponse.json(
      { error: 'Failed to override LinkedIn proxy assignment', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await verifyAuth(req);

    // Get current proxy assignments for user's LinkedIn accounts
    const { rows: assignments } = await pool.query(`
      SELECT * FROM linkedin_proxy_assignments
      WHERE user_id = $1
      ORDER BY last_updated DESC
    `, [userId]);

    // Get current LinkedIn accounts via Unipile for comparison
    const data = await callUnipileAPI('accounts');
    const accounts = Array.isArray(data) ? data : (data.items || data.accounts || []);
    const linkedinAccounts = accounts.filter((account: any) =>
      account.type === 'LINKEDIN' &&
      account.sources?.[0]?.status === 'OK'
    );

    const currentAccountNames = linkedinAccounts.map((account: any) => account.name);
    const assignedAccountNames = assignments?.map(a => a.linkedin_account_name) || [];

    const unassignedAccounts = currentAccountNames.filter((name: string) =>
      !assignedAccountNames.includes(name)
    );

    return NextResponse.json({
      current_assignments: assignments || [],
      unassigned_accounts: unassignedAccounts,
      brightdata_configured: !!(process.env.BRIGHT_DATA_CUSTOMER_ID && process.env.BRIGHT_DATA_RESIDENTIAL_PASSWORD),
      account_mapping: LINKEDIN_ACCOUNT_COUNTRIES,
      summary: {
        total_linkedin_accounts: currentAccountNames.length,
        assigned_accounts: assignedAccountNames.length,
        unassigned_accounts: unassignedAccounts.length
      }
    });

  } catch (error: any) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Failed to get proxy assignments:', error);
    return NextResponse.json(
      { error: 'Failed to get proxy assignments', details: error.message },
      { status: 500 }
    );
  }
}
