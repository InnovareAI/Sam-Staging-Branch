
import fs from 'fs';
import path from 'path';

async function testCsvUpload() {
    const url = 'http://localhost:3000/api/prospect-approval/upload-csv';
    const filePath = './test-import-complex.csv';
    const fileContent = fs.readFileSync(filePath);
    const blob = new Blob([fileContent], { type: 'text/csv' });

    // Built-in FormData in Node 22
    const formData = new FormData();
    formData.append('file', blob, 'test-import-complex.csv');
    formData.append('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009');
    formData.append('campaign_name', 'Test Complex CSV Import');
    formData.append('source', 'test-script');

    console.log('🚀 Sending CSV upload request...');

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-Internal-Auth': 'true',
                'X-User-Id': 'f6885ff3-deef-4781-8721-93011c990b1b' // Thorsten's user ID
            },
            body: formData
        });

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(data, null, 2));

        if (response.ok && data.success) {
            console.log('✅ CSV Upload SUCCESS');
            console.log(`📊 Count: ${data.count}`);
            console.log(`⚠️ Skipped: ${data.skipped_count}`);
        } else {
            console.log('❌ CSV Upload FAILED');
        }
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

testCsvUpload();
