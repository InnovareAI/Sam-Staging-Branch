import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { normalizeCompanyName } from '@/lib/enrich-prospect-name';

// GET - Check endpoint status
export async function GET() {
  return NextResponse.json({
    success: true,
    endpoint: '/api/prospect-approval/upload-prospects',
    methods: ['POST'],
    description: 'Upload prospects for approval',
    required_fields: {
      prospects: 'Array of prospect objects',
      workspace_id: 'UUID of the workspace (optional if authenticated)',
      campaign_name: 'Name of the campaign (optional)',
      campaign_tag: 'Tag for the campaign (optional)',
      source: 'Source of prospects (optional)'
    },
    prospect_format: {
      name: 'Full name (or use first_name + last_name)',
      first_name: 'First name',
      last_name: 'Last name',
      email: 'Email address',
      company: 'Company name or { name: "..." }',
      title: 'Job title',
      linkedin_url: 'LinkedIn profile URL',
      location: 'Location',
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    let { campaign_name, campaign_tag, source, prospects, workspace_id } = body;

    console.log('📥 Upload request:', {
      campaign_name,
      prospect_count: prospects?.length,
      workspace_id,
      has_auth: !!request.headers.get('cookie')
    });

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({ success: false, error: 'No prospects provided' }, { status: 400 });
    }

    // Get authenticated user and validate workspace access
    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    );

    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Try to get workspace_id from request or user's current workspace
    if (!workspace_id) {
      const { data: userData } = await supabase
        .from('users')
        .select('current_workspace_id')
        .eq('id', user.id)
        .single();

      workspace_id = userData?.current_workspace_id;
      console.log('✅ Got workspace from authenticated user:', workspace_id);
    }

    if (!workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No workspace selected. Please select your workspace.'
      }, { status: 400 });
    }

    // Verify user has access to this workspace
    const { data: memberCheck, error: memberError } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (memberError || !memberCheck) {
      console.error('Paste Upload - User not authorized for workspace:', {
        userId: user.id,
        workspaceId: workspace_id,
        error: memberError?.message
      });
      return NextResponse.json({
        success: false,
        error: 'You do not have access to this workspace'
      }, { status: 403 });
    }

    console.log('Paste Upload - Workspace access verified:', {
      userId: user.id,
      workspaceId: workspace_id,
      role: memberCheck.role
    });

    // Get workspace to verify it exists
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', workspace_id)
      .single();

    if (wsError || !workspace) {
      console.error('Workspace not found:', wsError);
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    // Use the authenticated user's ID for the session
    const userId = user.id;

    // Create approval session
    const { data: session, error: sessionError } = await supabase
      .from('prospect_approval_sessions')
      .insert({
        workspace_id: workspace_id,
        user_id: userId,
        campaign_name: campaign_name || 'Uploaded Prospects',
        campaign_tag: campaign_tag || 'manual-upload',
        prospect_source: source || 'manual-upload',
        total_prospects: prospects.length,
        pending_count: prospects.length,
        approved_count: 0,
        rejected_count: 0,
        status: 'active',
        batch_number: 1,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json({ success: false, error: sessionError.message }, { status: 500 });
    }

    // CHECK FOR DUPLICATES: One LinkedIn URL can only exist in ONE campaign
    const linkedinUrls = prospects
      .map((p: any) => p.linkedin_url || p.contact?.linkedin_url)
      .filter(Boolean);

    if (linkedinUrls.length > 0) {
      const { data: existingProspects } = await supabase
        .from('campaign_prospects')
        .select('linkedin_url, campaign_id, campaigns(campaign_name)')
        .in('linkedin_url', linkedinUrls);

      if (existingProspects && existingProspects.length > 0) {
        const duplicates = existingProspects.map((ep: any) => ({
          linkedin_url: ep.linkedin_url,
          existing_campaign: ep.campaigns?.campaign_name || 'Unknown campaign'
        }));

        // Rollback session
        await supabase.from('prospect_approval_sessions').delete().eq('id', session.id);

        return NextResponse.json({
          success: false,
          error: `${duplicates.length} prospect(s) already exist in other campaigns`,
          duplicates: duplicates,
          message: 'Each prospect can only be in one campaign. Remove duplicates and try again.'
        }, { status: 400 });
      }
    }

    // Helper function to clean LinkedIn URLs
    const cleanLinkedInUrl = (url: string): string => {
      if (!url) return '';
      try {
        // Extract just the username from the URL
        const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
        if (match) {
          const username = match[1];
          return `https://www.linkedin.com/in/${username}`;
        }
        return url;
      } catch (error) {
        console.error('Error cleaning LinkedIn URL:', url, error);
        return url;
      }
    };

    // Save prospects to approval data table
    const approvalData = prospects.map((p: any, index: number) => {
      // Ensure unique prospect_id
      const prospectId = p.prospect_id || p.id || `upload_${session.id}_${index}_${Date.now()}`;

      // Get name from various possible fields
      const name = p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown';

      // Clean LinkedIn URL: Remove miniProfileUrn and other query parameters
      let linkedinUrl = p.linkedin_url || p.contact?.linkedin_url || '';
      if (linkedinUrl) {
        linkedinUrl = cleanLinkedInUrl(linkedinUrl);
      }

      // Ensure contact is an object with required fields
      const contact = {
        email: p.email || p.contact?.email || '',
        linkedin_url: linkedinUrl, // CLEANED: Vanity URL only, no miniProfileUrn or query parameters
        first_name: p.first_name || p.contact?.first_name || name.split(' ')[0] || '',
        last_name: p.last_name || p.contact?.last_name || name.split(' ').slice(1).join(' ') || ''
      };

      // Ensure company is an object and normalize the name
      let companyName = typeof p.company === 'string'
        ? p.company
        : (p.company?.name || p.company_name || '');

      // Normalize company name to remove legal suffixes
      const cleanCompanyName = normalizeCompanyName(companyName);

      const company = {
        name: cleanCompanyName,
        industry: p.company?.industry || ''
      };

      return {
        session_id: session.id,
        prospect_id: prospectId,
        workspace_id: workspace_id,
        name: name,
        title: p.title || '',
        company: company,
        location: p.location || '',
        contact: contact,
        connection_degree: p.connectionDegree || p.connection_degree || null,  // CRITICAL: Preserve connectionDegree from SAM scrape (DB column is snake_case)
        source: p.source || source || 'manual-upload',
        enrichment_score: p.enrichment_score || 70,
        approval_status: 'pending',
        created_at: new Date().toISOString()
      };
    });

    console.log(`💾 Inserting ${approvalData.length} prospects into prospect_approval_data`);

    const { data: insertedData, error: dataError } = await supabase
      .from('prospect_approval_data')
      .insert(approvalData);

    if (dataError) {
      console.error('❌ Error saving prospects:', dataError);
      console.error('   Message:', dataError.message);
      console.error('   Details:', dataError.details);
      console.error('   Hint:', dataError.hint);

      // Rollback session
      await supabase.from('prospect_approval_sessions').delete().eq('id', session.id);

      return NextResponse.json({
        success: false,
        error: dataError.message,
        details: dataError.details,
        hint: dataError.hint
      }, { status: 500 });
    }

    // Verify prospects were inserted by checking count in database
    const { count: verifyCount } = await supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);

    const expectedCount = prospects.length;

    console.log('✅ Prospect upload verification:', {
      expected: expectedCount,
      verified: verifyCount,
      match: verifyCount === expectedCount,
      session_id: session.id
    });

    if (verifyCount !== expectedCount) {
      console.error(`❌ Insert count mismatch: expected ${expectedCount}, verified ${verifyCount}`);

      // Rollback session and any partial data
      await supabase.from('prospect_approval_data').delete().eq('session_id', session.id);
      await supabase.from('prospect_approval_sessions').delete().eq('id', session.id);

      return NextResponse.json({
        success: false,
        error: `Failed to insert all prospects: ${verifyCount}/${expectedCount} inserted`,
        details: 'This may be due to database constraints or permissions. Check server logs.'
      }, { status: 500 });
    }

    console.log(`✅ Successfully inserted ${verifyCount} prospects`);
    console.log(`📋 Session ID: ${session.id}`);

    return NextResponse.json({
      success: true,
      session_id: session.id,
      count: verifyCount,
      campaign_name: campaign_name,
      message: `Successfully uploaded ${verifyCount} prospects. Go to Prospect Approval to review.`
    });

  } catch (error) {
    console.error('Upload prospects error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
