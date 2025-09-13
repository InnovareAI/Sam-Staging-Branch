#!/usr/bin/env node

/**
 * Test WebSearch MCP Integration
 * Tests the complete Boolean LinkedIn search and ICP research workflow
 */

import https from 'https';
import fs from 'fs';

const API_BASE = 'http://localhost:3000';

// Test data for various search scenarios
const testCases = [
  {
    name: 'Boolean LinkedIn Search - VP Sales SaaS',
    endpoint: '/api/sam/prospect-intelligence',
    data: {
      type: 'boolean_linkedin_search',
      data: {
        query: '"VP Sales" OR "Director Sales" SaaS "Series B" site:linkedin.com/in/',
        maxResults: 10,
        includeSnippets: true
      },
      methodology: 'meddic',
      urgency: 'medium',
      budget: 50
    }
  },
  {
    name: 'Company Intelligence Research - TechCorp',
    endpoint: '/api/sam/prospect-intelligence', 
    data: {
      type: 'company_intelligence_search',
      data: {
        companyName: 'TechCorp',
        searchType: 'overview',
        maxResults: 10
      },
      methodology: 'challenger'
    }
  },
  {
    name: 'ICP Research - Healthcare IT Directors',
    endpoint: '/api/sam/prospect-intelligence',
    data: {
      type: 'icp_research_search',
      data: {
        industry: 'Healthcare',
        jobTitles: ['IT Director', 'CTO', 'VP Technology'],
        companySize: 'medium',
        geography: 'United States',
        maxResults: 15
      },
      methodology: 'spin',
      urgency: 'high',
      budget: 100
    }
  },
  {
    name: 'Technology Stack Research',
    endpoint: '/api/sam/prospect-intelligence',
    data: {
      type: 'company_intelligence_search',
      data: {
        companyName: 'DataWorks Inc',
        searchType: 'technology',
        maxResults: 5
      },
      methodology: 'meddic'
    }
  },
  {
    name: 'Manufacturing ICP Analysis',
    endpoint: '/api/sam/prospect-intelligence',
    data: {
      type: 'icp_research_search',
      data: {
        industry: 'Manufacturing',
        jobTitles: ['Operations Director', 'Plant Manager', 'VP Operations'],
        companySize: 'enterprise',
        geography: 'United States',
        maxResults: 20
      },
      methodology: 'challenger',
      urgency: 'low',
      budget: 75
    }
  }
];

// Test SAM Chat integration
const chatTestCases = [
  {
    name: 'SAM Chat - Boolean Search Request',
    endpoint: '/api/sam/chat',
    data: {
      message: "Can you help me find VP Sales at SaaS companies in California? I need Boolean search for LinkedIn prospecting.",
      conversationHistory: []
    }
  },
  {
    name: 'SAM Chat - Company Research Request', 
    endpoint: '/api/sam/chat',
    data: {
      message: "I need to research Salesforce - their technology stack, recent news, and competitive positioning. Can you pull some intelligence on them?",
      conversationHistory: [
        { role: 'assistant', content: 'Hi there! How\'s your day going? Busy morning or a bit calmer?' },
        { role: 'user', content: 'Pretty busy, lots of prospecting to do!' }
      ]
    }
  },
  {
    name: 'SAM Chat - ICP Research Request',
    endpoint: '/api/sam/chat',
    data: {
      message: "I'm targeting Healthcare IT decision makers. Can you research the market for CTOs and IT Directors at mid-size healthcare companies?",
      conversationHistory: [
        { role: 'assistant', content: 'Great to hear. I\'m Sam, and I\'m here to automate your prospecting headaches.' },
        { role: 'user', content: 'I sell cybersecurity software to healthcare companies' }
      ]
    }
  }
];

function makeRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WebSearch Integration Test'
      }
    };

    const req = https.request(`${API_BASE}${endpoint}`, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            data: parsed
          });
        } catch (err) {
          resolve({
            statusCode: res.statusCode,
            data: responseData
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runTest(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`📡 Endpoint: ${testCase.endpoint}`);
  console.log(`📊 Data:`, JSON.stringify(testCase.data, null, 2));
  
  try {
    const result = await makeRequest('POST', testCase.endpoint, testCase.data);
    
    console.log(`📈 Status: ${result.statusCode}`);
    
    if (result.statusCode === 200 || result.statusCode === 201) {
      console.log('✅ SUCCESS');
      
      // Analyze response for key components
      if (result.data && result.data.success) {
        console.log(`⏱️  Processing Time: ${result.data.metadata?.processingTime || 'N/A'}ms`);
        console.log(`🎯 Confidence: ${result.data.metadata?.confidence || 'N/A'}`);
        console.log(`💰 Cost Estimate: ${result.data.metadata?.costEstimate || 'N/A'}`);
        console.log(`🔍 Source: ${result.data.metadata?.source || 'N/A'}`);
        
        // Check for specific data types
        if (result.data.data) {
          const data = result.data.data;
          
          if (data.results && Array.isArray(data.results)) {
            console.log(`📋 Found ${data.results.length} results`);
          }
          
          if (data.prospects && Array.isArray(data.prospects)) {
            console.log(`👥 Found ${data.prospects.length} prospects`);
          }
          
          if (data.marketSize) {
            console.log(`📊 Market Size: ${data.marketSize.totalMarket || 'N/A'}`);
          }
          
          if (data.intelligence) {
            console.log(`🧠 Intelligence Type: ${Object.keys(data.intelligence).join(', ')}`);
          }
        }
      } else {
        console.log('⚠️  Response indicates failure:', result.data.error || 'Unknown error');
      }
    } else {
      console.log(`❌ FAILED with status ${result.statusCode}`);
      console.log('Response:', result.data);
    }
    
  } catch (error) {
    console.log('💥 ERROR:', error.message);
  }
  
  console.log('─'.repeat(80));
}

async function runChatTest(testCase) {
  console.log(`\n💬 Testing SAM Chat: ${testCase.name}`);
  console.log(`🎯 Message: "${testCase.data.message}"`);
  
  try {
    const result = await makeRequest('POST', testCase.endpoint, testCase.data);
    
    console.log(`📈 Status: ${result.statusCode}`);
    
    if (result.statusCode === 200) {
      console.log('✅ SUCCESS');
      
      if (result.data && result.data.content) {
        const response = result.data.content;
        console.log(`💬 SAM Response (${response.length} chars):`);
        console.log(response.substring(0, 300) + (response.length > 300 ? '...' : ''));
        
        // Check if SAM mentions research capabilities
        const mentions = [
          'research',
          'search', 
          'Boolean',
          'LinkedIn',
          'intelligence',
          'prospects',
          'ICP',
          'market'
        ].filter(keyword => response.toLowerCase().includes(keyword.toLowerCase()));
        
        if (mentions.length > 0) {
          console.log(`🎯 Research Keywords Found: ${mentions.join(', ')}`);
        }
      }
    } else {
      console.log(`❌ FAILED with status ${result.statusCode}`);
      console.log('Response:', result.data);
    }
    
  } catch (error) {
    console.log('💥 ERROR:', error.message);
  }
  
  console.log('─'.repeat(80));
}

async function runAllTests() {
  console.log('🚀 Starting WebSearch MCP Integration Tests');
  console.log('=' .repeat(80));
  
  // Test Prospect Intelligence API
  console.log('\n📊 TESTING PROSPECT INTELLIGENCE API');
  console.log('=' .repeat(80));
  
  for (const testCase of testCases) {
    await runTest(testCase);
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Test SAM Chat Integration
  console.log('\n💬 TESTING SAM CHAT INTEGRATION');
  console.log('=' .repeat(80));
  
  for (const testCase of chatTestCases) {
    await runChatTest(testCase);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🎉 All tests completed!');
  
  // Save test results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = `websearch-test-results-${timestamp}.json`;
  
  const summary = {
    timestamp: new Date().toISOString(),
    testCount: testCases.length + chatTestCases.length,
    prospectIntelligenceTests: testCases.length,
    chatIntegrationTests: chatTestCases.length,
    note: 'WebSearch MCP Integration Test Results'
  };
  
  fs.writeFileSync(logFile, JSON.stringify(summary, null, 2));
  console.log(`📝 Test summary saved to: ${logFile}`);
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests, testCases, chatTestCases };