import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('📧 Testing daily health email...');

    // Call the Edge Function directly
    const response = await fetch(
      'https://latxadqrvrrrcvkktrog.supabase.co/functions/v1/send-daily-health-report',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Edge Function error: ${JSON.stringify(result)}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully!',
      details: {
        to: 'tl@innovareai.com, cl@innovareai.com',
        from: 'Sam <sam-health@innovareai.com>',
        status: result.overall_status,
        checks_run: result.checks_run,
        message_id: result.message_id
      },
      edgeFunctionResponse: result
    });

  } catch (error: any) {
    console.error('Error testing email:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      note: 'Check Edge Function logs in Supabase Dashboard'
    }, { status: 500 });
  }
}

export async function GET() {
  // Allow GET for easy browser testing
  return POST();
}
