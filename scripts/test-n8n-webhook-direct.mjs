#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

async function testWebhook() {
    console.log('\n🧪 Testing N8N webhook directly...\n');

    const webhookUrl = 'https://workflows.innovareai.com/webhook/connector-campaign';

    const testPayload = {
        workspaceId: '7f0341da-88db-476b-ae0a-fc0da5b70861',
        campaignId: '3326aa89-9220-4bef-a1db-9c54f14fc536',
        channel: 'linkedin',
        campaignType: 'connector',
        unipileAccountId: '4nt1J-blSnGUPBjH2Nfjpg',
        linkedin_username: 'nima-aryan-974b16120',
        prospects: [{
            id: '727bd59c-6ca0-4ccd-b784-03d28f52b797',
            first_name: 'Nima',
            last_name: 'Aryan',
            linkedin_url: 'http://www.linkedin.com/in/nima-aryan-974b16120',
            company_name: 'Compass',
            title: 'Founding Engineer',
            send_delay_minutes: 0
        }],
        messages: {
            connection_request: 'Hi {first_name}, test message',
            cr: 'Hi {first_name}, test message'
        },
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        unipile_dsn: process.env.UNIPILE_DSN,
        unipile_api_key: process.env.UNIPILE_API_KEY
    };

    console.log(`   Webhook URL: ${webhookUrl}`);
    console.log(`   Payload prospect: ${testPayload.prospects[0].first_name} ${testPayload.prospects[0].last_name}\n`);
    console.log('📤 Sending webhook...\n');

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify(testPayload)
        });

        console.log(`📊 Response:`);
        console.log(`   Status: ${response.status} ${response.statusText}`);
        console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log(`   Body: ${responseText || '(empty)'}\n`);

        if (response.ok) {
            console.log('✅ Webhook received by N8N!');
            console.log('\n🔍 Check N8N executions page for new execution');
        } else {
            console.log('❌ Webhook rejected');
        }

    } catch (error) {
        console.log(`❌ Webhook failed: ${error.message}`);
    }
}

testWebhook();
