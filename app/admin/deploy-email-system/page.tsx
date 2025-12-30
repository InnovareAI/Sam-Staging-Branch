'use client';

import { useState } from 'react';

export default function DeployEmailSystemPage() {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [tested, setTested] = useState(false);

  const deploySystem = async () => {
    setLoading(true);
    setStatus('Deploying email cron job...');

    try {
      const response = await fetch('/api/admin/deploy-email-system', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setStatus('✅ Email system deployed successfully!');
        setDeployed(true);
      } else {
        setStatus(`❌ Deployment failed: ${result.error}`);
      }
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testEmail = async () => {
    setLoading(true);
    setStatus('Sending test email...');

    try {
      const response = await fetch('https://latxadqrvrrrcvkktrog.supabase.co/functions/v1/send-daily-health-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (result.success) {
        setStatus('✅ Test email sent! Check tl@innovareai.com and cl@innovareai.com');
        setTested(true);
      } else {
        setStatus(`⚠️ Email function called but check logs: ${JSON.stringify(result)}`);
      }
    } catch (error: any) {
      setStatus(`❌ Error sending test email: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-6">
            📧 Deploy Daily Email System
          </h1>

          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg p-6 text-white">
              <h2 className="text-xl font-semibold mb-2">System Status</h2>
              <div className="space-y-2">
                <div className="flex items-center">
                  <span className="mr-2">✅</span>
                  <span>Edge Function Deployed</span>
                </div>
                <div className="flex items-center">
                  <span className="mr-2">{deployed ? '✅' : '⏳'}</span>
                  <span>Cron Job {deployed ? 'Scheduled' : 'Pending'}</span>
                </div>
                <div className="flex items-center">
                  <span className="mr-2">{tested ? '✅' : '⏳'}</span>
                  <span>Email {tested ? 'Tested' : 'Not Tested'}</span>
                </div>
              </div>
            </div>

            {/* Configuration Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">
                Email Configuration
              </h3>
              <div className="space-y-2 text-sm text-blue-800">
                <p><strong>From:</strong> Sam &lt;sam-health@innovareai.com&gt;</p>
                <p><strong>To:</strong> tl@innovareai.com, cl@innovareai.com</p>
                <p><strong>Schedule:</strong> Daily at 7:00 AM UTC</p>
                <p><strong>Content:</strong> Health check results from all 4 cron jobs</p>
              </div>
            </div>

            {/* Deploy Button */}
            <div className="space-y-4">
              <button
                onClick={deploySystem}
                disabled={loading || deployed}
                className={`w-full py-4 px-6 rounded-lg font-semibold text-white text-lg
                  ${deployed
                    ? 'bg-green-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                  }
                  disabled:opacity-50 transition-colors`}
              >
                {deployed ? '✅ System Deployed' : '🚀 Deploy Email System'}
              </button>

              {deployed && (
                <button
                  onClick={testEmail}
                  disabled={loading || tested}
                  className={`w-full py-4 px-6 rounded-lg font-semibold text-white text-lg
                    ${tested
                      ? 'bg-green-500 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700'
                    }
                    disabled:opacity-50 transition-colors`}
                >
                  {tested ? '✅ Test Email Sent' : '📧 Send Test Email Now'}
                </button>
              )}
            </div>

            {/* Status Display */}
            {status && (
              <div className={`p-4 rounded-lg ${
                status.includes('✅') ? 'bg-green-50 border border-green-200 text-green-800' :
                status.includes('❌') ? 'bg-red-50 border border-red-200 text-red-800' :
                'bg-yellow-50 border border-yellow-200 text-yellow-800'
              }`}>
                <p className="font-mono text-sm whitespace-pre-wrap">{status}</p>
              </div>
            )}

            {/* What's Next */}
            {tested && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-green-900 mb-3">
                  🎉 All Done!
                </h3>
                <div className="space-y-2 text-sm text-green-800">
                  <p>✅ Edge Function deployed and tested</p>
                  <p>✅ Cron job scheduled for 7:00 AM UTC daily</p>
                  <p>✅ Test email sent to both recipients</p>
                  <p className="mt-4 font-semibold">
                    You'll receive daily health reports every morning!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
