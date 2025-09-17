import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseAdmin()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json();
    const {
      workspaceId,
      emailAccountId,
      campaignId,
      recipientEmail,
      recipientName,
      subjectLine,
      messageBody,
      messageType = 'html'
    } = body;

    if (!workspaceId || !emailAccountId || !recipientEmail || !subjectLine || !messageBody) {
      return NextResponse.json({
        error: 'Missing required fields: workspaceId, emailAccountId, recipientEmail, subjectLine, messageBody'
      }, { status: 400 });
    }

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

    // Get email account details
    const { data: emailAccount } = await supabase
      .from('campaign_email_accounts')
      .select('*')
      .eq('id', emailAccountId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!emailAccount) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 });
    }

    if (!emailAccount.is_active || !emailAccount.is_verified) {
      return NextResponse.json({ 
        error: 'Email account is not active or verified' 
      }, { status: 400 });
    }

    // Check if email can be sent (rate limiting)
    const { data: canSend, error: rateLimitError } = await supabase
      .rpc('can_send_email', { p_email_account_id: emailAccountId });

    if (rateLimitError || !canSend) {
      console.error('Rate limit check failed:', rateLimitError);
      return NextResponse.json({ 
        error: 'Email sending not allowed: rate limit exceeded or account suspended',
        details: {
          daily_sent: emailAccount.emails_sent_today,
          daily_limit: emailAccount.daily_send_limit,
          hourly_sent: emailAccount.emails_sent_this_hour,
          hourly_limit: emailAccount.hourly_send_limit,
          reputation_score: emailAccount.reputation_score
        }
      }, { status: 429 });
    }

    // Decrypt SMTP password (simple base64 decode - use proper encryption in production)
    const smtpPassword = Buffer.from(emailAccount.smtp_password_encrypted, 'base64').toString();

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: emailAccount.smtp_host,
      port: emailAccount.smtp_port,
      secure: emailAccount.smtp_use_ssl,
      requireTLS: emailAccount.smtp_use_tls,
      auth: {
        user: emailAccount.smtp_username,
        pass: smtpPassword
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    });

    // Prepare email options
    const mailOptions = {
      from: `${emailAccount.display_name} <${emailAccount.email_address}>`,
      to: recipientName ? `${recipientName} <${recipientEmail}>` : recipientEmail,
      replyTo: emailAccount.reply_to_email || emailAccount.email_address,
      subject: subjectLine,
      [messageType === 'html' ? 'html' : 'text']: messageBody,
      headers: {
        'X-Campaign-ID': campaignId || 'direct',
        'X-Workspace-ID': workspaceId,
        'X-Sender-ID': userData.id
      }
    };

    console.log('📧 Sending email:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: subjectLine,
      account: emailAccount.email_address
    });

    try {
      // Send email
      const info = await transporter.sendMail(mailOptions);
      
      console.log('✅ Email sent successfully:', {
        messageId: info.messageId,
        recipient: recipientEmail
      });

      // Log the email send attempt
      const { data: logId } = await supabase
        .rpc('log_campaign_email_send', {
          p_workspace_id: workspaceId,
          p_email_account_id: emailAccountId,
          p_campaign_id: campaignId,
          p_recipient_email: recipientEmail,
          p_recipient_name: recipientName,
          p_subject_line: subjectLine,
          p_message_body: messageBody,
          p_sent_by: userData.id,
          p_message_id: info.messageId
        });

      return NextResponse.json({
        success: true,
        message_id: info.messageId,
        log_id: logId,
        recipient: recipientEmail,
        account_used: emailAccount.email_address,
        sent_at: new Date().toISOString(),
        message: 'Email sent successfully'
      });

    } catch (smtpError) {
      console.error('❌ SMTP sending failed:', smtpError);

      // Still log the failed attempt
      await supabase
        .from('campaign_email_logs')
        .insert({
          workspace_id: workspaceId,
          campaign_id: campaignId,
          email_account_id: emailAccountId,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          subject_line: subjectLine,
          message_body: messageBody,
          sent_by: userData.id,
          delivery_status: 'failed'
        });

      return NextResponse.json({
        error: 'Email sending failed',
        details: smtpError instanceof Error ? smtpError.message : 'SMTP error',
        recipient: recipientEmail,
        account_used: emailAccount.email_address
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Campaign email sending error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}