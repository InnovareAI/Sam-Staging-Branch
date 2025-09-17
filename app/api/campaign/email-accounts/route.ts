import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import nodemailer from 'nodemailer';

// GET /api/campaign/email-accounts?workspaceId=xxx - Get workspace email accounts
export async function GET(request: NextRequest) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    // Use already imported supabase client

    // Get current user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify workspace access
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userData.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 });
    }

    // Get email accounts (excluding encrypted passwords)
    const { data: emailAccounts, error } = await supabase
      .from('campaign_email_accounts')
      .select(`
        id,
        email_address,
        display_name,
        reply_to_email,
        smtp_host,
        smtp_port,
        smtp_username,
        smtp_use_tls,
        smtp_use_ssl,
        sending_domain,
        dkim_configured,
        spf_configured,
        dmarc_configured,
        is_active,
        is_verified,
        verification_status,
        last_verified_at,
        daily_send_limit,
        hourly_send_limit,
        monthly_send_limit,
        emails_sent_today,
        emails_sent_this_hour,
        emails_sent_this_month,
        bounce_rate,
        complaint_rate,
        delivery_rate,
        reputation_score,
        provider_type,
        notes,
        created_at,
        updated_at
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching email accounts:', error);
      return NextResponse.json({ error: 'Failed to fetch email accounts' }, { status: 500 });
    }

    return NextResponse.json({
      email_accounts: emailAccounts || [],
      total: emailAccounts?.length || 0
    });

  } catch (error) {
    console.error('Campaign email accounts GET error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/campaign/email-accounts - Create new campaign email account
export async function POST(request: NextRequest) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      workspaceId,
      emailAddress,
      displayName,
      replyToEmail,
      smtpHost,
      smtpPort = 587,
      smtpUsername,
      smtpPassword,
      smtpUseTls = true,
      smtpUseSsl = false,
      sendingDomain,
      providerType = 'custom',
      dailySendLimit = 500,
      hourlySendLimit = 50,
      monthlySendLimit = 10000,
      notes
    } = body;

    if (!workspaceId || !emailAddress || !displayName || !smtpHost || !smtpUsername || !smtpPassword) {
      return NextResponse.json({
        error: 'Missing required fields: workspaceId, emailAddress, displayName, smtpHost, smtpUsername, smtpPassword'
      }, { status: 400 });
    }

    // Use already imported supabase client

    // Get current user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify workspace access
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userData.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 });
    }

    // Test SMTP connection before saving
    console.log('🔧 Testing SMTP connection for', emailAddress);
    
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpUseSsl, // Use SSL
        requireTLS: smtpUseTls, // Use STARTTLS
        auth: {
          user: smtpUsername,
          pass: smtpPassword
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
        socketTimeout: 10000
      });

      await transporter.verify();
      console.log('✅ SMTP connection verified for', emailAddress);
    } catch (smtpError) {
      console.error('❌ SMTP connection failed:', smtpError);
      return NextResponse.json({
        error: 'SMTP connection failed',
        details: smtpError instanceof Error ? smtpError.message : 'Invalid SMTP configuration'
      }, { status: 400 });
    }

    // Simple password encryption (in production, use proper encryption)
    const encryptedPassword = Buffer.from(smtpPassword).toString('base64');

    // Extract domain from email address if not provided
    const domain = sendingDomain || emailAddress.split('@')[1];

    // Create email account
    const { data: newAccount, error } = await supabase
      .from('campaign_email_accounts')
      .insert({
        workspace_id: workspaceId,
        created_by: userData.id,
        email_address: emailAddress,
        display_name: displayName,
        reply_to_email: replyToEmail || emailAddress,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_username: smtpUsername,
        smtp_password_encrypted: encryptedPassword,
        smtp_use_tls: smtpUseTls,
        smtp_use_ssl: smtpUseSsl,
        sending_domain: domain,
        provider_type: providerType,
        daily_send_limit: dailySendLimit,
        hourly_send_limit: hourlySendLimit,
        monthly_send_limit: monthlySendLimit,
        notes: notes,
        is_verified: true, // Since SMTP test passed
        verification_status: 'verified'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating email account:', error);
      return NextResponse.json({ error: 'Failed to create email account' }, { status: 500 });
    }

    // Remove encrypted password from response
    const { smtp_password_encrypted, ...accountResponse } = newAccount;

    return NextResponse.json({
      success: true,
      email_account: accountResponse,
      message: `Campaign email account created successfully for ${emailAddress}`
    });

  } catch (error) {
    console.error('Campaign email accounts POST error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/campaign/email-accounts - Update email account
export async function PUT(request: NextRequest) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { accountId, updates } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Use already imported supabase client

    // Get current user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify account access
    const { data: account } = await supabase
      .from('campaign_email_accounts')
      .select('workspace_id, email_address')
      .eq('id', accountId)
      .single();

    if (!account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 });
    }

    // Verify workspace access
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', account.workspace_id)
      .eq('user_id', userData.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 });
    }

    // Update account
    const { data: updatedAccount, error } = await supabase
      .from('campaign_email_accounts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)
      .select()
      .single();

    if (error) {
      console.error('Error updating email account:', error);
      return NextResponse.json({ error: 'Failed to update email account' }, { status: 500 });
    }

    // Remove encrypted password from response
    const { smtp_password_encrypted, ...accountResponse } = updatedAccount;

    return NextResponse.json({
      success: true,
      email_account: accountResponse,
      message: `Email account updated successfully`
    });

  } catch (error) {
    console.error('Campaign email accounts PUT error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/campaign/email-accounts - Delete email account
export async function DELETE(request: NextRequest) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Use already imported supabase client

    // Get current user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify account access and get details
    const { data: account } = await supabase
      .from('campaign_email_accounts')
      .select('workspace_id, email_address')
      .eq('id', accountId)
      .single();

    if (!account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 });
    }

    // Verify workspace access
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', account.workspace_id)
      .eq('user_id', userData.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 });
    }

    // Delete account (CASCADE will handle related records)
    const { error } = await supabase
      .from('campaign_email_accounts')
      .delete()
      .eq('id', accountId);

    if (error) {
      console.error('Error deleting email account:', error);
      return NextResponse.json({ error: 'Failed to delete email account' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Email account ${account.email_address} deleted successfully`
    });

  } catch (error) {
    console.error('Campaign email accounts DELETE error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}