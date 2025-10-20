import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    mcps: {}
  };

  // 1. Google Custom Search Engine (CSE)
  try {
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const googleCseId = process.env.GOOGLE_CSE_ID;
    
    if (googleApiKey && googleCseId) {
      // Test search
      const testUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCseId}&q=test&num=1`;
      const response = await fetch(testUrl);
      const data = await response.json();
      
      results.mcps.google_cse = {
        status: response.ok ? 'functional' : 'error',
        configured: true,
        message: response.ok ? `✅ Google CSE working - found ${data.searchInformation?.totalResults || 0} results` : `❌ Error: ${data.error?.message || 'Unknown'}`,
        test_query: 'test',
        response_time: data.searchInformation?.searchTime
      };
    } else {
      results.mcps.google_cse = {
        status: 'not_configured',
        configured: false,
        message: '⚠️ Missing GOOGLE_API_KEY or GOOGLE_CSE_ID'
      };
    }
  } catch (error) {
    results.mcps.google_cse = {
      status: 'error',
      configured: true,
      message: `❌ Exception: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }

  // 2. Bright Data
  try {
    const brightDataCustomer = process.env.BRIGHT_DATA_CUSTOMER_ID;
    const brightDataZone = process.env.BRIGHT_DATA_ZONE;
    const brightDataPassword = process.env.BRIGHT_DATA_PASSWORD;
    
    console.log('🔍 Bright Data env vars:', {
      customer: brightDataCustomer ? 'SET' : 'MISSING',
      zone: brightDataZone ? 'SET' : 'MISSING',
      password: brightDataPassword ? 'SET' : 'MISSING'
    });
    
    if (brightDataCustomer && brightDataZone && brightDataPassword) {
      results.mcps.bright_data = {
        status: 'configured',
        configured: true,
        message: '✅ Bright Data credentials configured',
        customer_id: brightDataCustomer,
        zone: brightDataZone
      };
    } else {
      results.mcps.bright_data = {
        status: 'not_configured',
        configured: false,
        message: '⚠️ Missing Bright Data credentials (BRIGHT_DATA_CUSTOMER_ID, BRIGHT_DATA_ZONE, BRIGHT_DATA_PASSWORD)'
      };
    }
  } catch (error) {
    results.mcps.bright_data = {
      status: 'error',
      message: `❌ Exception: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }

  // 3. Apify
  try {
    const apifyToken = process.env.APIFY_API_TOKEN;
    
    if (apifyToken) {
      // Test API connection
      const response = await fetch('https://api.apify.com/v2/actor-tasks', {
        headers: {
          'Authorization': `Bearer ${apifyToken}`
        }
      });
      
      const data = await response.json();
      
      results.mcps.apify = {
        status: response.ok ? 'functional' : 'error',
        configured: true,
        message: response.ok ? `✅ Apify API working - ${data.data?.count || 0} tasks found` : `❌ Error: ${data.error || 'Unknown'}`,
        tasks_count: data.data?.count || 0
      };
    } else {
      results.mcps.apify = {
        status: 'not_configured',
        configured: false,
        message: '⚠️ Missing APIFY_API_TOKEN'
      };
    }
  } catch (error) {
    results.mcps.apify = {
      status: 'error',
      configured: true,
      message: `❌ Exception: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }

  // 4. Unipile
  try {
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;
    
    if (unipileDsn && unipileApiKey) {
      // Test API connection
      const response = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
        headers: {
          'X-API-KEY': unipileApiKey,
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      
      results.mcps.unipile = {
        status: response.ok ? 'functional' : 'error',
        configured: true,
        message: response.ok ? `✅ Unipile API working - ${data.items?.length || 0} accounts connected` : `❌ Error: ${response.status} ${response.statusText}`,
        accounts_count: data.items?.length || 0,
        dsn: unipileDsn
      };
    } else {
      results.mcps.unipile = {
        status: 'not_configured',
        configured: false,
        message: '⚠️ Missing UNIPILE_DSN or UNIPILE_API_KEY'
      };
    }
  } catch (error) {
    results.mcps.unipile = {
      status: 'error',
      configured: true,
      message: `❌ Exception: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }

  // Summary
  const configuredCount = Object.values(results.mcps).filter((mcp: any) => mcp.configured).length;
  const functionalCount = Object.values(results.mcps).filter((mcp: any) => mcp.status === 'functional').length;
  
  results.summary = {
    total_mcps: 4,
    configured: configuredCount,
    functional: functionalCount,
    not_configured: 4 - configuredCount,
    overall_status: functionalCount === 4 ? '✅ All MCPs functional' : 
                    functionalCount > 0 ? '⚠️ Some MCPs functional' : 
                    '❌ No MCPs functional'
  };

  return NextResponse.json(results, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}
