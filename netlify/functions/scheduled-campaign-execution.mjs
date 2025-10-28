/**
 * Netlify Scheduled Function
 * Triggers campaign execution every 2 minutes
 *
 * This function calls the Next.js API route that handles
 * the actual campaign execution logic.
 */

export default async (req, context) => {
  console.log('⏰ Scheduled function triggered at:', new Date().toISOString());

  try {
    // Get the base URL from environment or construct it
    const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';
    const apiUrl = `${baseUrl}/api/cron/execute-scheduled-campaigns`;

    console.log(`📡 Calling API endpoint: ${apiUrl}`);

    // Call the Next.js API route for scheduled campaigns
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET || '',
        'x-netlify-scheduled': 'true'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ API call failed:', response.status, data);
      return new Response(JSON.stringify({
        success: false,
        error: data.error || 'API call failed',
        status: response.status
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Campaign execution completed:', data.message);

    // Also process pending prospects (background processing)
    const pendingProspectsUrl = `${baseUrl}/api/cron/process-pending-prospects`;
    console.log(`📡 Processing pending prospects: ${pendingProspectsUrl}`);

    try {
      const pendingResponse = await fetch(pendingProspectsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET || '',
          'x-netlify-scheduled': 'true'
        }
      });

      const pendingData = await pendingResponse.json();

      if (pendingResponse.ok) {
        console.log('✅ Pending prospects processed:', pendingData.message || 'No pending prospects');
      } else {
        console.error('⚠️ Pending prospects processing failed (non-critical):', pendingData.error);
      }
    } catch (pendingError) {
      console.error('⚠️ Error processing pending prospects (non-critical):', pendingError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      message: data.message,
      campaigns_processed: data.campaigns_processed,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Scheduled function error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  schedule: '*/2 * * * *' // Every 2 minutes
};
