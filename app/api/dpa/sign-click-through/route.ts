import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

/**
 * POST /api/dpa/sign-click-through
 *
 * Click-through signature for Data Processing Agreement
 * For self-service and SME tiers only (enterprise gets custom agreements)
 *
 * Legally valid under:
 * - EU eIDAS Regulation (simple electronic signatures)
 * - US E-SIGN Act
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const {
      workspaceId,
      signerName,
      signerTitle,
      consentText,
      scrolledToBottom
    } = body;

    // 3. Validate required fields
    if (!workspaceId || !signerName || !signerTitle || !consentText) {
      return NextResponse.json(
        { error: 'Missing required fields: workspaceId, signerName, signerTitle, consentText' },
        { status: 400 }
      );
    }

    // 4. Verify workspace access (must be owner or admin)
    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Forbidden - only workspace owners/admins can sign DPA' },
        { status: 403 }
      );
    }

    // 5. Get current DPA version
    const { data: currentDpa, error: dpaError } = await supabase
      .from('dpa_versions')
      .select('version, content')
      .eq('is_current', true)
      .single();

    if (dpaError || !currentDpa) {
      return NextResponse.json(
        { error: 'No current DPA version found' },
        { status: 500 }
      );
    }

    // 6. Capture signature metadata
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 7. Create DPA agreement record
    const { data: agreement, error: agreementError } = await supabase
      .from('workspace_dpa_agreements')
      .insert({
        workspace_id: workspaceId,
        dpa_version: currentDpa.version,
        status: 'signed',
        signed_at: new Date().toISOString(),
        signed_by: user.id,
        signed_by_name: signerName,
        signed_by_title: signerTitle,
        signed_by_email: user.email,
        signature_method: 'click_through',
        ip_address: ipAddress,
        user_agent: userAgent,
        consent_text: consentText,
        scroll_completion: scrolledToBottom
      })
      .select()
      .single();

    if (agreementError) {
      console.error('Failed to create DPA agreement:', agreementError);

      // Check if already signed
      if (agreementError.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'DPA already signed for this workspace' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create DPA agreement' },
        { status: 500 }
      );
    }

    // 8. Update workspace DPA requirements (remove grace period, unblock service)
    const { error: requirementError } = await supabase
      .from('workspace_dpa_requirements')
      .update({
        grace_period_active: false,
        service_blocked: false,
        blocked_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('workspace_id', workspaceId);

    if (requirementError) {
      console.warn('Failed to update DPA requirements:', requirementError);
      // Don't fail the request - DPA is still signed
    }

    // 9. Generate signed PDF (will be done asynchronously)
    // Trigger background job to generate PDF with signature certificate
    await fetch(`${request.nextUrl.origin}/api/dpa/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || ''
      },
      body: JSON.stringify({
        agreementId: agreement.id,
        workspaceId,
        dpaVersion: currentDpa.version,
        dpaContent: currentDpa.content,
        signatureData: {
          signerName,
          signerTitle,
          signerEmail: user.email,
          signedAt: agreement.signed_at,
          ipAddress,
          userAgent,
          consentText
        }
      })
    }).catch(error => {
      console.error('Failed to trigger PDF generation:', error);
      // Don't fail the request - PDF can be generated later
    });

    return NextResponse.json({
      success: true,
      agreementId: agreement.id,
      dpaVersion: currentDpa.version,
      signedAt: agreement.signed_at,
      message: 'DPA signed successfully'
    });

  } catch (error) {
    console.error('DPA signature error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dpa/sign-click-through?workspaceId={id}
 *
 * Check if workspace has signed DPA
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspaceId from query params
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing workspaceId parameter' },
        { status: 400 }
      );
    }

    // Verify workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: 'Forbidden - not a workspace member' },
        { status: 403 }
      );
    }

    // Get DPA status using stored function
    const { data: dpaStatus, error: statusError } = await supabase
      .rpc('get_workspace_dpa_status', { p_workspace_id: workspaceId });

    if (statusError) {
      console.error('Failed to get DPA status:', statusError);
      return NextResponse.json(
        { error: 'Failed to retrieve DPA status' },
        { status: 500 }
      );
    }

    // Get signed agreement details if exists
    const { data: agreement } = await supabase
      .from('workspace_dpa_agreements')
      .select('id, dpa_version, signed_at, signed_by_name, signed_dpa_pdf_url')
      .eq('workspace_id', workspaceId)
      .eq('status', 'signed')
      .order('signed_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      requiresDpa: dpaStatus?.[0]?.requires_dpa || false,
      hasSignedDpa: dpaStatus?.[0]?.has_signed_dpa || false,
      dpaVersion: dpaStatus?.[0]?.dpa_version,
      daysRemaining: dpaStatus?.[0]?.days_remaining,
      isBlocked: dpaStatus?.[0]?.is_blocked || false,
      agreement: agreement || null
    });

  } catch (error) {
    console.error('DPA status check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
