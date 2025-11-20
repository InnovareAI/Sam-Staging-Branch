#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

async function testUnipileDirectly() {
    console.log('\n🔍 Testing Unipile API directly...\n');

    const UNIPILE_DSN = process.env.UNIPILE_DSN;
    const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
    const UNIPILE_ACCOUNT_ID = '4nt1J-blSnGUPBjH2Nfjpg'; // Charissa's account

    console.log('   UNIPILE_DSN:', UNIPILE_DSN);
    console.log('   API Key:', UNIPILE_API_KEY ? 'Set ✓' : 'Missing ✗');
    console.log('   Account ID:', UNIPILE_ACCOUNT_ID);

    if (!UNIPILE_DSN || !UNIPILE_API_KEY) {
        console.log('\n❌ Missing environment variables!');
        return;
    }

    // Test 1: Check account status
    console.log('\n📋 Test 1: Check Charissa\'s LinkedIn account status');
    const accountUrl = `https://${UNIPILE_DSN}/api/v1/accounts/${UNIPILE_ACCOUNT_ID}`;

    try {
        const response = await fetch(accountUrl, {
            headers: {
                'X-API-KEY': UNIPILE_API_KEY,
                'accept': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log('   ✅ Account found');
            console.log('   Name:', data.name);
            console.log('   Provider:', data.provider);
            console.log('   Status:', data.status);
        } else {
            console.log('   ❌ Error:', data);
        }
    } catch (error) {
        console.log('   ❌ Request failed:', error.message);
    }

    // Test 2: Send a test invitation to Alexander W.
    console.log('\n📋 Test 2: Send connection request to Alexander W. via Unipile API');
    console.log('   LinkedIn: http://www.linkedin.com/in/awtjiang');

    const inviteUrl = `https://${UNIPILE_DSN}/api/v1/users/invite`;
    const invitePayload = {
        account_id: UNIPILE_ACCOUNT_ID,
        provider_id: 'http://www.linkedin.com/in/awtjiang',
        text: 'Hi Alexander, I\'d love to connect with you! - Charissa'
    };

    try {
        const response = await fetch(inviteUrl, {
            method: 'POST',
            headers: {
                'X-API-KEY': UNIPILE_API_KEY,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify(invitePayload)
        });

        const data = await response.json();

        console.log('   Response status:', response.status);

        if (response.ok) {
            console.log('   ✅ Connection request sent!');
            console.log('   Invitation ID:', data.id);
            console.log('   Status:', data.status);
            console.log('\n   🎉 CHECK CHARISSA\'S LINKEDIN NOW - should see pending connection to Alexander W.');
        } else {
            console.log('   ❌ Failed to send');
            console.log('   Error:', JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.log('   ❌ Request failed:', error.message);
    }
}

testUnipileDirectly();
