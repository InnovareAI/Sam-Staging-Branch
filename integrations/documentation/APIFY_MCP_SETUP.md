# Apify MCP Integration Guide for SAM AI

## 🌟 Overview

Apify MCP provides high-volume LinkedIn data scraping and enrichment capabilities for SAM AI. While Unipile handles real-time messaging and basic data collection, Apify specializes in large-scale profile scraping, people search, and company research.

## 💡 Strategic Role

**Apify = Supplementary Data Intelligence Layer**
- **Primary Integration**: Unipile (real-time messaging, basic profiles)
- **Supplementary Power**: Apify (bulk scraping, advanced search, data enrichment)

## 🚀 Use Cases

### 1. **Bulk Lead Generation**
- Search LinkedIn for 500+ prospects by job title, company, location
- Scrape complete profiles including contact information
- Research entire company employee lists

### 2. **Data Enrichment**
- Enhance existing leads with full LinkedIn profiles
- Collect recent posts and activity
- Extract skills, endorsements, and connections

### 3. **Market Research**
- Analyze competitor employee profiles
- Research industry trends and job movements
- Build comprehensive prospect databases

## 🔧 Installation & Configuration

### 1. Apify Account Setup
1. Sign up at [apify.com](https://apify.com)
2. Choose plan based on volume:
   - **Free**: 10,000 records/month
   - **Personal**: $49/month for 100,000 records
   - **Team**: $149/month for 500,000 records

### 2. Environment Configuration

Add to your `.env.local` file:
```env
# Apify Configuration
APIFY_API_TOKEN=apify_api_your_token_here
APIFY_LINKEDIN_SCRAPER_ID=apify/linkedin-profile-scraper
APIFY_PEOPLE_SEARCH_ID=apify/linkedin-people-search
APIFY_SALES_NAVIGATOR_ID=apify/linkedin-sales-navigator-scraper
APIFY_COMPANY_SCRAPER_ID=apify/linkedin-company-scraper

# Scraping Configuration
APIFY_PROXY_GROUP=RESIDENTIAL
APIFY_PROXY_COUNTRY=US
APIFY_MAX_CONCURRENT_RUNS=3
```

### 3. Supabase Environment Variables

Add to Supabase Dashboard → Project Settings → Edge Functions:
```env
APIFY_API_TOKEN=apify_api_your_token_here
APIFY_CUSTOMER_ID=your_apify_customer_id
```

## 🚀 SAM AI Integration

### 1. Apify Service Integration

Create `/lib/services/apify-scraping.ts`:
```typescript
interface ScrapingConfig {
  account_id: string;
  scraping_type: 'profile_scraping' | 'people_search' | 'company_research' | 'sales_navigator';
  settings?: {
    include_contact_info?: boolean;
    include_recent_posts?: boolean;
    proxy_country?: string;
    max_results?: number;
  };
}

export class ApifyScrapingService {
  private apiToken = process.env.APIFY_API_TOKEN!;
  private baseUrl = 'https://api.apify.com/v2';

  async scrapeLinkedInProfiles(urls: string[], config: ScrapingConfig) {
    const actorId = process.env.APIFY_LINKEDIN_SCRAPER_ID!;
    
    const runInput = {
      urls: urls,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: [config.settings?.proxy_country?.toUpperCase() || 'RESIDENTIAL'],
        apifyProxyCountry: config.settings?.proxy_country || 'US'
      },
      includeContactInfo: config.settings?.include_contact_info || true,
      includeRecentPosts: config.settings?.include_recent_posts || false
    };

    try {
      // Start the actor run
      const runResponse = await fetch(`${this.baseUrl}/acts/${actorId}/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(runInput)
      });

      const run = await runResponse.json();
      
      // Wait for completion and get results
      return await this.waitForResults(run.data.id, config);
    } catch (error) {
      console.error('Apify scraping failed:', error);
      throw error;
    }
  }

  async searchLinkedInPeople(searchCriteria: {
    keywords: string;
    locations?: string[];
    industries?: string[];
    company_sizes?: string[];
    seniority_levels?: string[];
    max_results?: number;
  }, config: ScrapingConfig) {
    const actorId = process.env.APIFY_PEOPLE_SEARCH_ID!;
    
    const runInput = {
      ...searchCriteria,
      maxResults: searchCriteria.max_results || 100,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    };

    const runResponse = await fetch(`${this.baseUrl}/acts/${actorId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(runInput)
    });

    const run = await runResponse.json();
    return await this.waitForResults(run.data.id, config);
  }

  async researchCompanyEmployees(companies: string[], config: ScrapingConfig) {
    const actorId = process.env.APIFY_COMPANY_SCRAPER_ID!;
    
    const runInput = {
      currentCompanies: companies,
      includeEmployees: true,
      maxEmployees: config.settings?.max_results || 50,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    };

    const runResponse = await fetch(`${this.baseUrl}/acts/${actorId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(runInput)
    });

    const run = await runResponse.json();
    return await this.waitForResults(run.data.id, config);
  }

  private async waitForResults(runId: string, config: ScrapingConfig) {
    const maxAttempts = 60; // 10 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`${this.baseUrl}/actor-runs/${runId}`, {
        headers: { 'Authorization': `Bearer ${this.apiToken}` }
      });
      
      const status = await statusResponse.json();
      
      if (status.data.status === 'SUCCEEDED') {
        // Get the results
        const resultsResponse = await fetch(`${this.baseUrl}/datasets/${status.data.defaultDatasetId}/items`, {
          headers: { 'Authorization': `Bearer ${this.apiToken}` }
        });
        
        const results = await resultsResponse.json();
        
        // Store results in database
        await this.storeScrapingResults(results, config, {
          run_id: runId,
          cost: this.calculateCost(status.data),
          processing_time: status.data.finishedAt ? 
            new Date(status.data.finishedAt).getTime() - new Date(status.data.startedAt).getTime() : 0
        });
        
        return results;
      }
      
      if (status.data.status === 'FAILED') {
        throw new Error(`Apify run failed: ${status.data.statusMessage}`);
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 10000));
      attempts++;
    }
    
    throw new Error('Apify run timeout');
  }

  private async storeScrapingResults(results: any[], config: ScrapingConfig, metadata: any) {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    for (const result of results) {
      await supabase
        .from('apify_scraped_data')
        .insert({
          account_id: config.account_id,
          scraping_type: config.scraping_type,
          profile_url: result.url,
          profile_data: result,
          scraping_quality_score: this.calculateQualityScore(result),
          scraping_cost: metadata.cost / results.length,
          processing_time_ms: metadata.processing_time,
          apify_run_id: metadata.run_id
        });
    }
  }

  private calculateCost(runData: any): number {
    // Apify charges per compute unit hour (~$0.25/hour)
    const computeUnits = runData.stats?.computeUnits || 0;
    return computeUnits * 0.25;
  }

  private calculateQualityScore(profile: any): number {
    let score = 0.5; // Base score
    
    if (profile.email) score += 0.2;
    if (profile.phone) score += 0.1;
    if (profile.experience?.length > 0) score += 0.1;
    if (profile.skills?.length > 5) score += 0.05;
    if (profile.connections > 100) score += 0.05;
    
    return Math.min(score, 1.0);
  }
}
```

### 2. API Routes Integration

Create `/app/api/integrations/apify/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ApifyScrapingService } from '@/lib/services/apify-scraping';

export async function POST(req: NextRequest) {
  try {
    const { account_id, scraping_type, search_criteria, profile_urls, companies, settings } = await req.json();
    
    const apifyService = new ApifyScrapingService();
    let results;

    switch (scraping_type) {
      case 'profile_scraping':
        results = await apifyService.scrapeLinkedInProfiles(profile_urls, {
          account_id,
          scraping_type,
          settings
        });
        break;
        
      case 'people_search':
        results = await apifyService.searchLinkedInPeople(search_criteria, {
          account_id,
          scraping_type,
          settings
        });
        break;
        
      case 'company_research':
        results = await apifyService.researchCompanyEmployees(companies, {
          account_id,
          scraping_type,
          settings
        });
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid scraping type' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      results_count: results.length,
      data: results
    });

  } catch (error) {
    console.error('Apify integration error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### 3. React Components

Create `/components/integrations/ApifyDataScraper.tsx`:
```typescript
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ScrapingJob {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results_count: number;
  cost: number;
  created_at: string;
}

export function ApifyDataScraper() {
  const [jobs, setJobs] = useState<ScrapingJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const scrapeProfiles = async (urls: string[]) => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/integrations/apify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: 'current-user',
          scraping_type: 'profile_scraping',
          profile_urls: urls,
          settings: {
            include_contact_info: true,
            include_recent_posts: false,
            proxy_country: 'US'
          }
        })
      });
      
      const result = await response.json();
      console.log('Scraping completed:', result);
      
      // Refresh jobs list
      // refreshJobs();
    } catch (error) {
      console.error('Scraping failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const searchPeople = async (criteria: any) => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/integrations/apify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: 'current-user',
          scraping_type: 'people_search',
          search_criteria: criteria,
          settings: {
            max_results: 100,
            proxy_country: 'US'
          }
        })
      });
      
      const result = await response.json();
      console.log('People search completed:', result);
    } catch (error) {
      console.error('People search failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Apify LinkedIn Data Scraper</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="profiles" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profiles">Profile Scraping</TabsTrigger>
              <TabsTrigger value="search">People Search</TabsTrigger>
              <TabsTrigger value="companies">Company Research</TabsTrigger>
            </TabsList>
            
            <TabsContent value="profiles" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">LinkedIn Profile URLs</label>
                  <Textarea
                    placeholder="https://linkedin.com/in/person1&#10;https://linkedin.com/in/person2&#10;https://linkedin.com/in/person3"
                    rows={6}
                    id="profile-urls"
                  />
                </div>
                <Button 
                  onClick={() => {
                    const urls = (document.getElementById('profile-urls') as HTMLTextAreaElement).value
                      .split('\n')
                      .filter(url => url.trim().length > 0);
                    scrapeProfiles(urls);
                  }}
                  disabled={isRunning}
                >
                  {isRunning ? 'Scraping...' : 'Scrape Profiles'}
                </Button>
                
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900">Profile Scraping</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Extract complete LinkedIn profiles including contact information, experience, skills, and recent activity.
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    Cost: ~$0.01-0.05 per profile depending on data richness
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="search" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Keywords</label>
                  <Input placeholder="VP Sales, Director Marketing" id="search-keywords" />
                </div>
                <div>
                  <label className="text-sm font-medium">Locations</label>
                  <Input placeholder="San Francisco, New York" id="search-locations" />
                </div>
                <div>
                  <label className="text-sm font-medium">Industries</label>
                  <Input placeholder="Software, SaaS, Technology" id="search-industries" />
                </div>
                <div>
                  <label className="text-sm font-medium">Max Results</label>
                  <Input type="number" placeholder="100" defaultValue="100" id="search-max" />
                </div>
              </div>
              
              <Button 
                onClick={() => {
                  const criteria = {
                    keywords: (document.getElementById('search-keywords') as HTMLInputElement).value,
                    locations: (document.getElementById('search-locations') as HTMLInputElement).value.split(',').map(s => s.trim()),
                    industries: (document.getElementById('search-industries') as HTMLInputElement).value.split(',').map(s => s.trim()),
                    max_results: parseInt((document.getElementById('search-max') as HTMLInputElement).value) || 100
                  };
                  searchPeople(criteria);
                }}
                disabled={isRunning}
              >
                {isRunning ? 'Searching...' : 'Search LinkedIn'}
              </Button>
              
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900">People Search</h4>
                <p className="text-sm text-green-700 mt-1">
                  Find LinkedIn profiles matching specific criteria. Ideal for prospecting and lead generation.
                </p>
                <p className="text-xs text-green-600 mt-2">
                  Cost: ~$0.10-0.50 per search depending on result count
                </p>
              </div>
            </TabsContent>

            <TabsContent value="companies" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Company Names</label>
                  <Textarea
                    placeholder="Salesforce&#10;HubSpot&#10;Pipedrive"
                    rows={4}
                    id="company-names"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Max Employees per Company</label>
                  <Input type="number" placeholder="50" defaultValue="50" id="max-employees" />
                </div>
                <Button 
                  onClick={() => {
                    const companies = (document.getElementById('company-names') as HTMLTextAreaElement).value
                      .split('\n')
                      .filter(name => name.trim().length > 0);
                    // researchCompanies(companies);
                  }}
                  disabled={isRunning}
                >
                  {isRunning ? 'Researching...' : 'Research Companies'}
                </Button>
                
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-medium text-purple-900">Company Research</h4>
                  <p className="text-sm text-purple-700 mt-1">
                    Extract employee lists and company information for competitive analysis and prospecting.
                  </p>
                  <p className="text-xs text-purple-600 mt-2">
                    Cost: ~$0.50-2.00 per company depending on employee count
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Jobs History */}
      <Card>
        <CardHeader>
          <CardTitle>Scraping History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {jobs.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No scraping jobs yet</p>
            ) : (
              jobs.map(job => (
                <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="font-medium capitalize">{job.type.replace('_', ' ')}</span>
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                      job.status === 'completed' ? 'bg-green-100 text-green-800' :
                      job.status === 'failed' ? 'bg-red-100 text-red-800' :
                      job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <div>{job.results_count} results</div>
                    <div>${job.cost.toFixed(2)} cost</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 4. Database Schema

Add to your Supabase migrations:
```sql
-- Apify scraping results
CREATE TABLE IF NOT EXISTS apify_scraped_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    scraping_type TEXT NOT NULL CHECK (scraping_type IN (
        'profile_scraping', 'people_search', 'company_research', 'sales_navigator'
    )),
    profile_url TEXT,
    profile_data JSONB NOT NULL,
    scraping_quality_score DECIMAL(3,2),
    scraping_cost DECIMAL(10,4),
    processing_time_ms INTEGER,
    apify_run_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apify scraping jobs tracking
CREATE TABLE IF NOT EXISTS apify_scraping_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    job_type TEXT NOT NULL,
    search_criteria JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'running', 'completed', 'failed'
    )),
    progress DECIMAL(5,2) DEFAULT 0,
    results_count INTEGER DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0,
    apify_run_id TEXT,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE apify_scraped_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE apify_scraping_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their workspace Apify data" ON apify_scraped_data
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage their workspace Apify jobs" ON apify_scraping_jobs
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));
```

## 💰 Cost Management

### Pricing Structure
- **Compute Units**: ~$0.25/hour
- **Profile Scraping**: $0.01-0.05 per profile
- **People Search**: $0.10-0.50 per search
- **Company Research**: $0.50-2.00 per company

### Cost Optimization
```typescript
const optimizedSettings = {
  max_concurrent_runs: 2,        // Limit parallel jobs
  include_contact_info: false,   // Reduce data collection
  include_recent_posts: false,   // Skip heavy data
  proxy_group: "DATACENTER"      // Cheaper than residential
};
```

## 📊 Integration with Other Services

### 1. Unipile + Apify Workflow
```typescript
// Step 1: Apify finds prospects
const prospects = await apifyService.searchLinkedInPeople({
  keywords: "VP Sales",
  locations: ["San Francisco"],
  max_results: 100
});

// Step 2: Unipile sends connection requests
for (const prospect of prospects) {
  await unipileService.sendConnectionRequest(
    prospect.profileUrl,
    "Hi, I'd love to connect and share insights about sales strategies."
  );
}
```

### 2. Bright Data + Apify Enhanced Scraping
```typescript
// Use Bright Data residential proxies for Apify scraping
const enhancedConfig = {
  proxyConfiguration: {
    useApifyProxy: false,
    proxyUrls: [`http://${brightDataConfig.username}:${brightDataConfig.password}@${brightDataConfig.host}:${brightDataConfig.port}`]
  }
};
```

## 🚀 Next Steps

1. **Get Apify API Token** from your Apify dashboard
2. **Configure Actor IDs** for LinkedIn scrapers you want to use
3. **Set up Proxy Configuration** (residential recommended for LinkedIn)
4. **Test Scraping Operations** with small batches first
5. **Monitor Costs and Performance** through Apify console
6. **Integrate with SAM AI Dashboard** for seamless workflow

## 📚 Resources

- [Apify Documentation](https://docs.apify.com)
- [LinkedIn Profile Scraper](https://apify.com/apify/linkedin-profile-scraper)
- [LinkedIn People Search](https://apify.com/apify/linkedin-people-search)
- [Sales Navigator Scraper](https://apify.com/apify/linkedin-sales-navigator-scraper)

---

**Apify MCP integration provides SAM AI with enterprise-grade data intelligence capabilities for high-volume lead generation and enrichment!** 🔍✨