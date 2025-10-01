#!/usr/bin/env node

/**
 * Test script for Unipile LinkedIn Search API
 * Searches for 1st and 2nd degree connections
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;

// You need to get your auth token from the browser after logging in
// Or we can use a test user token
const AUTH_TOKEN = process.argv[2]; // Pass as command line argument

async function testLinkedInSearch() {
  console.log('🔍 Testing LinkedIn Search API...\n');
  
  if (!UNIPILE_API_KEY || !UNIPILE_DSN) {
    console.error('❌ Missing Unipile credentials in .env.local');
    console.error('Required: UNIPILE_API_KEY, UNIPILE_DSN');
    process.exit(1);
  }

  if (!AUTH_TOKEN) {
    console.error('❌ Missing auth token');
    console.error('Usage: node scripts/test-linkedin-search.js <YOUR_AUTH_TOKEN>');
    console.error('\nTo get your token:');
    console.error('1. Log in to Sam at localhost:3003');
    console.error('2. Open browser DevTools > Application > Local Storage');
    console.error('3. Find your Supabase auth token');
    process.exit(1);
  }

  try {
    // Search for 1st and 2nd degree connections
    const searchRequest = {
      api: 'classic', // Use classic LinkedIn search
      category: 'people',
      keywords: '', // Empty for general search
      network_distance: [1, 2], // 1st and 2nd degree connections
      limit: 20, // Get 20 results
      profile_language: ['en'] // English profiles
    };

    console.log('📤 Sending search request...');
    console.log('Parameters:', JSON.stringify(searchRequest, null, 2));
    console.log('');

    const response = await fetch(`${API_BASE_URL}/api/linkedin/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify(searchRequest)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Search failed:', response.status);
      console.error('Error:', data);
      
      if (data.action === 'connect_linkedin') {
        console.error('\n💡 You need to connect your LinkedIn account first!');
        console.error('Go to: http://localhost:3003/linkedin-integration');
      }
      
      process.exit(1);
    }

    console.log('✅ Search successful!\n');
    console.log('📊 Results Summary:');
    console.log(`   Total found: ${data.metadata.total_found}`);
    console.log(`   API: ${data.metadata.api}`);
    console.log(`   Category: ${data.metadata.category}`);
    console.log(`   Has more: ${data.metadata.has_more}`);
    console.log('');

    if (data.prospects && data.prospects.length > 0) {
      console.log('👥 Prospects:\n');
      
      data.prospects.forEach((prospect, index) => {
        console.log(`${index + 1}. ${prospect.name}`);
        console.log(`   Title: ${prospect.title || 'N/A'}`);
        console.log(`   Company: ${prospect.company || 'N/A'}`);
        console.log(`   Location: ${prospect.location || 'N/A'}`);
        console.log(`   Connection: ${prospect.connectionDegree}${getConnectionDegreeLabel(prospect.connectionDegree)}`);
        console.log(`   Mutual: ${prospect.mutualConnections || 0} mutual connections`);
        console.log(`   Confidence: ${(prospect.confidence * 100).toFixed(0)}%`);
        console.log(`   LinkedIn: ${prospect.linkedinUrl || 'N/A'}`);
        console.log('');
      });

      // Stats
      const firstDegree = data.prospects.filter(p => p.connectionDegree === 1);
      const secondDegree = data.prospects.filter(p => p.connectionDegree === 2);
      
      console.log('📈 Connection Breakdown:');
      console.log(`   1st degree: ${firstDegree.length}`);
      console.log(`   2nd degree: ${secondDegree.length}`);
      console.log('');

      // Top companies
      const companies = data.prospects
        .map(p => p.company)
        .filter(Boolean)
        .reduce((acc, company) => {
          acc[company] = (acc[company] || 0) + 1;
          return acc;
        }, {});
      
      const topCompanies = Object.entries(companies)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      if (topCompanies.length > 0) {
        console.log('🏢 Top Companies:');
        topCompanies.forEach(([company, count]) => {
          console.log(`   ${company}: ${count} connections`);
        });
        console.log('');
      }

      // Export to JSON
      const fs = await import('fs');
      const exportPath = './linkedin-search-results.json';
      fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
      console.log(`💾 Full results saved to: ${exportPath}`);
      
    } else {
      console.log('⚠️  No prospects found');
    }

    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

function getConnectionDegreeLabel(degree) {
  switch (degree) {
    case 1: return 'st degree (direct connection)';
    case 2: return 'nd degree (friend of friend)';
    case 3: return 'rd degree';
    default: return 'th degree';
  }
}

// Run the test
testLinkedInSearch();
