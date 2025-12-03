import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// Helper to normalize LinkedIn URL to hash (vanity name only)
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  if (match) return match[1].toLowerCase().trim();
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
}

/**
 * Quick Add Single Prospect API
 * Just paste LinkedIn URL - system handles everything automatically
 * DATABASE-FIRST: Upserts to workspace_prospects first
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Quick Add API called');

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get authenticated user (using getUser instead of getSession for security)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      authError: authError?.message
    });

    if (authError || !user) {
      console.error('❌ Auth error:', authError);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { linkedin_url, workspace_id, campaign_name } = await request.json();

    console.log('Request data:', { linkedin_url, workspace_id, campaign_name, userId: user.id });

    if (!linkedin_url) {
      return NextResponse.json({ error: 'LinkedIn URL required' }, { status: 400 });
    }

    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    console.log('🚀 Quick Add Prospect:', linkedin_url);

    // Step 1: Extract LinkedIn username from URL
    const username = extractLinkedInUsername(linkedin_url);
    if (!username) {
      return NextResponse.json({
        error: 'Invalid LinkedIn URL. Expected format: https://linkedin.com/in/username'
      }, { status: 400 });
    }

    console.log('📝 Extracted username:', username);

    // Step 2: Check if it's a 1st degree connection (has chat ID)
    let linkedinUserId = null;
    let connectionDegree = '2nd/3rd'; // Default assumption
    let fullName = 'LinkedIn User';

    try {
      // Try to find this person in Unipile connections (with 5 second timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const unipileResponse = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/users/${username}?account_id=${process.env.UNIPILE_ACCOUNT_ID}`, {
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY || ''
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (unipileResponse.ok) {
        const unipileData = await unipileResponse.json();

        // If we got profile data, they might be a connection
        if (unipileData.provider_id) {
          linkedinUserId = unipileData.provider_id;
          connectionDegree = '1st'; // They're in our connections
          fullName = unipileData.display_name || unipileData.name || 'LinkedIn User';
          console.log('✅ Found 1st degree connection:', linkedinUserId);
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not check Unipile connection, treating as 2nd/3rd degree');
      // Continue - we'll treat as 2nd/3rd degree connection
    }

    // Step 3: DATABASE-FIRST - Upsert to workspace_prospects master table
    const linkedinHash = normalizeLinkedInUrl(linkedin_url);

    const { data: masterProspect, error: masterError } = await supabase
      .from('workspace_prospects')
      .upsert({
        workspace_id: workspace_id,
        linkedin_url: linkedin_url,
        linkedin_url_hash: linkedinHash,
        first_name: fullName.split(' ')[0] || 'Unknown',
        last_name: fullName.split(' ').slice(1).join(' ') || '',
        linkedin_provider_id: linkedinUserId,
        connection_status: connectionDegree === '1st' ? 'connected' : 'not_connected',
        source: 'quick_add',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,linkedin_url_hash',
        ignoreDuplicates: false
      })
      .select('id')
      .single();

    if (masterError) {
      console.error('Master prospect upsert error:', masterError);
      throw new Error('Failed to save to master prospect table');
    }

    console.log('✅ Upserted to workspace_prospects:', masterProspect.id);

    // Step 4: Create approval session
    const sessionId = `quick_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { error: sessionError } = await supabase
      .from('prospect_approval_sessions')
      .insert({
        id: sessionId,
        workspace_id: workspace_id,
        campaign_name: campaign_name || `Quick Add - ${new Date().toLocaleDateString()}`,
        status: 'pending',
        total_count: 1,
        approved_count: 0,
        created_by: user.id
      });

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      throw new Error('Failed to create approval session');
    }

    // Step 5: Save prospect to approval database with master_prospect_id reference
    const prospectData = {
      session_id: sessionId,
      workspace_id: workspace_id,
      master_prospect_id: masterProspect.id,  // FK to workspace_prospects
      contact: {
        name: fullName,
        linkedin_url: linkedin_url,
        linkedin_user_id: linkedinUserId,
        connection_degree: connectionDegree
      },
      source: 'quick_add',
      confidence_score: 0.8,
      status: 'pending'
    };

    const { error: insertError } = await supabase
      .from('prospect_approval_data')
      .insert(prospectData);

    if (insertError) {
      console.error('Prospect insert error:', insertError);
      throw new Error('Failed to save prospect');
    }

    console.log('✅ Prospect saved to database');

    // Step 5: Return success with prospect data
    return NextResponse.json({
      success: true,
      message: connectionDegree === '1st'
        ? '✅ Added as 1st degree connection (Messenger campaign ready)'
        : '✅ Added as 2nd/3rd degree (Connector campaign ready)',
      campaign_type_suggestion: connectionDegree === '1st' ? 'messenger' : 'connector',
      session_id: sessionId,
      prospect: {
        name: fullName,
        linkedin_url: linkedin_url,
        linkedin_user_id: linkedinUserId,
        connection_degree: connectionDegree,
        source: 'quick_add'
      }
    });

  } catch (error) {
    console.error('Quick add prospect error:', error);
    return NextResponse.json({
      error: 'Failed to add prospect',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Extract LinkedIn username from various URL formats
 */
function extractLinkedInUsername(url: string): string | null {
  try {
    // Handle various LinkedIn URL formats
    const patterns = [
      /linkedin\.com\/in\/([^\/\?]+)/i,           // https://linkedin.com/in/username
      /linkedin\.com\/profile\/view\?id=([^&]+)/i // Old format
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}
