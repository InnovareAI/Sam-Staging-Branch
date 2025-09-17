// Unified Email Templates for SAM AI Platform
// Both InnovareAI and 3CubedAI use the same templates with company-specific branding

export interface CompanyBranding {
  name: string;
  fromEmail: string;
  fromName: string;
  primaryColor: string;
  secondaryColor: string;
}

export const COMPANY_BRANDING: Record<'InnovareAI' | '3cubedai', CompanyBranding> = {
  InnovareAI: {
    name: 'InnovareAI',
    fromEmail: 'sp@innovareai.com',
    fromName: 'Sarah Powell - InnovareAI',
    primaryColor: '#667eea',
    secondaryColor: '#764ba2'
  },
  '3cubedai': {
    name: '3CubedAI',
    fromEmail: 'sophia@3cubed.ai',
    fromName: 'Sophia - 3CubedAI',
    primaryColor: '#10b981',
    secondaryColor: '#059669'
  }
};

export interface InvitationEmailData {
  recipientEmail: string;
  recipientFirstName?: string;
  recipientLastName?: string;
  inviterName?: string;
  workspaceName?: string;
  invitationLink: string;
  company: 'InnovareAI' | '3cubedai';
  expirationDays?: number;
}

export function generateInvitationEmail(data: InvitationEmailData) {
  const branding = COMPANY_BRANDING[data.company];
  const recipientName = data.recipientFirstName ? `${data.recipientFirstName}${data.recipientLastName ? ` ${data.recipientLastName}` : ''}` : '';
  const greeting = recipientName ? `Hi ${data.recipientFirstName}!` : 'Hi there!';
  const expirationText = data.expirationDays ? `This invitation link will expire in ${data.expirationDays} days.` : 'This invitation link will expire in 7 days.';

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SAM AI - ${branding.name}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0; 
      padding: 0; 
      background-color: #f8f9fa;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 20px; 
    }
    .card { 
      background: white; 
      border-radius: 12px; 
      padding: 32px; 
      box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
    }
    .header { 
      text-align: center; 
      margin-bottom: 32px; 
    }
    .logo { 
      width: 80px; 
      height: 80px; 
      border-radius: 50%; 
      object-fit: cover; 
      margin: 0 auto 16px; 
      display: block; 
    }
    .button { 
      display: inline-block; 
      background: linear-gradient(135deg, ${branding.primaryColor} 0%, ${branding.secondaryColor} 100%); 
      color: white; 
      padding: 16px 32px; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 600; 
      margin: 24px 0;
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-1px);
    }
    .footer { 
      text-align: center; 
      margin-top: 32px; 
      font-size: 14px; 
      color: #666; 
    }
    .feature-list {
      list-style: none;
      padding: 0;
      margin: 20px 0;
    }
    .feature-list li {
      margin: 12px 0;
      padding-left: 24px;
      position: relative;
    }
    .feature-list li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: ${branding.primaryColor};
      font-weight: bold;
    }
    .cta-section {
      text-align: center;
      margin: 32px 0;
      padding: 24px;
      background: linear-gradient(135deg, ${branding.primaryColor}10 0%, ${branding.secondaryColor}10 100%);
      border-radius: 8px;
      border: 1px solid ${branding.primaryColor}20;
    }
    .company-signature {
      color: ${branding.primaryColor};
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <img src="https://app.meet-sam.com/SAM.jpg" alt="SAM AI" class="logo">
        <h1>🎉 Welcome to SAM AI!</h1>
        <p>You've been invited to join <strong class="company-signature">${branding.name}</strong>'s Sales Agent Platform</p>
      </div>
      
      <div class="content">
        <h2>Your SAM AI Account is Ready!</h2>
        <p>${greeting}</p>
        <p>You've been invited to join <strong>${branding.name}</strong> on the SAM AI platform. SAM is your intelligent sales agent that helps streamline your sales processes and boost productivity.</p>
        ${data.workspaceName ? `<p><strong>Workspace:</strong> ${data.workspaceName}</p>` : ''}
        ${data.inviterName ? `<p><strong>Invited by:</strong> ${data.inviterName}</p>` : ''}
        
        <h3>🚀 What you can do with SAM AI:</h3>
        <ul class="feature-list">
          <li>💬 Chat with SAM for sales insights and recommendations</li>
          <li>📊 Access your personalized sales dashboard</li>
          <li>🎯 Manage leads and track your sales pipeline</li>
          <li>📚 Build and access your team's knowledge base</li>
          <li>🚀 Launch targeted sales campaigns</li>
          <li>📈 Analyze performance with advanced analytics</li>
        </ul>
        
        <div class="cta-section">
          <h3>Ready to get started?</h3>
          <p>Click the button below to accept your invitation and join ${branding.name} on SAM AI.</p>
          <a href="${data.invitationLink}" class="button">Accept Invitation & Get Started</a>
        </div>
        
        <p><small>💡 <strong>Pro tip:</strong> Bookmark SAM AI for quick access to your sales agent anytime.</small></p>
        <p><small>⏰ ${expirationText} If you have any questions, please contact your team administrator or reply to this email.</small></p>
      </div>
      
      <div class="footer">
        <p>Best regards,<br>
        <strong class="company-signature">${branding.fromName}</strong><br>
        ${branding.name}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p><small>This email was sent from SAM AI Platform. If you believe this was sent in error, please ignore this email.</small></p>
        <p><small>SAM AI - Intelligent Sales Agent Platform</small></p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
Welcome to SAM AI - ${branding.name}!

${greeting}

You've been invited to join ${branding.name} on the SAM AI platform - your intelligent sales assistant that helps streamline sales processes and boost productivity.

${data.workspaceName ? `Workspace: ${data.workspaceName}\n` : ''}${data.inviterName ? `Invited by: ${data.inviterName}\n` : ''}

What you can do with SAM AI:
• Chat with SAM for sales insights and recommendations
• Access your personalized sales dashboard  
• Manage leads and track your sales pipeline
• Build and access your team's knowledge base
• Launch targeted sales campaigns
• Analyze performance with advanced analytics

🚀 ACCEPT YOUR INVITATION:
${data.invitationLink}

${expirationText} If you have any questions, please contact your team administrator.

Best regards,
${branding.fromName}
${branding.name}

---
This email was sent from SAM AI Platform.
SAM AI - Intelligent Sales Agent Platform
  `.trim();

  return {
    from: `${branding.fromName} <${branding.fromEmail}>`,
    to: data.recipientEmail,
    subject: `Welcome to SAM AI - ${branding.name}`,
    htmlBody,
    textBody,
    messageStream: 'outbound',
    tag: 'sam-ai-invitation'
  };
}

// Password Reset Email Template
export interface PasswordResetEmailData {
  recipientEmail: string;
  recipientName?: string;
  resetLink: string;
  company: 'InnovareAI' | '3cubedai';
  expirationHours?: number;
}

export function generatePasswordResetEmail(data: PasswordResetEmailData) {
  const branding = COMPANY_BRANDING[data.company];
  const greeting = data.recipientName ? `Hi ${data.recipientName}!` : 'Hi there!';
  const expirationText = data.expirationHours ? `This link will expire in ${data.expirationHours} hours.` : 'This link will expire in 24 hours.';

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your SAM AI Password - ${branding.name}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0; 
      padding: 0; 
      background-color: #f8f9fa;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 20px; 
    }
    .card { 
      background: white; 
      border-radius: 12px; 
      padding: 32px; 
      box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
    }
    .header { 
      text-align: center; 
      margin-bottom: 32px; 
    }
    .logo { 
      width: 80px; 
      height: 80px; 
      border-radius: 50%; 
      object-fit: cover; 
      margin: 0 auto 16px; 
      display: block; 
    }
    .button { 
      display: inline-block; 
      background: linear-gradient(135deg, ${branding.primaryColor} 0%, ${branding.secondaryColor} 100%); 
      color: white; 
      padding: 16px 32px; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 600; 
      margin: 24px 0;
    }
    .footer { 
      text-align: center; 
      margin-top: 32px; 
      font-size: 14px; 
      color: #666; 
    }
    .warning-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
    }
    .company-signature {
      color: ${branding.primaryColor};
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <img src="https://app.meet-sam.com/SAM.jpg" alt="SAM AI" class="logo">
        <h1>🔐 Password Reset Request</h1>
        <p>Reset your password for <strong class="company-signature">${branding.name}</strong> SAM AI Platform</p>
      </div>
      
      <div class="content">
        <p>${greeting}</p>
        <p>We received a request to reset your password for your SAM AI account with ${branding.name}.</p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.resetLink}" class="button">Reset Your Password</a>
        </div>
        
        <div class="warning-box">
          <p><strong>⚠️ Security Notice:</strong></p>
          <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
          <p>${expirationText} For security reasons, this link can only be used once.</p>
        </div>
        
        <p><small>If you're having trouble clicking the button, copy and paste this link into your browser:</small></p>
        <p><small style="word-break: break-all; color: #666;">${data.resetLink}</small></p>
      </div>
      
      <div class="footer">
        <p>Best regards,<br>
        <strong class="company-signature">${branding.fromName}</strong><br>
        ${branding.name}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p><small>This is an automated security email from SAM AI Platform.</small></p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
Password Reset Request - SAM AI ${branding.name}

${greeting}

We received a request to reset your password for your SAM AI account with ${branding.name}.

Reset your password: ${data.resetLink}

SECURITY NOTICE:
If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

${expirationText} For security reasons, this link can only be used once.

Best regards,
${branding.fromName}
${branding.name}

---
This is an automated security email from SAM AI Platform.
  `.trim();

  return {
    from: `${branding.fromName} <${branding.fromEmail}>`,
    to: data.recipientEmail,
    subject: `Reset Your SAM AI Password - ${branding.name}`,
    htmlBody,
    textBody,
    messageStream: 'outbound',
    tag: 'sam-ai-password-reset'
  };
}

// Welcome Email Template (after successful signup)
export interface WelcomeEmailData {
  recipientEmail: string;
  recipientName?: string;
  loginLink: string;
  company: 'InnovareAI' | '3cubedai';
  workspaceName?: string;
}

export function generateWelcomeEmail(data: WelcomeEmailData) {
  const branding = COMPANY_BRANDING[data.company];
  const greeting = data.recipientName ? `Hi ${data.recipientName}!` : 'Hi there!';

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${branding.name} SAM AI!</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0; 
      padding: 0; 
      background-color: #f8f9fa;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 20px; 
    }
    .card { 
      background: white; 
      border-radius: 12px; 
      padding: 32px; 
      box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
    }
    .header { 
      text-align: center; 
      margin-bottom: 32px; 
    }
    .logo { 
      width: 80px; 
      height: 80px; 
      border-radius: 50%; 
      object-fit: cover; 
      margin: 0 auto 16px; 
      display: block; 
    }
    .button { 
      display: inline-block; 
      background: linear-gradient(135deg, ${branding.primaryColor} 0%, ${branding.secondaryColor} 100%); 
      color: white; 
      padding: 16px 32px; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 600; 
      margin: 24px 0;
    }
    .footer { 
      text-align: center; 
      margin-top: 32px; 
      font-size: 14px; 
      color: #666; 
    }
    .company-signature {
      color: ${branding.primaryColor};
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <img src="https://app.meet-sam.com/SAM.jpg" alt="SAM AI" class="logo">
        <h1>🎉 Welcome to SAM AI!</h1>
        <p>Your account with <strong class="company-signature">${branding.name}</strong> is now active</p>
      </div>
      
      <div class="content">
        <p>${greeting}</p>
        <p>Congratulations! Your SAM AI account has been successfully created and you're now part of the ${branding.name} team.</p>
        ${data.workspaceName ? `<p>You've been added to the <strong>${data.workspaceName}</strong> workspace.</p>` : ''}
        
        <h3>🚀 What's next?</h3>
        <p>Start exploring SAM AI's powerful features:</p>
        <ul>
          <li>💬 Chat with your AI sales assistant</li>
          <li>📊 Set up your sales dashboard</li>
          <li>🎯 Import your first leads</li>
          <li>📚 Explore the knowledge base</li>
        </ul>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${data.loginLink}" class="button">Start Using SAM AI</a>
        </div>
        
        <p><small>💡 <strong>Need help?</strong> Our team is here to support you. Reply to this email with any questions!</small></p>
      </div>
      
      <div class="footer">
        <p>Welcome to the team!<br>
        <strong class="company-signature">${branding.fromName}</strong><br>
        ${branding.name}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p><small>SAM AI - Intelligent Sales Agent Platform</small></p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return {
    from: `${branding.fromName} <${branding.fromEmail}>`,
    to: data.recipientEmail,
    subject: `Welcome to ${branding.name} SAM AI! 🎉`,
    htmlBody,
    textBody: `Welcome to ${branding.name} SAM AI!\n\n${greeting}\n\nYour account is now active and ready to use!\n\nStart here: ${data.loginLink}\n\nBest regards,\n${branding.fromName}\n${branding.name}`,
    messageStream: 'outbound',
    tag: 'sam-ai-welcome'
  };
}