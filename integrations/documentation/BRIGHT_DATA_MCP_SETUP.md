# Bright Data MCP Integration Guide for SAM AI

## 🌟 Overview

Bright Data MCP provides residential proxy network integration for SAM AI, enabling authentic web scraping with real home IP addresses. This is essential for LinkedIn data collection while maintaining high success rates and low detection risk.

## 🏠 Why Residential Network for LinkedIn

Residential IPs provide:
- ✅ **Maximum Authenticity**: LinkedIn sees normal residential users, not data centers
- ✅ **Lower Detection Risk**: Residential IPs have highest trust scores
- ✅ **Geographic Accuracy**: Real IPs from specific cities/regions
- ✅ **Higher Success Rates**: Better for sensitive platforms like LinkedIn

## 🔧 Installation & Configuration

### 1. Certificate Installation (macOS)

#### Step 1: Download Certificate
1. Go to your Bright Data dashboard
2. Navigate to **Proxy & Scraping Infrastructure** → **Residential**
3. Click **"Download Certificate"** button
4. Save the `.crt` file to your Downloads folder

#### Step 2: Install Certificate
1. **Double-click** the downloaded `.crt` file
2. **Keychain Access** will automatically open
3. Select **"Login"** keychain or **"System"** for all users
4. Click **"Add"**

#### Step 3: Trust Certificate
1. In Keychain Access, find "Bright Data" certificate
2. **Double-click** to open details
3. Expand the **"Trust"** section
4. Change **"When using this certificate"** to **"Always Trust"**
5. Close window and enter Mac password when prompted

### 2. Environment Configuration

Add to your `.env.local` file:
```env
# Bright Data Residential Network
BRIGHT_DATA_RESIDENTIAL_HOST=brd.superproxy.io
BRIGHT_DATA_RESIDENTIAL_PORT=22225
BRIGHT_DATA_RESIDENTIAL_USERNAME=brd-customer-hl_8aca120e-zone-residential
BRIGHT_DATA_RESIDENTIAL_PASSWORD=your_password_from_dashboard

# Zone Configuration
BRIGHT_DATA_PREFERRED_ZONE=residential
BRIGHT_DATA_FALLBACK_ZONE=isp_proxy1

# Customer ID
BRIGHT_DATA_CUSTOMER_ID=hl_8aca120e
```

### 3. Supabase Environment Variables

Add to Supabase Dashboard → Project Settings → Edge Functions → Environment Variables:
```env
VITE_BRIGHT_DATA_PASSWORD=your_password_from_dashboard
BRIGHT_DATA_CUSTOMER_ID=hl_8aca120e
```

## 🚀 SAM AI Integration

### 1. Proxy Service Integration

Create `/lib/services/brightdata-proxy.ts`:
```typescript
export class BrightDataProxyService {
  private customerID = process.env.BRIGHT_DATA_CUSTOMER_ID;
  private zone = 'residential';
  private host = 'brd.superproxy.io';
  private port = 22225;

  generateProxyConfig(location?: { country: string; state?: string }) {
    let username = `brd-customer-${this.customerID}-zone-${this.zone}`;
    
    if (location?.country) {
      username += `-country-${location.country.toLowerCase()}`;
      if (location.state) {
        username += `-state-${location.state.toLowerCase()}`;
      }
    }
    
    // Add session for rotation
    const sessionId = Math.random().toString(36).substring(7);
    username += `-session-${sessionId}`;

    return {
      host: this.host,
      port: this.port,
      username,
      password: process.env.BRIGHT_DATA_RESIDENTIAL_PASSWORD!
    };
  }

  async scrapeLinkedInProfile(profileUrl: string, location?: { country: string; state?: string }) {
    const proxyConfig = this.generateProxyConfig(location);
    
    try {
      const response = await fetch('/api/integrations/brightdata/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: profileUrl,
          proxy: proxyConfig,
          type: 'linkedin_profile'
        })
      });

      return await response.json();
    } catch (error) {
      console.error('LinkedIn scraping failed:', error);
      throw error;
    }
  }

  async bulkScrapeProfiles(urls: string[], options: {
    distributeAcrossCountries?: boolean;
    countries?: string[];
  } = {}) {
    const { distributeAcrossCountries = true, countries = ['us', 'gb', 'de', 'fr', 'ca'] } = options;
    
    const results = [];
    for (let i = 0; i < urls.length; i++) {
      const country = distributeAcrossCountries 
        ? countries[i % countries.length]
        : 'us';
      
      const result = await this.scrapeLinkedInProfile(urls[i], { country });
      results.push(result);
      
      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return results;
  }
}
```

### 2. Location Intelligence Service

Create `/lib/services/location-mapping.ts`:
```typescript
interface LocationMapping {
  linkedin_location: string;
  suggested_proxy: {
    country: string;
    state?: string;
    confidence: number;
  };
}

export class LocationMappingService {
  private mappings: LocationMapping[] = [
    // US States
    { linkedin_location: 'New York, NY', suggested_proxy: { country: 'us', state: 'ny', confidence: 0.95 }},
    { linkedin_location: 'San Francisco, CA', suggested_proxy: { country: 'us', state: 'ca', confidence: 0.95 }},
    { linkedin_location: 'Los Angeles, CA', suggested_proxy: { country: 'us', state: 'ca', confidence: 0.95 }},
    { linkedin_location: 'Chicago, IL', suggested_proxy: { country: 'us', state: 'il', confidence: 0.95 }},
    { linkedin_location: 'Austin, TX', suggested_proxy: { country: 'us', state: 'tx', confidence: 0.95 }},
    { linkedin_location: 'Seattle, WA', suggested_proxy: { country: 'us', state: 'wa', confidence: 0.95 }},
    
    // International
    { linkedin_location: 'London, UK', suggested_proxy: { country: 'gb', confidence: 0.90 }},
    { linkedin_location: 'Berlin, Germany', suggested_proxy: { country: 'de', confidence: 0.90 }},
    { linkedin_location: 'Toronto, Canada', suggested_proxy: { country: 'ca', confidence: 0.90 }},
    { linkedin_location: 'Paris, France', suggested_proxy: { country: 'fr', confidence: 0.90 }},
    { linkedin_location: 'Amsterdam, Netherlands', suggested_proxy: { country: 'nl', confidence: 0.90 }},
  ];

  analyzeLinkedInLocation(location: string): LocationMapping {
    // Exact match first
    const exactMatch = this.mappings.find(m => 
      m.linkedin_location.toLowerCase() === location.toLowerCase()
    );
    if (exactMatch) return exactMatch;

    // Fuzzy matching for cities/states
    const fuzzyMatch = this.mappings.find(m => {
      const parts = location.toLowerCase().split(',');
      const mappingParts = m.linkedin_location.toLowerCase().split(',');
      
      return parts.some(part => 
        mappingParts.some(mappingPart => 
          mappingPart.trim().includes(part.trim()) || part.trim().includes(mappingPart.trim())
        )
      );
    });
    
    if (fuzzyMatch) {
      return {
        ...fuzzyMatch,
        suggested_proxy: { ...fuzzyMatch.suggested_proxy, confidence: 0.7 }
      };
    }

    // Default to US if no match
    return {
      linkedin_location: location,
      suggested_proxy: { country: 'us', confidence: 0.5 }
    };
  }

  getBrightDataProxyConfig(locationData: LocationMapping) {
    const { country, state } = locationData.suggested_proxy;
    return this.generateProxyUsername(country, state);
  }

  private generateProxyUsername(country: string, state?: string): string {
    let username = `brd-customer-${process.env.BRIGHT_DATA_CUSTOMER_ID}-zone-residential`;
    username += `-country-${country}`;
    if (state) {
      username += `-state-${state}`;
    }
    
    const sessionId = Math.random().toString(36).substring(7);
    username += `-session-${sessionId}`;
    
    return username;
  }
}
```

### 3. React Components

Create `/components/integrations/BrightDataIntegration.tsx`:
```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProxyHealth {
  country: string;
  healthy: boolean;
  responseTime: number;
  lastTested: string;
}

export function BrightDataIntegration() {
  const [password, setPassword] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [proxyHealth, setProxyHealth] = useState<ProxyHealth[]>([]);
  const [testingConnection, setTestingConnection] = useState(false);

  const testProxyConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await fetch('/api/integrations/brightdata/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      if (response.ok) {
        const health = await response.json();
        setProxyHealth(health.countries);
        setIsConfigured(true);
      }
    } catch (error) {
      console.error('Proxy test failed:', error);
    } finally {
      setTestingConnection(false);
    }
  };

  const scrapeProfile = async (url: string) => {
    try {
      const response = await fetch('/api/integrations/brightdata/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url, 
          type: 'linkedin_profile',
          options: { use_location_matching: true }
        })
      });
      
      const result = await response.json();
      console.log('Scraping result:', result);
    } catch (error) {
      console.error('Scraping failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bright Data Residential Network</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="setup" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="scraping">Data Scraping</TabsTrigger>
              <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="setup" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Bright Data Password</label>
                  <Input
                    type="password"
                    placeholder="Enter your Bright Data password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={testProxyConnection}
                  disabled={!password || testingConnection}
                >
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="scraping" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">LinkedIn Profile URL</label>
                  <div className="flex space-x-2">
                    <Input
                      placeholder="https://linkedin.com/in/someone"
                      id="profile-url"
                    />
                    <Button onClick={() => {
                      const url = (document.getElementById('profile-url') as HTMLInputElement).value;
                      scrapeProfile(url);
                    }}>
                      Scrape Profile
                    </Button>
                  </div>
                </div>
                
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900">Location Matching</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    SAM AI automatically matches LinkedIn account locations to optimal proxy locations for maximum authenticity.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {proxyHealth.map((health) => (
                  <Card key={health.country} className={health.healthy ? 'border-green-200' : 'border-red-200'}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{health.country.toUpperCase()}</span>
                        <div className={`w-3 h-3 rounded-full ${health.healthy ? 'bg-green-500' : 'bg-red-500'}`} />
                      </div>
                      <div className="text-sm text-gray-600 mt-2">
                        Response: {health.responseTime}ms
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-900">Configuration Status</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    {isConfigured ? '✅ Residential network configured and ready' : '⚠️ Please complete setup first'}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Current Settings</h4>
                  <div className="text-sm space-y-1">
                    <div>Host: brd.superproxy.io:22225</div>
                    <div>Zone: residential</div>
                    <div>Customer ID: hl_8aca120e</div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 4. Database Schema

Add to your Supabase migrations:
```sql
-- LinkedIn scraping with Bright Data integration
CREATE TABLE IF NOT EXISTS linkedin_scraped_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    profile_url TEXT NOT NULL,
    profile_data JSONB,
    proxy_location TEXT,
    scraping_quality_score DECIMAL(3,2),
    scraping_cost DECIMAL(10,4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, profile_url)
);

-- Bright Data proxy health monitoring
CREATE TABLE IF NOT EXISTS bright_data_proxy_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    country_code TEXT NOT NULL,
    state_code TEXT,
    response_time_ms INTEGER,
    success_rate DECIMAL(5,2),
    last_tested_at TIMESTAMPTZ DEFAULT NOW(),
    is_healthy BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scraping jobs tracking
CREATE TABLE IF NOT EXISTS linkedin_scraping_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    urls TEXT[],
    status TEXT NOT NULL DEFAULT 'pending',
    progress DECIMAL(5,2) DEFAULT 0,
    results_count INTEGER DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE linkedin_scraped_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bright_data_proxy_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_scraping_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their workspace LinkedIn data" ON linkedin_scraped_profiles
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can view their workspace proxy health" ON bright_data_proxy_health
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage their workspace scraping jobs" ON linkedin_scraping_jobs
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));
```

## 🧪 Testing & Verification

### Command Line Test
```bash
# Test US residential IP
curl --proxy brd.superproxy.io:22225 \
     --proxy-user brd-customer-hl_8aca120e-zone-residential-country-us:YOUR_PASSWORD \
     "http://geo.brdtest.com/welcome.txt"

# Expected output should show:
# IP: [residential_ip]
# Country: US
# Datacenter: No (confirms residential!)
```

### API Test
```bash
# Test integration endpoint
curl -X POST http://localhost:3000/api/integrations/brightdata/test \
  -H "Content-Type: application/json" \
  -d '{"password": "your-password"}'
```

## 🔒 Security & Compliance

### Certificate Security
- Certificate enables HTTPS tunneling through residential network
- Required to prevent misuse and ensure legitimate scraping
- Only works with your specific customer ID

### LinkedIn Compliance
- Residential IPs respect LinkedIn's geographical restrictions
- Natural browsing patterns reduce rate limiting
- Authentic user behavior reduces account suspension risk

## 📊 Performance Comparison

| Feature | ISP Proxy | Residential Network |
|---------|-----------|-------------------|
| Authenticity | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| LinkedIn Success | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Detection Risk | Medium | Very Low |
| Geographic Accuracy | Good | Excellent |
| Cost | Lower | Higher (Premium) |

## 🚀 Next Steps

1. **Install Certificate** following the steps above
2. **Configure Environment Variables** in Supabase and local
3. **Test Residential Network** with curl command
4. **Integrate Components** into your SAM AI dashboard
5. **Test LinkedIn Scraping** with location-matched IPs

## 📚 Resources

- [Bright Data Documentation](https://docs.brightdata.com)
- [Residential Network Guide](https://docs.brightdata.com/residential)
- [LinkedIn Scraping Best Practices](./examples/linkedin-scraping-guide.md)

---

**Bright Data Residential Network enables SAM AI to perform authentic, high-success LinkedIn data collection!** 🏠✨