import { config } from 'dotenv';
import nodeFetch from 'node-fetch';

// Load env vars
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appo6ZgNqEWLtw66q';
const LINKEDIN_TABLE_ID = process.env.LINKEDIN_TABLE_ID || 'tblMqDWVazMY1TD1l';

if (!AIRTABLE_API_KEY) {
    console.error('❌ AIRTABLE_API_KEY not found in environment');
    process.exit(1);
}

const headers = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
};

async function createField(tableId, fieldName, type = 'singleLineText') {
    console.log(`🔨 Creating field "${fieldName}" in table ${tableId}...`);
    const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${tableId}/fields`;

    const response = await nodeFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            name: fieldName,
            type: type
        })
    });

    const data = await response.json();
    if (response.ok) {
        console.log(`✅ Field "${fieldName}" created successfully!`);
        return data;
    } else {
        if (data.error?.type === 'DUPLICATE_COLUMN_NAME') {
            console.log(`ℹ️ Field "${fieldName}" already exists.`);
            return null;
        }
        console.error(`❌ Failed to create field "${fieldName}":`, JSON.stringify(data, null, 2));
        return null;
    }
}

async function createEmailsTable() {
    console.log(`🔨 Creating "Interested Leads Emails 2025" table...`);
    const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

    const tableDef = {
        name: 'Interested Leads Emails 2025',
        description: 'Email leads captured by SAM',
        fields: [
            { name: 'Email', type: 'email' },
            { name: 'Name of Interested Leads', type: 'singleLineText' },
            { name: 'Date', type: 'date', options: { dateFormat: { name: 'iso' } } },
            { name: 'Email Domain', type: 'singleLineText' },
            { name: 'Campaign Name', type: 'singleLineText' },
            { name: 'Message', type: 'multilineText' },
            { name: 'Status', type: 'singleLineText' },
            { name: 'Country', type: 'singleLineText' },
            { name: 'Industry', type: 'singleLineText' },
            { name: 'Company Size', type: 'singleLineText' }
        ]
    };

    const response = await nodeFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(tableDef)
    });

    const data = await response.json();
    if (response.ok) {
        console.log(`✅ Table "Interested Leads Emails 2025" created successfully!`);
        console.log(`📋 Table ID: ${data.id}`);
        return data.id;
    } else {
        console.error('❌ Failed to create table:', JSON.stringify(data, null, 2));
        return null;
    }
}

async function createContactsTable() {
    console.log(`🔨 Creating "Contacts" table...`);
    const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

    const tableDef = {
        name: 'Contacts',
        description: 'Master contacts list for all prospects',
        fields: [
            { name: 'Name', type: 'singleLineText' },
            { name: 'Email', type: 'email' },
            { name: 'Profile URL', type: 'url' },
            { name: 'Job Title', type: 'singleLineText' },
            { name: 'Company Name', type: 'singleLineText' },
            { name: 'Industry', type: 'singleLineText' },
            { name: 'Country', type: 'singleLineText' },
            { name: 'Company Size', type: 'singleLineText' },
            { name: 'Source', type: 'singleSelect', options: { choices: [{ name: 'LinkedIn' }, { name: 'Email' }, { name: 'Manual' }] } },
            { name: 'Status', type: 'singleLineText' },
            { name: 'Date Added', type: 'date', options: { dateFormat: { name: 'iso' } } },
            { name: 'Last Interaction', type: 'dateTime', options: { dateFormat: { name: 'iso' }, timeFormat: { name: '24hour' }, timeZone: 'utc' } }
        ]
    };

    const response = await nodeFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(tableDef)
    });

    const data = await response.json();
    if (response.ok) {
        console.log(`✅ Table "Contacts" created successfully!`);
        console.log(`📋 Table ID: ${data.id}`);
        return data.id;
    } else {
        if (data.error?.type === 'DUPLICATE_TABLE_NAME') {
            console.log('ℹ️ Table "Contacts" already exists.');
            return null;
        }
        console.error('❌ Failed to create Contacts table:', JSON.stringify(data, null, 2));
        return null;
    }
}

async function run() {
    console.log('🚀 Starting Airtable schema automation...');
    console.log(`📊 Base ID: ${AIRTABLE_BASE_ID}`);

    // 1. Create Company Size field in LinkedIn table
    await createField(LINKEDIN_TABLE_ID, 'Company Size');

    // 2. Create Emails table
    const emailTableId = await createEmailsTable();
    if (emailTableId) {
        console.log(`\nNext Step: Run "netlify env:set EMAIL_TABLE_ID ${emailTableId}"`);
    }

    // 3. Create Contacts table
    const contactsTableId = await createContactsTable();
    if (contactsTableId) {
        console.log(`\nNext Step: Run "netlify env:set CONTACTS_TABLE_ID ${contactsTableId}"`);
    }

    console.log('\n✨ Automation complete!');
}

run().catch(console.error);
