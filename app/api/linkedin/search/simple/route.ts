import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * SIMPLE LinkedIn Search - Minimal version that just works
 * No fancy features, just get results
 * Force rebuild: 2025-10-10-v2
 */
export async function POST(request: NextRequest) {
  console.log('🔵 SIMPLE SEARCH START');
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('🔵 Auth check:', { hasUser: !!user, userId: user?.id, authError: authError?.message });

    if (!user) {
      console.log('❌ No user - returning 401');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log(`✅ User authenticated: ${user.email}`);

    const { search_criteria, target_count = 50 } = await request.json();

    // Get workspace (with fallback)
    let workspaceId: string | null = null;

    console.log('🔵 Querying users table for workspace...');
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    console.log('🔵 Users table result:', {
      hasProfile: !!userProfile,
      workspaceId: userProfile?.current_workspace_id,
      error: profileError?.message
    });

    if (userProfile?.current_workspace_id) {
      workspaceId = userProfile.current_workspace_id;
      console.log('✅ Got workspace from users table:', workspaceId);
    } else {
      console.log('⚠️ No workspace in users table, trying fallback...');
      // Fallback: get first workspace
      const { data: membership, error: membershipError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      console.log('🔵 Workspace_members result:', {
        hasMembership: !!membership,
        workspaceId: membership?.workspace_id,
        error: membershipError?.message
      });

      if (membership?.workspace_id) {
        workspaceId = membership.workspace_id;
        console.log('✅ Got workspace from memberships:', workspaceId);
        // Update for next time
        await supabase
          .from('users')
          .update({ current_workspace_id: membership.workspace_id })
          .eq('id', user.id);
        console.log('💾 Updated users table');
      }
    }

    if (!workspaceId) {
      console.log('❌ NO WORKSPACE FOUND');
      return NextResponse.json({
        error: 'No workspace',
        debug: { userId: user.id, checked: 'users + workspace_members' }
      }, { status: 400 });
    }

    console.log('✅ Final workspace:', workspaceId);

    // Get LinkedIn account
    const { data: linkedinAccount } = await supabase
      .from('user_unipile_accounts')
      .select('unipile_account_id')
      .eq('user_id', user.id)
      .eq('platform', 'LINKEDIN')
      .single();

    if (!linkedinAccount) {
      return NextResponse.json({ error: 'LinkedIn not connected' }, { status: 400 });
    }

    // Call Unipile - format payload correctly
    // UNIPILE_DSN can be either "api6" or "api6.unipile.com:13443" (full domain)
    const unipileDSN = process.env.UNIPILE_DSN!;
    const unipileUrl = unipileDSN.includes('.')
      ? `https://${unipileDSN}/api/v1/linkedin/search`  // Full domain already provided
      : `https://${unipileDSN}.unipile.com:13443/api/v1/linkedin/search`;  // Just subdomain

    const params = new URLSearchParams({
      account_id: linkedinAccount.unipile_account_id,
      limit: String(Math.min(target_count, 50))
    });

    // Build proper Unipile payload
    const unipilePayload: any = {
      api: 'classic',
      category: 'people' // Default to people search
    };

    // Combine title + keywords into single keywords field
    const keywordParts = [];
    if (search_criteria.title) keywordParts.push(search_criteria.title);
    if (search_criteria.keywords) keywordParts.push(search_criteria.keywords);
    if (keywordParts.length > 0) {
      unipilePayload.keywords = keywordParts.join(' ');
    }

    console.log('🔵 Unipile payload:', JSON.stringify(unipilePayload));

    const response = await fetch(`${unipileUrl}?${params}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(unipilePayload)
    });

    const data = await response.json();
    console.log('🔵 Unipile response:', JSON.stringify(data).substring(0, 500));

    const prospects = (data.items || []).map((item: any) => {
      // Handle name - Classic gives full name, Sales Nav gives first/last
      let firstName = item.first_name || 'Unknown';
      let lastName = item.last_name || 'Unknown';

      if (!item.first_name && item.name) {
        // Classic API - split full name
        const nameParts = item.name.trim().split(' ');
        firstName = nameParts[0] || 'Unknown';
        lastName = nameParts.slice(1).join(' ') || 'Unknown';
      }

      // Handle title - Classic uses "headline", Sales Nav uses "current_positions"
      let title = item.headline || '';
      if (item.current_positions && item.current_positions.length > 0) {
        title = item.current_positions[0].role || item.headline || '';
      }

      // Handle company - only in Sales Nav current_positions
      let company = '';
      if (item.current_positions && item.current_positions.length > 0) {
        company = item.current_positions[0].company || '';
      }

      // LinkedIn URL - both APIs use profile_url
      const linkedinUrl = item.profile_url || item.public_profile_url || '';

      return {
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        title,
        company,
        linkedinUrl
      };
    });

    console.log(`🔵 Mapped ${prospects.length} prospects`);

    // Save to workspace_prospects with correct column names
    // Filter out prospects without LinkedIn URLs (required field)
    const validProspects = prospects.filter((p: any) => p.linkedinUrl);
    console.log(`🔵 Valid prospects with LinkedIn URLs: ${validProspects.length}/${prospects.length}`);

    if (validProspects.length > 0) {
      const toInsert = validProspects.map((p: any) => ({
        workspace_id: workspaceId,
        first_name: p.firstName,
        last_name: p.lastName,
        job_title: p.title || null,
        company_name: p.company || null,
        linkedin_profile_url: p.linkedinUrl
      }));

      console.log('🔵 Inserting to database:', JSON.stringify(toInsert[0]));
      const { data: inserted, error: insertError } = await supabase
        .from('workspace_prospects')
        .insert(toInsert)
        .select();

      if (insertError) {
        console.error('❌ Insert error:', insertError);
      } else {
        console.log(`✅ Inserted ${inserted?.length || 0} prospects`);
      }
    }

    return NextResponse.json({
      success: true,
      prospects: validProspects,
      count: validProspects.length,
      total_found: prospects.length
    });

  } catch (error) {
    console.error('Simple search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    }, { status: 500 });
  }
}
