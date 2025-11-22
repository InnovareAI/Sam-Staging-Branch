#!/usr/bin/env node

/**
 * Test script to send an email via Unipile API
 * Usage: node scripts/js/test-send-email.mjs
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA'; // Irish account

if (!UNIPILE_API_KEY) {
  console.error('❌ UNIPILE_API_KEY not set in .env.local');
  process.exit(1);
}

console.log('📧 Test Email Send via Unipile API');
console.log('===================================');
console.log(`DSN: ${UNIPILE_DSN}`);
console.log(`Account ID: ${ACCOUNT_ID}`);

/**
 * Step 1: Get email accounts to find MAIL provider
 */
async function getEmailAccounts() {
  console.log('\n📋 Step 1: Fetching email accounts...');
  try {
    const response = await fetch(`https://${UNIPILE_DSN}/api/v1/accounts/${ACCOUNT_ID}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to fetch accounts:', response.status, error);
      return null;
    }

    const data = await response.json();
    console.log('✅ Account data retrieved');

    // Check for MAIL type account (email/IMAP)
    const emailAccounts = data.items?.filter((acc) => acc.type === 'MAIL') || [];
    console.log(`Found ${emailAccounts.length} email account(s):`);
    emailAccounts.forEach((acc) => {
      console.log(`  - ${acc.name} (${acc.id})`);
      if (acc.connection_params) {
        console.log(`    IMAP: ${acc.connection_params.imap?.host}`);
        console.log(`    SMTP: ${acc.connection_params.smtp?.host}`);
      }
    });

    return emailAccounts;
  } catch (error) {
    console.error('❌ Error fetching accounts:', error.message);
    return null;
  }
}

/**
 * Step 2: Send a test email
 */
async function sendTestEmail(emailAccount) {
  console.log('\n📤 Step 2: Sending test email...');

  const recipientEmail = 'test@example.com'; // Change to real test email
  const subject = 'Test Email from SAM';
  const body = 'This is a test email sent via Unipile API to verify email sending works.';

  try {
    const response = await fetch(`https://${UNIPILE_DSN}/api/v1/messages`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        account_id: emailAccount.id,
        type: 'email',
        email: {
          to: [{ email: recipientEmail }],
          subject: subject,
          text: body,
          html: `<p>${body}</p>`
        }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      console.error('❌ Failed to send email:', response.status);
      console.error('Error details:', error);
      return false;
    }

    const result = await response.json();
    console.log('✅ Email sent successfully!');
    console.log(`Message ID: ${result.id || result.message_id}`);
    console.log(`To: ${recipientEmail}`);
    console.log(`Subject: ${subject}`);

    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    return false;
  }
}

/**
 * Step 3: Check message status
 */
async function checkMessageStatus(messageId) {
  console.log(`\n✅ Step 3: Checking message status...`);

  try {
    const response = await fetch(`https://${UNIPILE_DSN}/api/v1/messages/${messageId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('⚠️ Could not fetch message status:', response.status);
      return;
    }

    const message = await response.json();
    console.log('Message Status:', message.status || 'unknown');
    console.log('Sent At:', message.sent_at);
  } catch (error) {
    console.warn('⚠️ Could not check status:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const emailAccounts = await getEmailAccounts();

    if (!emailAccounts || emailAccounts.length === 0) {
      console.error('❌ No email accounts found. Please add an email account first.');
      console.log('\nSteps to add email account:');
      console.log('1. Go to Settings → Email Integration');
      console.log('2. Click "Connect IMAP"');
      console.log('3. Complete Unipile hosted auth flow');
      console.log('4. Then run this script again');
      process.exit(1);
    }

    const emailAccount = emailAccounts[0];
    console.log(`\nUsing account: ${emailAccount.name}`);

    const sent = await sendTestEmail(emailAccount);

    if (sent) {
      console.log('\n✨ Test email sent successfully!');
      console.log('\nNext steps:');
      console.log('1. Check your inbox for the test email');
      console.log('2. Verify it arrived correctly');
      console.log('3. Create an email campaign and test with real prospects');
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

main();
