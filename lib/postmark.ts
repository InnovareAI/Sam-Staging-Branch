import { Client } from 'postmark';

// Initialize Postmark client
const postmark = new Client(process.env.POSTMARK_SERVER_TOKEN!);

export interface EmailData {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  from?: string;
}

export const sendEmail = async (data: EmailData) => {
  if (!process.env.POSTMARK_SERVER_TOKEN) {
    console.warn('POSTMARK_SERVER_TOKEN not configured, skipping email send');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const result = await postmark.sendEmail({
      From: data.from || process.env.POSTMARK_FROM_EMAIL || 'noreply@meet-sam.com',
      To: data.to,
      Subject: data.subject,
      HtmlBody: data.htmlBody,
      TextBody: data.textBody,
      MessageStream: 'outbound'
    });

    console.log('Email sent successfully:', result);
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown email error' 
    };
  }
};

// Email templates
export const createWorkspaceInvitationEmail = (data: {
  inviteeName?: string;
  inviterName: string;
  workspaceName: string;
  inviteUrl: string;
  role: string;
  expiresAt: string;
}) => {
  const greeting = data.inviteeName ? `Hi ${data.inviteeName}` : 'Hello';
  const roleText = data.role === 'admin' ? 'an administrator' : `a ${data.role}`;
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Join SAM AI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; padding: 40px 30px; text-align: center; }
    .logo { width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; object-fit: cover; }
    .content { padding: 40px 30px; }
    .button { display: inline-block; background: #8b5cf6; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #7c3aed; }
    .footer { padding: 30px; background-color: #f1f5f9; color: #64748b; font-size: 14px; text-align: center; }
    .workspace-info { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://app.meet-sam.com/SAM.jpg" alt="SAM AI" class="logo">
      <h1 style="margin: 0; font-size: 28px;">You're Invited!</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Join a SAM AI workspace and start collaborating</p>
    </div>
    
    <div class="content">
      <p style="font-size: 16px; margin-bottom: 24px;">${greeting},</p>
      
      <p><strong>${data.inviterName}</strong> has invited you to join the <strong>${data.workspaceName}</strong> workspace on SAM AI as ${roleText}.</p>
      
      <div class="workspace-info">
        <h3 style="margin: 0 0 12px; color: #8b5cf6;">Workspace Details</h3>
        <p style="margin: 4px 0;"><strong>Name:</strong> ${data.workspaceName}</p>
        <p style="margin: 4px 0;"><strong>Role:</strong> ${data.role.charAt(0).toUpperCase() + data.role.slice(1)}</p>
        <p style="margin: 4px 0;"><strong>Invited by:</strong> ${data.inviterName}</p>
      </div>
      
      <p>SAM AI is your intelligent sales assistant platform that helps teams automate sales processes, manage customer relationships, and boost productivity with AI-powered insights.</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.inviteUrl}" class="button">Accept Invitation</a>
      </div>
      
      <p style="font-size: 14px; color: #64748b;">
        <strong>Note:</strong> This invitation will expire on ${new Date(data.expiresAt).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}. If you don't have a SAM AI account yet, you'll be able to create one when you accept the invitation.
      </p>
      
      <p style="font-size: 14px; color: #64748b;">
        Can't click the button? Copy and paste this link into your browser:<br>
        <a href="${data.inviteUrl}" style="color: #8b5cf6; word-break: break-all;">${data.inviteUrl}</a>
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 0;">
        This invitation was sent by ${data.inviterName} via SAM AI<br>
        <a href="https://app.meet-sam.com" style="color: #8b5cf6;">app.meet-sam.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  const textBody = `
You're Invited to Join SAM AI!

${greeting},

${data.inviterName} has invited you to join the "${data.workspaceName}" workspace on SAM AI as ${roleText}.

Workspace Details:
- Name: ${data.workspaceName}
- Role: ${data.role.charAt(0).toUpperCase() + data.role.slice(1)}
- Invited by: ${data.inviterName}

SAM AI is your intelligent sales assistant platform that helps teams automate sales processes, manage customer relationships, and boost productivity with AI-powered insights.

To accept this invitation, visit: ${data.inviteUrl}

Note: This invitation will expire on ${new Date(data.expiresAt).toLocaleDateString('en-US', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}. If you don't have a SAM AI account yet, you'll be able to create one when you accept the invitation.

---
This invitation was sent by ${data.inviterName} via SAM AI
https://app.meet-sam.com
`;

  return { htmlBody, textBody };
};