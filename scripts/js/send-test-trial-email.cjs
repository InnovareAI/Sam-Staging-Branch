/**
 * Send Test Trial Confirmation Email
 * Sends a test email directly using Postmark
 */

const { createClient } = require('@supabase/supabase-js');
const { ServerClient } = require('postmark');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLAN_PRICES = {
  perseat: 99,
  sme: 349
};

async function sendTestTrialEmail() {
  try {
    // Get the most recent user
    const userId = '592a5d43-d12b-4f7e-a94c-2edb7a44dae2'; // Tom Lee
    const workspaceId = 'c50b7f04-65ac-464f-a1c2-822ea7feea29'; // Chillmine
    const plan = 'perseat';

    console.log('📧 Fetching user and workspace details...\n');

    // Fetch user details
    const { data: profile } = await supabase
      .from('users')
      .select('email, first_name, last_name')
      .eq('id', userId)
      .single();

    if (!profile) {
      console.log('❌ User not found');
      return;
    }

    // Fetch workspace details
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single();

    if (!workspace) {
      console.log('❌ Workspace not found');
      return;
    }

    const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const planName = plan === 'perseat' ? 'Startup Plan' : 'SME Plan';
    const planPrice = PLAN_PRICES[plan];

    console.log('📋 Email Details:');
    console.log(`   To: ${profile.email}`);
    console.log(`   Name: ${profile.first_name} ${profile.last_name}`);
    console.log(`   Workspace: ${workspace.name}`);
    console.log(`   Plan: ${planName} ($${planPrice}/month)`);
    console.log(`   Trial Ends: ${trialEndDate.toLocaleDateString()}\n`);

    // Generate email HTML
    const trialEndFormatted = trialEndDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your SAM AI Trial Has Started</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 32px; }
    .logo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin: 0 auto 16px; display: block; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .trial-box { background: linear-gradient(135deg, #10b98120 0%, #05966920 100%); border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center; }
    .account-details { background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .account-details table { width: 100%; border-collapse: collapse; }
    .account-details td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .account-details td:first-child { font-weight: 600; color: #4b5563; width: 40%; }
    .info-box { background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .feature-list { list-style: none; padding: 0; margin: 20px 0; }
    .feature-list li { margin: 12px 0; padding-left: 28px; position: relative; }
    .feature-list li:before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: bold; font-size: 18px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <img src="https://app.meet-sam.com/SAM.jpg" alt="SAM AI" class="logo">
        <h1>🎉 Your 14-Day Trial Has Started!</h1>
        <p>Welcome to <strong>InnovareAI</strong> SAM AI Platform</p>
      </div>

      <div class="content">
        <p>Hi ${profile.first_name}!</p>
        <p>Thank you for signing up! Your SAM AI account is now active and your <strong>14-day free trial</strong> has officially started.</p>

        <div class="trial-box">
          <h2 style="margin: 0 0 12px 0; color: #059669;">✨ No Charge Until ${trialEndFormatted}</h2>
          <p style="margin: 0; font-size: 14px; color: #047857;">Enjoy full access to all features during your trial. Cancel anytime with no charge.</p>
        </div>

        <div class="account-details">
          <h3 style="margin: 0 0 16px 0;">📋 Account Details</h3>
          <table>
            <tr><td>Account Email:</td><td>${profile.email}</td></tr>
            <tr><td>Workspace:</td><td>${workspace.name}</td></tr>
            <tr><td>Plan:</td><td><strong>${planName}</strong></td></tr>
            <tr><td>Monthly Price:</td><td><strong>$${planPrice}/month</strong></td></tr>
            <tr><td>Trial Ends:</td><td><strong>${trialEndFormatted}</strong></td></tr>
            <tr><td>First Charge:</td><td><strong>${trialEndFormatted}</strong> (only if you don't cancel)</td></tr>
          </table>
        </div>

        <div class="info-box">
          <h3 style="margin: 0 0 12px 0;">💳 Payment Information</h3>
          <p style="margin: 0; font-size: 14px;">Your payment method has been saved but <strong>will not be charged</strong> until your trial period ends. You can cancel anytime before ${trialEndFormatted} with no charge.</p>
        </div>

        <h3>🚀 What You Can Do During Your Trial:</h3>
        <ul class="feature-list">
          <li>💬 Chat with SAM, your AI sales assistant</li>
          <li>📊 Access your personalized sales dashboard</li>
          <li>🎯 Import and manage prospects</li>
          <li>📚 Build and customize your knowledge base</li>
          <li>🚀 Launch LinkedIn and email campaigns</li>
          <li>📈 Track performance with advanced analytics</li>
          <li>👥 Invite team members to collaborate</li>
        </ul>

        <div style="text-align: center; margin: 32px 0;">
          <a href="https://app.meet-sam.com" class="button">Start Using SAM AI Now</a>
        </div>

        <p><small>💡 <strong>Need help getting started?</strong> Our team is here to support you. Reply to this email with any questions!</small></p>
        <p><small>🔒 You can manage your subscription and payment details anytime from your workspace settings.</small></p>
      </div>

      <div style="text-align: center; margin-top: 32px; font-size: 14px; color: #666;">
        <p>Welcome to SAM AI!<br><strong style="color: #667eea;">Sarah Powell - InnovareAI</strong></p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p><small>This email confirms the start of your 14-day free trial.</small></p>
        <p><small>SAM AI - Intelligent Sales Agent Platform</small></p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    // Send email using Postmark
    console.log('📤 Sending email via Postmark...\n');

    const postmarkClient = new ServerClient(process.env.POSTMARK_INNOVAREAI_API_KEY);

    const result = await postmarkClient.sendEmail({
      From: 'Sarah Powell - InnovareAI <sp@innovareai.com>',
      To: profile.email,
      Subject: 'Your 14-Day SAM AI Trial Has Started! 🎉',
      HtmlBody: htmlBody,
      TextBody: `Your 14-Day SAM AI Trial Has Started!\n\nHi ${profile.first_name}!\n\nThank you for signing up! Your SAM AI account is now active and your 14-day free trial has officially started.\n\nNo charge until ${trialEndFormatted}\n\nYour account details:\n- Email: ${profile.email}\n- Workspace: ${workspace.name}\n- Plan: ${planName}\n- Monthly Price: $${planPrice}/month\n- Trial Ends: ${trialEndFormatted}\n\nStart using SAM AI: https://app.meet-sam.com\n\nWelcome to SAM AI!\nSarah Powell - InnovareAI`,
      MessageStream: 'outbound',
      Tag: 'sam-ai-trial-confirmation-test'
    });

    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${result.MessageID}`);
    console.log(`   Submitted At: ${result.SubmittedAt}`);
    console.log(`   To: ${result.To}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.ErrorCode) {
      console.error(`   Postmark Error Code: ${error.ErrorCode}`);
      console.error(`   Postmark Message: ${error.Message}`);
    }
    process.exit(1);
  }
}

sendTestTrialEmail();
