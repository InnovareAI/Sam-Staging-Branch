
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

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Auth': 'true',
                'X-User-Id': 'f6885ff3-deef-4781-8721-93011c990b1b', // Real user ID
                'X-Workspace-Id': 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Fetch error:', error);
    }
};

testSearch();
