/**
 * Test script to verify connection degree filtering
 *
 * Run with: npx tsx temp/test-connection-degree.ts
 */

const testConnectionDegree = async () => {
  console.log('🧪 Testing Connection Degree Filter\n');

  // Test different connection degrees
  const tests = [
    { degree: '1st', expected: [1] },
    { degree: '2nd', expected: [2] },
    { degree: '3rd', expected: [3] },
    { degree: '1', expected: [1] },
    { degree: '2', expected: [2] },
    { degree: '3', expected: [3] },
  ];

  for (const test of tests) {
    console.log(`\n📌 Test: connectionDegree = "${test.degree}"`);

    const searchCriteria = {
      title: 'CEO',
      keywords: 'tech startup',
      connectionDegree: test.degree,
      targetCount: 5
    };

    try {
      const response = await fetch('http://localhost:3000/api/linkedin/search/simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // You'll need to add your auth cookie here
        },
        body: JSON.stringify({
          search_criteria: searchCriteria,
          target_count: 5
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log(`✅ Found ${data.count} prospects`);
        console.log(`   API used: ${data.api}`);

        // Check actual connection degrees returned
        const degrees = data.prospects.map((p: any) => p.connectionDegree);
        const uniqueDegrees = [...new Set(degrees)];
        console.log(`   Connection degrees in results: ${uniqueDegrees.join(', ')}`);

        if (uniqueDegrees.length === 1 && uniqueDegrees[0] === test.expected[0]) {
          console.log(`   ✅ PASS: All prospects match requested degree`);
        } else {
          console.log(`   ❌ FAIL: Expected ${test.expected[0]}, got ${uniqueDegrees.join(', ')}`);
        }
      } else {
        console.log(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error(`❌ Request failed:`, error);
    }
  }
};

testConnectionDegree();
