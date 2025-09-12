import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPostmarkHelper } from '../../../../lib/postmark-helper';

// Super admin emails
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

export async function GET(request: NextRequest) {
  try {
    // Get auth header for admin verification
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Also create client with user context for verification
    const userSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the requesting user is authenticated and has admin rights
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is super admin
    if (!SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const company = url.searchParams.get('company') || 'InnovareAI';
    
    // Get Postmark helper for the specified company
    const postmarkHelper = createPostmarkHelper(company as 'InnovareAI' | '3cubedai');
    if (!postmarkHelper) {
      return NextResponse.json(
        { error: `Invalid company or missing API key: ${company}` },
        { status: 400 }
      );
    }

    // Get all suppressions
    const suppressions = await (postmarkHelper as any).client.getSuppressions('outbound');
    
    return NextResponse.json({
      success: true,
      company,
      suppressionCount: suppressions.Suppressions?.length || 0,
      suppressions: suppressions.Suppressions || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching email suppressions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch email suppressions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get auth header for admin verification
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Also create client with user context for verification
    const userSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the requesting user is authenticated and has admin rights
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is super admin
    if (!SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      );
    }

    const { action, email, company = 'InnovareAI' } = await request.json();

    if (!action || !email) {
      return NextResponse.json(
        { error: 'Action and email are required' },
        { status: 400 }
      );
    }

    // Get Postmark helper for the specified company
    const postmarkHelper = createPostmarkHelper(company as 'InnovareAI' | '3cubedai');
    if (!postmarkHelper) {
      return NextResponse.json(
        { error: `Invalid company or missing API key: ${company}` },
        { status: 400 }
      );
    }

    if (action === 'check') {
      // Check if specific email is suppressed
      const result = await postmarkHelper.checkEmailSuppression(email);
      
      return NextResponse.json({
        success: true,
        email,
        company,
        canSend: result.canSend,
        reason: result.reason,
        suppressionInfo: result.suppressionInfo,
        timestamp: new Date().toISOString()
      });

    } else if (action === 'reactivate') {
      // Attempt to reactivate suppressed email
      const result = await postmarkHelper.reactivateEmail(email);
      
      return NextResponse.json({
        success: result.success,
        email,
        company,
        message: result.message,
        timestamp: new Date().toISOString()
      });

    } else if (action === 'test_send') {
      // Test sending an email safely
      const emailResult = await postmarkHelper.sendEmailSafely({
        To: email,
        Subject: 'Test Email - Suppression Check',
        HtmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7c3aed;">Email Suppression Test</h2>
            <p>Hello,</p>
            <p>This is a test email to verify that email suppression handling is working correctly.</p>
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>Email: ${email}</li>
              <li>Company: ${company}</li>
              <li>Timestamp: ${new Date().toISOString()}</li>
              <li>Requested by: ${user.email}</li>
            </ul>
            <p style="color: #666; font-size: 14px;">
              This email was sent as part of email system testing and suppression management.
            </p>
          </div>
        `,
        TextBody: `
          Email Suppression Test
          
          This is a test email to verify that email suppression handling is working correctly.
          
          Test Details:
          - Email: ${email}
          - Company: ${company}
          - Timestamp: ${new Date().toISOString()}
          - Requested by: ${user.email}
          
          This email was sent as part of email system testing and suppression management.
        `
      });

      return NextResponse.json({
        success: emailResult.success,
        email,
        company,
        messageId: emailResult.messageId,
        error: emailResult.error,
        suppressionInfo: emailResult.suppressionInfo,
        canRetryAfterReactivation: emailResult.canRetryAfterReactivation,
        timestamp: new Date().toISOString()
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Supported: check, reactivate, test_send' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error managing email suppressions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to manage email suppressions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}