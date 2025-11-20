#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

async function sendDirectToUnipile() {
    console.log('\n🚀 Sending connection request DIRECTLY to Unipile (bypassing N8N)...\n');

    const UNIPILE_DSN = process.env.UNIPILE_DSN;
    const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
    const UNIPILE_ACCOUNT_ID = '4nt1J-blSnGUPBjH2Nfjpg'; // Charissa

    // Use Frederic Bastien
    const linkedinUsername = 'fbastien';
    const firstName = 'Frederic';
    const companyName = 'Untether AI';

    const message = `Hi ${firstName},

I work with early-stage founders on scaling outbound without burning time or budget on traditional sales hires. Saw that you're building ${companyName} and thought it might be worth connecting.

Open to it?`;

    console.log('   LinkedIn username:', linkedinUsername);
    console.log('   Unipile Account:', UNIPILE_ACCOUNT_ID);
    console.log('   Message preview:', message.substring(0, 100) + '...');

    const url = `https://${UNIPILE_DSN}/api/v1/users/invite`;
    console.log('\n   URL:', url);

    const payload = {
        account_id: UNIPILE_ACCOUNT_ID,
        provider_id: linkedinUsername,
        text: message
    };

    console.log('\n   Payload:', JSON.stringify(payload, null, 2));

    try {
        console.log('\n📤 Sending request...');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-API-KEY': UNIPILE_API_KEY,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        console.log('\n📊 Response:');
        console.log('   Status:', response.status);
        console.log('   Data:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('\n✅ SUCCESS! Connection request sent via Unipile');
            console.log('\n🎉 Check Charissa\'s LinkedIn now for pending connection to Frederic Bastien');
        } else {
            console.log('\n❌ FAILED - Unipile returned error');
        }

    } catch (error) {
        console.log('\n❌ Request failed:', error.message);
    }
}

sendDirectToUnipile();
