
const testSearch = async () => {
    const url = 'http://localhost:3000/api/linkedin/search/simple';
    const payload = {
        search_criteria: {
            saved_search_id: "1965319722",
            keywords: null,
            url: "https://www.linkedin.com/sales/search/people?savedSearchId=1965319722&sessionId=1p0ut%2Bz7QV%2BC4tUXLcwVaQ%3D%3D"
        },
        workspace_id: "babdcab8-1a78-4b2f-913e-6e9fd9821009"
    };

    // TRY AUDIT KEY
    const auditKey = "39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=";
    const dsn = "api6.unipile.com:13670";

    try {
        // Let's test Unipile directly first to see if this key works
        console.log('Testing Unipile API directly with Audit Key...');
        const unipileResponse = await fetch(`https://${dsn}/api/v1/accounts`, {
            headers: {
                'X-API-KEY': auditKey,
                'Accept': 'application/json'
            }
        });

        if (unipileResponse.ok) {
            console.log('✅ Unipile API direct test SUCCESS with Audit Key');
            const data = await unipileResponse.json();
            const accounts = Array.isArray(data) ? data : (data.items || data.accounts || []);
            console.log(`Found ${accounts.length} accounts`);
            console.log('Accounts sample:', JSON.stringify(accounts.slice(0, 2), null, 2));
        } else {
            console.log(`❌ Unipile API direct test FAILED with status ${unipileResponse.status}`);
            const errorText = await unipileResponse.text();
            console.log('Error:', errorText);
        }
    } catch (error) {
        console.error('Direct Unipile test error:', error);
    }
};

testSearch();
