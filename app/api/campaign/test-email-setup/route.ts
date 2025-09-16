import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || 'demo-workspace-id';

  // Example email account setup
  const exampleEmailAccount = {
    workspaceId: workspaceId,
    emailAddress: "outreach@yourcompany.com",
    displayName: "John Smith - Your Company",
    replyToEmail: "john@yourcompany.com",
    smtpHost: "smtp.gmail.com", // or smtp.office365.com
    smtpPort: 587,
    smtpUsername: "outreach@yourcompany.com",
    smtpPassword: "your-app-password", // Use app-specific password
    smtpUseTls: true,
    smtpUseSsl: false,
    sendingDomain: "yourcompany.com",
    providerType: "gmail", // or "outlook", "custom"
    dailySendLimit: 500,
    hourlySendLimit: 50,
    monthlySendLimit: 10000,
    notes: "Main outreach account for sales campaigns"
  };

  // Example campaign email
  const exampleCampaignEmail = {
    workspaceId: workspaceId,
    emailAccountId: "email-account-uuid", // From POST /api/campaign/email-accounts
    campaignId: "campaign-uuid", // Optional
    recipientEmail: "prospect@target-company.com",
    recipientName: "Jane Doe",
    subjectLine: "Quick question about Target Company's growth strategy",
    messageBody: `<p>Hi Jane,</p>

<p>I noticed Target Company has been expanding rapidly in the fintech space. We've helped similar companies like ABC Corp and XYZ Ltd streamline their customer acquisition process and reduce costs by up to 40%.</p>

<p>Would you be interested in a brief 15-minute call to discuss how we might be able to help Target Company achieve similar results?</p>

<p>I have some time available next Tuesday or Wednesday if that works for you.</p>

<p>Best regards,<br>
John Smith<br>
Your Company<br>
john@yourcompany.com</p>

<p><em>P.S. If this isn't relevant to your role, I'd appreciate if you could point me toward the right person.</em></p>`,
    messageType: "html"
  };

  const instructions = {
    "🎯 Campaign Email System Setup": "Complete system for workspace-specific email outreach",
    
    "📧 Step 1: Configure Email Account": {
      "Endpoint": "POST /api/campaign/email-accounts",
      "Description": "Add a dedicated sending email account for campaigns",
      "Example Payload": exampleEmailAccount,
      "Supported Providers": [
        "Gmail (smtp.gmail.com:587) - Use app-specific password",
        "Outlook (smtp-mail.outlook.com:587) - Use app-specific password", 
        "Custom SMTP - Any business email provider",
        "Postmark - Transactional email service",
        "SendGrid - Email delivery service"
      ],
      "Security Notes": [
        "✅ SMTP credentials are encrypted in database",
        "✅ Connection is tested before saving",
        "✅ Rate limiting prevents spam/abuse",
        "✅ Reputation tracking monitors deliverability"
      ]
    },

    "📨 Step 2: Send Campaign Email": {
      "Endpoint": "POST /api/campaign/send-email",
      "Description": "Send individual campaign emails with tracking",
      "Example Payload": exampleCampaignEmail,
      "Features": [
        "✅ Real-time SMTP sending",
        "✅ Automatic rate limiting (500/day, 50/hour default)",
        "✅ Delivery status tracking",
        "✅ Bounce and complaint monitoring",
        "✅ Reputation score management",
        "✅ Campaign association and analytics"
      ]
    },

    "📊 Step 3: Monitor Performance": {
      "Endpoint": "GET /api/campaign/email-accounts?workspaceId=xxx",
      "Description": "View email account status and usage statistics",
      "Metrics Tracked": [
        "Daily/hourly/monthly send counts",
        "Bounce rate and complaint rate",
        "Delivery rate and reputation score", 
        "Account health and verification status"
      ]
    },

    "🛡️ Built-in Protections": {
      "Rate Limiting": "Prevents hitting provider limits (500/day, 50/hour default)",
      "Reputation Monitoring": "Tracks bounce/complaint rates, pauses bad accounts",
      "SMTP Verification": "Tests connection before saving configuration",
      "Usage Analytics": "Complete audit trail of all campaign emails",
      "Multi-Account Support": "Use different sending accounts per workspace/campaign"
    },

    "🔧 Quick Setup for Common Providers": {
      "Gmail/Google Workspace": {
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_use_tls": true,
        "setup_steps": [
          "1. Enable 2-Factor Authentication on your Google account",
          "2. Go to Google Account Settings > Security > App passwords",
          "3. Generate app password for 'Mail' application",
          "4. Use the 16-character app password (NOT your regular password)",
          "5. Username = your full Gmail address"
        ],
        "notes": "⚠️ CRITICAL: Must use app-specific password, never regular Gmail password"
      },
      "Outlook/Office365/Hotmail": {
        "smtp_host": "smtp-mail.outlook.com", 
        "smtp_port": 587,
        "smtp_use_tls": true,
        "setup_steps": [
          "1. Enable 2-Factor Authentication on Microsoft account",
          "2. Go to Security settings > Advanced security options",
          "3. Create app password for email applications",
          "4. Use the generated app password (NOT your regular password)",
          "5. Username = your full Outlook email address"
        ],
        "notes": "⚠️ CRITICAL: Must use app-specific password, OAuth not supported for SMTP"
      },
      "Custom Business Email": {
        "smtp_host": "mail.yourdomain.com",
        "smtp_port": 587,
        "smtp_use_tls": true,
        "notes": "Contact your email provider for exact SMTP settings"
      }
    },

    "📋 Integration with Campaigns": {
      "Workspace Accounts": "Each workspace can have multiple sending accounts",
      "Campaign Tracking": "Emails are linked to campaigns for analytics",
      "Template System": "Reusable templates with variable substitution",
      "Sequence Support": "Multi-step email sequences with delays",
      "Reply Tracking": "Monitor responses and engagement"
    },

    "⚡ Usage Examples": [
      `// 1. Configure email account
POST /api/campaign/email-accounts
${JSON.stringify(exampleEmailAccount, null, 2)}`,

      `// 2. Send campaign email  
POST /api/campaign/send-email
${JSON.stringify(exampleCampaignEmail, null, 2)}`,

      `// 3. Check account status
GET /api/campaign/email-accounts?workspaceId=${workspaceId}`
    ]
  };

  return NextResponse.json(instructions, { status: 200 });
}