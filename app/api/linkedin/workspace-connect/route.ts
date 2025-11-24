import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

// Simplified LinkedIn-Workspace Connection API
// This addresses the connection failures by simplifying the process

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    
    // Get current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      workspace_id, 
      linkedin_email, 
      linkedin_password, 
      account_name,
      connection_type = 'new' // 'new' or 'existing'
    } = body;

    if (!workspace_id || !linkedin_email) {
      return NextResponse.json({ 
        error: 'Missing required fields: workspace_id, linkedin_email' 
      }, { status: 400 });
    }

    console.log(`🔗 LinkedIn workspace connection: ${linkedin_email} → Workspace ${workspace_id}`);

    // Step 1: Verify workspace access
    const { data: workspaceAccess, error: accessError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', session.user.id)
      .single();

    if (accessError || !workspaceAccess) {
      return NextResponse.json({ 
        error: 'Access denied to workspace' 
      }, { status: 403 });
    }

    // Step 2: Check for existing LinkedIn connection in this workspace
    const { data: existingConnection, error: existingError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('account_type', 'linkedin')
      .eq('account_identifier', linkedin_email)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing connection:', existingError);
    }

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
    const accountData = {
      workspace_id,
      user_id: session.user.id,
      account_type: 'linkedin',
      account_identifier: linkedin_email,
      account_name: account_name || linkedin_email,
      unipile_account_id: unipileAccountId,
      connection_status: 'connected',
      connected_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      account_metadata: {
        email: linkedin_email,
        connected_by: session.user.email,
        connection_method: 'workspace_direct'
      }
    };

    let workspaceAccount;
    if (existingConnection && connection_type === 'existing') {
      // Update existing connection
      const { data, error } = await supabase
        .from('workspace_accounts')
        .update({
          ...accountData,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConnection.id)
        .select()
        .single();

      if (error) {
        console.error('Failed to update workspace account:', error);
        return NextResponse.json({ 
          error: 'Failed to update workspace connection' 
        }, { status: 500 });
      }
      workspaceAccount = data;
    } else {
      // Create new connection
      const { data, error } = await supabase
        .from('workspace_accounts')
        .insert(accountData)
        .select()
        .single();

      if (error) {
        console.error('Failed to create workspace account:', error);
        return NextResponse.json({ 
          error: 'Failed to create workspace connection' 
        }, { status: 500 });
      }
      workspaceAccount = data;
    }

    // Step 5: Verify connection works
    const connectionValid = await verifyLinkedInConnection(unipileAccountId);
    
    if (!connectionValid) {
      // Mark as needs attention but don't fail
      await supabase
        .from('workspace_accounts')
        .update({
          connection_status: 'needs_verification',
          updated_at: new Date().toISOString()
        })
        .eq('id', workspaceAccount.id);

      console.warn(`LinkedIn connection needs verification: ${unipileAccountId}`);
    }

    console.log(`✅ LinkedIn workspace connection successful: ${linkedin_email} → ${workspace_id}`);

    return NextResponse.json({
      success: true,
      workspace_account_id: workspaceAccount.id,
      unipile_account_id: unipileAccountId,
      connection_status: connectionValid ? 'connected' : 'needs_verification',
      account_details: {
        workspace_id,
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
    const supabase = await createSupabaseRouteClient();
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspace_id = searchParams.get('workspace_id');

    if (!workspace_id) {
      return NextResponse.json({ 
        error: 'workspace_id parameter required' 
      }, { status: 400 });
    }

    // Verify workspace access
    const { data: workspaceAccess, error: accessError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', session.user.id)
      .single();

    if (accessError || !workspaceAccess) {
      return NextResponse.json({ 
        error: 'Access denied to workspace' 
      }, { status: 403 });
    }

    // Get all LinkedIn connections for this workspace
    const { data: linkedinAccounts, error: accountsError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('account_type', 'linkedin')
      .order('connected_at', { ascending: false });

    if (accountsError) {
      console.error('Error fetching LinkedIn accounts:', accountsError);
      return NextResponse.json({ 
        error: 'Failed to fetch LinkedIn accounts' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      workspace_id,
      linkedin_accounts: linkedinAccounts || [],
      total_accounts: linkedinAccounts?.length || 0,
      connected_accounts: linkedinAccounts?.filter(acc => acc.connection_status === 'connected').length || 0,
      needs_verification: linkedinAccounts?.filter(acc => acc.connection_status === 'needs_verification').length || 0
    });

  } catch (error) {
    console.error('Error fetching workspace LinkedIn accounts:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}