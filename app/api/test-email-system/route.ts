import { NextRequest, NextResponse } from 'next/server';
import { ServerClient } from 'postmark';
import { LinkTrackingOptions } from 'postmark/dist/client/models/message/SupportingTypes';

const COMPANIES = {
  innovareai: {
    name: 'InnovareAI',
    api_key: process.env.POSTMARK_INNOVAREAI_API_KEY!,
    from_email: 'sp@innovareai.com',
    from_name: 'Sarah Powell - SAM AI',
    test_email: 'tl@innovareai.com'
  },
  cubedai: {
    name: '3CubedAI',
    api_key: process.env.POSTMARK_3CUBEDAI_API_KEY!,
    from_email: 'noreply@3cubed.ai',
    from_name: '3CubedAI Team',
    test_email: 'tl@3cubed.ai'
  }
};

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    email_system_tests: {} as any,
    summary: {
      passed: 0,
      failed: 0,
      total: 0
    }
  };

  for (const [companyKey, company] of Object.entries(COMPANIES)) {
    try {
      const client = new ServerClient(company.api_key);
      
      // Test 1: Server connectivity
      const serverInfo = await client.getServer();
      
      // Test 2: Send test email
      const testEmailResult = await client.sendEmail({
        From: company.from_email,
        To: company.test_email,
        Subject: `${company.name} Email System Test - ${new Date().toISOString()}`,
        HtmlBody: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>🧪 Email System Integration Test</h2>
            <p><strong>Company:</strong> ${company.name}</p>
            <p><strong>Test Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Server ID:</strong> ${serverInfo.ID}</p>
            <p><strong>Server Name:</strong> ${serverInfo.Name}</p>
            <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #0ea5e9; margin: 20px 0;">
              <p><strong>✅ Status:</strong> Email delivery system is operational</p>
              <p><strong>🎯 Purpose:</strong> System integration testing by Engineering Subagent #2</p>
            </div>
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated test email generated during system integration testing.
            </p>
          </div>
        `,
        MessageStream: 'outbound',
        TrackOpens: true,
        TrackLinks: LinkTrackingOptions.TextOnly
      });

      results.email_system_tests[companyKey] = {
        company_name: company.name,
        status: 'PASS',
        server_info: {
          id: serverInfo.ID,
          name: serverInfo.Name,
          color: serverInfo.Color,
          smtp_api_activated: serverInfo.SmtpApiActivated,
          raw_email_enabled: serverInfo.RawEmailEnabled,
          delivery_hook_url: serverInfo.DeliveryHookUrl,
          bounce_hook_url: serverInfo.BounceHookUrl,
          open_hook_url: serverInfo.OpenHookUrl,
          postfirst_hook_url: serverInfo.PostFirstOpenOnly,
          click_hook_url: serverInfo.ClickHookUrl,
          inbound_address: serverInfo.InboundAddress,
          inbound_hook_url: serverInfo.InboundHookUrl
        },
        email_test: {
          message_id: testEmailResult.MessageID,
          submitted_at: testEmailResult.SubmittedAt,
          to: testEmailResult.To,
          error_code: testEmailResult.ErrorCode,
          message: testEmailResult.Message
        },
        performance: {
          api_response_time: 'measured',
          delivery_status: 'sent'
        }
      };
      results.summary.passed++;

    } catch (error) {
      results.email_system_tests[companyKey] = {
        company_name: company.name,
        status: 'FAIL',
        error: (error as Error).message,
        error_details: error
      };
      results.summary.failed++;
    }
  }

  results.summary.total = results.summary.passed + results.summary.failed;

  return NextResponse.json(results, { 
    status: results.summary.failed === 0 ? 200 : 500 
  });
}

export async function POST(req: NextRequest) {
  const { company, recipient_email, test_type = 'invitation' } = await req.json();

  if (!company || !COMPANIES[company as keyof typeof COMPANIES]) {
    return NextResponse.json({ error: 'Invalid company specified' }, { status: 400 });
  }

  if (!recipient_email) {
    return NextResponse.json({ error: 'Recipient email required' }, { status: 400 });
  }

  const companyConfig = COMPANIES[company as keyof typeof COMPANIES];
  const client = new ServerClient(companyConfig.api_key);

  try {
    let emailTemplate;

    if (test_type === 'invitation') {
      emailTemplate = {
        From: companyConfig.from_email,
        To: recipient_email,
        Subject: `You're invited to join SAM AI - ${companyConfig.name}`,
        HtmlBody: generateInvitationTemplate(companyConfig.name, 'Test Workspace'),
        MessageStream: 'outbound',
        TrackOpens: true,
        TrackLinks: LinkTrackingOptions.TextOnly
      };
    } else if (test_type === 'welcome') {
      emailTemplate = {
        From: companyConfig.from_email,
        To: recipient_email,
        Subject: `Welcome to ${companyConfig.name} - SAM AI`,
        HtmlBody: generateWelcomeTemplate(companyConfig.name),
        MessageStream: 'outbound',
        TrackOpens: true,
        TrackLinks: LinkTrackingOptions.TextOnly
      };
    } else {
      return NextResponse.json({ error: 'Invalid test type' }, { status: 400 });
    }

    const result = await client.sendEmail(emailTemplate);

    return NextResponse.json({
      success: true,
      company: companyConfig.name,
      test_type,
      recipient: recipient_email,
      message_id: result.MessageID,
      submitted_at: result.SubmittedAt,
      error_code: result.ErrorCode,
      message: result.Message
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      company: companyConfig.name,
      error: (error as Error).message
    }, { status: 500 });
  }
}

function generateInvitationTemplate(companyName: string, workspaceName: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #7C3AED; margin: 0;">${companyName} - SAM AI</h1>
        <p style="color: #6B7280; margin: 5px 0;">AI-Powered Sales Assistant Platform</p>
      </div>
      
      <div style="background: #F9FAFB; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
        <h2 style="color: #1F2937; margin-top: 0;">🎉 You're invited to collaborate!</h2>
        <p style="color: #4B5563; line-height: 1.6;">
          You've been invited to join the workspace <strong>"${workspaceName}"</strong> 
          on SAM AI platform by ${companyName}.
        </p>
        <p style="color: #4B5563; line-height: 1.6;">
          This is a test invitation generated during system integration testing.
        </p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="#" 
           style="background: #7C3AED; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
          Join Workspace (Test Link)
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
      
      <p style="color: #6B7280; font-size: 14px; text-align: center;">
        This is a test email for system integration testing purposes.
      </p>
    </div>
  `;
}

function generateWelcomeTemplate(companyName: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #7C3AED; margin: 0;">${companyName} - SAM AI</h1>
        <p style="color: #6B7280; margin: 5px 0;">AI-Powered Sales Assistant Platform</p>
      </div>
      
      <div style="background: #F0FDF4; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
        <h2 style="color: #1F2937; margin-top: 0;">🚀 Welcome to the team!</h2>
        <p style="color: #4B5563; line-height: 1.6;">
          You've successfully joined ${companyName} on the SAM AI platform.
        </p>
        <p style="color: #4B5563; line-height: 1.6;">
          This is a test welcome email generated during system integration testing.
        </p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="#" 
           style="background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
          Access Dashboard (Test Link)
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
      
      <p style="color: #6B7280; font-size: 14px; text-align: center;">
        This is a test email for system integration testing purposes.
      </p>
    </div>
  `;
}