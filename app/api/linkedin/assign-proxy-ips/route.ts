import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
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

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies });
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Get LinkedIn accounts via Unipile API
    console.log('🔍 Fetching LinkedIn accounts from Unipile...');
    const data = await callUnipileAPI('accounts');
    const accounts = Array.isArray(data) ? data : (data.items || data.accounts || []);
    
    const linkedinAccounts = accounts.filter((account: any) => 
      account.type === 'LINKEDIN' && 
      account.sources?.[0]?.status === 'OK'
    );

    if (linkedinAccounts.length === 0) {
      return NextResponse.json({ 
        error: 'No active LinkedIn accounts found',
        details: 'Please connect LinkedIn accounts first' 
      }, { status: 400 });
    }

    console.log(`📊 Found ${linkedinAccounts.length} active LinkedIn accounts`);

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
        const { error: insertError } = await supabase
          .from('linkedin_proxy_assignments')
          .upsert({
            user_id: user.id,
            linkedin_account_id: account.id,
            linkedin_account_name: accountName,
            detected_country: detectedCountry,
            proxy_country: proxyConfig.country,
            proxy_state: proxyConfig.state,
            proxy_city: proxyConfig.city,
            proxy_session_id: proxyConfig.sessionId,
            proxy_username: proxyConfig.username,
            confidence_score: proxyConfig.confidence,
            connectivity_status: connectivityTest?.success ? 'active' : 'untested',
            connectivity_details: connectivityTest,
            is_primary_account: accountName === "Thorsten Linz", // Your main account
            account_features: account.connection_params?.im?.premiumFeatures || [],
            last_updated: new Date().toISOString()
          });

        if (insertError) {
          console.error(`Failed to store proxy config for ${accountName}:`, insertError);
          results.push({
            account: accountName,
            status: 'error',
            error: insertError.message
          });
          continue;
        }

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
    console.error('LinkedIn proxy assignment error:', error);
    return NextResponse.json(
      { error: 'Failed to assign proxy IPs', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const { data: existingAssignment, error: fetchError } = await supabase
      .from('linkedin_proxy_assignments')
      .select('*')
      .eq('user_id', user.id)
      .eq('linkedin_account_id', linkedin_account_id)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Failed to fetch assignment before update:', fetchError);
      return NextResponse.json({ error: 'Failed to load proxy assignment' }, { status: 500 });
    }

    if (!existingAssignment) {
      return NextResponse.json({ error: 'Proxy assignment not found for this account' }, { status: 404 });
    }

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

    const { data: updatedAssignment, error: updateError } = await supabase
      .from('linkedin_proxy_assignments')
      .update({
        proxy_country: normalizedCountry,
        proxy_state: normalizedState,
        proxy_city: normalizedCity,
        proxy_session_id: sessionId,
        proxy_username: username,
        confidence_score: 1.0,
        connectivity_status: connectivityStatus,
        connectivity_details: connectivityTest,
        is_primary_account: existingAssignment.is_primary_account,
        last_updated: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('linkedin_account_id', linkedin_account_id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update LinkedIn proxy assignment:', updateError);
      return NextResponse.json({ error: 'Failed to update LinkedIn proxy assignment' }, { status: 500 });
    }

    const shouldSyncUserPreference = existingAssignment?.is_primary_account;

    if (shouldSyncUserPreference) {
      const { error: prefError } = await supabase
        .from('user_proxy_preferences')
        .upsert({
          user_id: user.id,
          preferred_country: normalizedCountry,
          preferred_state: normalizedState,
          preferred_city: normalizedCity,
          confidence_score: 1.0,
          session_id: sessionId,
          is_manual_selection: true,
          is_linkedin_based: true,
          last_updated: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (prefError) {
        console.error('Failed to align user proxy preference with manual override:', prefError);
      }
    } else {
      const { data: existingPreference, error: prefFetchError } = await supabase
        .from('user_proxy_preferences')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!prefFetchError && !existingPreference) {
        const { error: createPrefError } = await supabase
          .from('user_proxy_preferences')
          .insert({
            user_id: user.id,
            preferred_country: normalizedCountry,
            preferred_state: normalizedState,
            preferred_city: normalizedCity,
            confidence_score: 1.0,
            session_id: sessionId,
            is_manual_selection: true,
            is_linkedin_based: false,
            last_updated: new Date().toISOString()
          });

        if (createPrefError) {
          console.error('Failed to create user proxy preference after manual override:', createPrefError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      assignment: updatedAssignment,
      proxyConfig,
      connectivityTest
    });

  } catch (error: any) {
    console.error('Failed to override LinkedIn proxy assignment:', error);
    return NextResponse.json(
      { error: 'Failed to override LinkedIn proxy assignment', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies });
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current proxy assignments for user's LinkedIn accounts
    const { data: assignments, error } = await supabase
      .from('linkedin_proxy_assignments')
      .select('*')
      .eq('user_id', user.id)
      .order('last_updated', { ascending: false });

    if (error) {
      console.error('Failed to fetch proxy assignments:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch proxy assignments' 
      }, { status: 500 });
    }

    // Get current LinkedIn accounts via Unipile for comparison
    const data = await callUnipileAPI('accounts');
    const accounts = Array.isArray(data) ? data : (data.items || data.accounts || []);
    const linkedinAccounts = accounts.filter((account: any) => 
      account.type === 'LINKEDIN' && 
      account.sources?.[0]?.status === 'OK'
    );

    const currentAccountNames = linkedinAccounts.map((account: any) => account.name);
    const assignedAccountNames = assignments?.map(a => a.linkedin_account_name) || [];
    
    const unassignedAccounts = currentAccountNames.filter(name => 
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
    console.error('Failed to get proxy assignments:', error);
    return NextResponse.json(
      { error: 'Failed to get proxy assignments', details: error.message },
      { status: 500 }
    );
  }
}
