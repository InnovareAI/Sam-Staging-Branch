/**
 * Verify N8N Payload Structure
 * This script intercepts the N8N payload to verify messages.cr field is present
 */

// Mock N8N webhook endpoint
const http = require('http');

const PORT = 8888;

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);

        console.log('\n📦 N8N PAYLOAD RECEIVED:\n');
        console.log('Campaign ID:', payload.campaignId);
        console.log('Campaign Name:', payload.campaignName);
        console.log('Workspace ID:', payload.workspaceId);
        console.log('Unipile Account ID:', payload.unipileAccountId);
        console.log('Prospects Count:', payload.prospects?.length || 0);

        console.log('\n📧 MESSAGES OBJECT:');
        console.log(JSON.stringify(payload.messages, null, 2));

        console.log('\n🔍 FIELD VERIFICATION:');
        console.log('✅ messages.cr:', payload.messages?.cr ? 'PRESENT' : '❌ MISSING');
        console.log('✅ messages.connection_request:', payload.messages?.connection_request ? 'PRESENT' : '❌ MISSING');
        console.log('✅ messages.follow_up_1:', payload.messages?.follow_up_1 ? 'PRESENT' : '⚠️  MISSING (optional)');
        console.log('✅ messages.follow_up_2:', payload.messages?.follow_up_2 ? 'PRESENT' : '⚠️  MISSING (optional)');

        console.log('\n📋 FIRST PROSPECT:');
        if (payload.prospects && payload.prospects.length > 0) {
          const firstProspect = payload.prospects[0];
          console.log('Name:', `${firstProspect.first_name} ${firstProspect.last_name}`);
          console.log('LinkedIn URL:', firstProspect.linkedin_url);
          console.log('Flow Settings:', firstProspect.flow_settings ? 'PRESENT' : 'MISSING');
        }

        console.log('\n🎯 FLOW SETTINGS:');
        console.log(JSON.stringify(payload.flow_settings, null, 2));

        // Send successful response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          executionId: 'test-' + Date.now(),
          message: 'Payload verified successfully'
        }));

        console.log('\n✅ VERIFICATION COMPLETE\n');

      } catch (error) {
        console.error('❌ Error parsing payload:', error.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });

  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
});

server.listen(PORT, () => {
  console.log(`🔍 Mock N8N Webhook Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('SETUP INSTRUCTIONS:');
  console.log('1. Update .env.local:');
  console.log(`   N8N_CAMPAIGN_WEBHOOK_URL=http://localhost:${PORT}/webhook`);
  console.log('2. Restart your Next.js dev server');
  console.log('3. Run the test script: node scripts/test-messages-cr-fix.js');
  console.log('');
  console.log('Waiting for requests...\n');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down mock server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
