/**
 * Auto IP Assignment Service for Bright Data
 * Automatically assigns optimal proxy IPs based on user account location
 */

interface UserLocationData {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  mobile: boolean;
  proxy: boolean;
  hosting: boolean;
}

interface BrightDataProxyConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  country: string;
  state?: string;
  city?: string;
  sessionId: string;
  confidence: number;
}

interface LocationMapping {
  detectedLocation: string;
  brightDataCountry: string;
  brightDataState?: string;
  brightDataCity?: string;
  confidence: number;
  priority: number;
}

export class AutoIPAssignmentService {
  private customerID = process.env.BRIGHT_DATA_CUSTOMER_ID;
  private zone = 'residential';
  private host = 'brd.superproxy.io';
  private port = 22225;

  // Comprehensive location mappings for optimal proxy assignment
  private locationMappings: LocationMapping[] = [
    // United States - High Priority Countries
    { detectedLocation: 'US', brightDataCountry: 'us', confidence: 0.95, priority: 1 },
    { detectedLocation: 'United States', brightDataCountry: 'us', confidence: 0.95, priority: 1 },
    
    // US States - Very High Precision
    { detectedLocation: 'California', brightDataCountry: 'us', brightDataState: 'ca', confidence: 0.98, priority: 1 },
    { detectedLocation: 'New York', brightDataCountry: 'us', brightDataState: 'ny', confidence: 0.98, priority: 1 },
    { detectedLocation: 'Texas', brightDataCountry: 'us', brightDataState: 'tx', confidence: 0.98, priority: 1 },
    { detectedLocation: 'Florida', brightDataCountry: 'us', brightDataState: 'fl', confidence: 0.98, priority: 1 },
    { detectedLocation: 'Illinois', brightDataCountry: 'us', brightDataState: 'il', confidence: 0.98, priority: 1 },
    { detectedLocation: 'Washington', brightDataCountry: 'us', brightDataState: 'wa', confidence: 0.98, priority: 1 },
    
    // Major International Markets
    { detectedLocation: 'GB', brightDataCountry: 'gb', confidence: 0.90, priority: 2 },
    { detectedLocation: 'United Kingdom', brightDataCountry: 'gb', confidence: 0.90, priority: 2 },
    { detectedLocation: 'England', brightDataCountry: 'gb', confidence: 0.90, priority: 2 },
    
    { detectedLocation: 'CA', brightDataCountry: 'ca', confidence: 0.90, priority: 2 },
    { detectedLocation: 'Canada', brightDataCountry: 'ca', confidence: 0.90, priority: 2 },
    
    { detectedLocation: 'DE', brightDataCountry: 'de', confidence: 0.90, priority: 2 },
    { detectedLocation: 'Germany', brightDataCountry: 'de', confidence: 0.90, priority: 2 },
    
    { detectedLocation: 'FR', brightDataCountry: 'fr', confidence: 0.90, priority: 2 },
    { detectedLocation: 'France', brightDataCountry: 'fr', confidence: 0.90, priority: 2 },
    
    { detectedLocation: 'AU', brightDataCountry: 'au', confidence: 0.90, priority: 2 },
    { detectedLocation: 'Australia', brightDataCountry: 'au', confidence: 0.90, priority: 2 },
    
    { detectedLocation: 'NL', brightDataCountry: 'nl', confidence: 0.85, priority: 3 },
    { detectedLocation: 'Netherlands', brightDataCountry: 'nl', confidence: 0.85, priority: 3 },
    
    { detectedLocation: 'BR', brightDataCountry: 'br', confidence: 0.85, priority: 3 },
    { detectedLocation: 'Brazil', brightDataCountry: 'br', confidence: 0.85, priority: 3 },
    
    { detectedLocation: 'ES', brightDataCountry: 'es', confidence: 0.85, priority: 3 },
    { detectedLocation: 'Spain', brightDataCountry: 'es', confidence: 0.85, priority: 3 },
    
    { detectedLocation: 'IT', brightDataCountry: 'it', confidence: 0.85, priority: 3 },
    { detectedLocation: 'Italy', brightDataCountry: 'it', confidence: 0.85, priority: 3 },
    
    // Asian Markets
    { detectedLocation: 'JP', brightDataCountry: 'jp', confidence: 0.80, priority: 4 },
    { detectedLocation: 'Japan', brightDataCountry: 'jp', confidence: 0.80, priority: 4 },
    
    { detectedLocation: 'SG', brightDataCountry: 'sg', confidence: 0.80, priority: 4 },
    { detectedLocation: 'Singapore', brightDataCountry: 'sg', confidence: 0.80, priority: 4 },
    
    { detectedLocation: 'IN', brightDataCountry: 'in', confidence: 0.75, priority: 5 },
    { detectedLocation: 'India', brightDataCountry: 'in', confidence: 0.75, priority: 5 },
    
    // Austria
    { detectedLocation: 'AT', brightDataCountry: 'at', confidence: 0.90, priority: 2 },
    { detectedLocation: 'Austria', brightDataCountry: 'at', confidence: 0.90, priority: 2 },
    { detectedLocation: 'Österreich', brightDataCountry: 'at', confidence: 0.90, priority: 2 },
    
    // Switzerland
    { detectedLocation: 'CH', brightDataCountry: 'ch', confidence: 0.90, priority: 2 },
    { detectedLocation: 'Switzerland', brightDataCountry: 'ch', confidence: 0.90, priority: 2 },
    { detectedLocation: 'Schweiz', brightDataCountry: 'ch', confidence: 0.90, priority: 2 },
    
    // Philippines
    { detectedLocation: 'PH', brightDataCountry: 'ph', confidence: 0.85, priority: 3 },
    { detectedLocation: 'Philippines', brightDataCountry: 'ph', confidence: 0.85, priority: 3 },
  ];

  /**
   * Detect user location using multiple methods
   */
  async detectUserLocation(request?: Request): Promise<UserLocationData | null> {
    try {
      // Method 1: IP-based geolocation using multiple services
      const ipData = await this.getIPGeolocation(request);
      if (ipData) return ipData;

      // Method 2: Browser geolocation (client-side)
      // This would be handled on the frontend and passed to the API

      // Method 3: Fallback to US if detection fails
      return {
        ip: 'unknown',
        country: 'United States',
        countryCode: 'US',
        region: 'CA',
        regionName: 'California',
        city: 'San Francisco',
        zip: '94102',
        lat: 37.7749,
        lon: -122.4194,
        timezone: 'America/Los_Angeles',
        isp: 'Unknown',
        mobile: false,
        proxy: false,
        hosting: false
      };
    } catch (error) {
      console.error('Location detection failed:', error);
      return null;
    }
  }

  /**
   * Get IP geolocation from multiple services
   */
  private async getIPGeolocation(request?: Request): Promise<UserLocationData | null> {
    try {
      // Extract IP from request headers (Netlify/Vercel)
      let clientIP = 'unknown';
      
      if (request) {
        clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                   request.headers.get('x-real-ip') ||
                   request.headers.get('cf-connecting-ip') ||
                   'unknown';
      }

      // Use ip-api.com (free, no API key required)
      const response = await fetch(`http://ip-api.com/json/${clientIP}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,mobile,proxy,hosting,query`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'success') {
          return {
            ip: data.query,
            country: data.country,
            countryCode: data.countryCode,
            region: data.region,
            regionName: data.regionName,
            city: data.city,
            zip: data.zip,
            lat: data.lat,
            lon: data.lon,
            timezone: data.timezone,
            isp: data.isp,
            mobile: data.mobile,
            proxy: data.proxy,
            hosting: data.hosting
          };
        }
      }

      return null;
    } catch (error) {
      console.error('IP geolocation failed:', error);
      return null;
    }
  }

  /**
   * Generate optimal Bright Data proxy configuration based on location
   */
  async generateOptimalProxyConfig(userLocation?: UserLocationData, linkedinProfileLocation?: string): Promise<BrightDataProxyConfig> {
    try {
      // Priority order for location sources:
      // 1. LinkedIn profile location (if provided)
      // 2. Detected user location
      // 3. Default to US

      let bestMapping: LocationMapping | null = null;

      // Try LinkedIn profile location first
      if (linkedinProfileLocation) {
        bestMapping = this.findBestLocationMapping(linkedinProfileLocation);
        console.log(`🎯 LinkedIn location "${linkedinProfileLocation}" mapped to:`, bestMapping);
      }

      // Fallback to user detected location
      if (!bestMapping && userLocation) {
        const locationString = `${userLocation.city}, ${userLocation.regionName}, ${userLocation.country}`;
        bestMapping = this.findBestLocationMapping(locationString) ||
                     this.findBestLocationMapping(userLocation.regionName) ||
                     this.findBestLocationMapping(userLocation.country);
        console.log(`🌍 User location "${locationString}" mapped to:`, bestMapping);
      }

      // Default mapping if nothing found
      if (!bestMapping) {
        bestMapping = {
          detectedLocation: 'default',
          brightDataCountry: 'us',
          brightDataState: 'ca',
          confidence: 0.5,
          priority: 5
        };
        console.log(`🔄 Using default US mapping:`, bestMapping);
      }

      // Generate unique session ID for rotation
      const sessionId = this.generateSessionId();

      // Build proxy username with location parameters
      let username = `brd-customer-${this.customerID}-zone-${this.zone}`;
      username += `-country-${bestMapping.brightDataCountry}`;
      
      if (bestMapping.brightDataState) {
        username += `-state-${bestMapping.brightDataState}`;
      }
      
      if (bestMapping.brightDataCity) {
        username += `-city-${bestMapping.brightDataCity}`;
      }
      
      username += `-session-${sessionId}`;

      const proxyConfig: BrightDataProxyConfig = {
        host: this.host,
        port: this.port,
        username,
        password: process.env.BRIGHT_DATA_RESIDENTIAL_PASSWORD!,
        country: bestMapping.brightDataCountry,
        state: bestMapping.brightDataState,
        city: bestMapping.brightDataCity,
        sessionId,
        confidence: bestMapping.confidence
      };

      console.log(`✅ Generated proxy config:`, {
        country: proxyConfig.country,
        state: proxyConfig.state,
        confidence: proxyConfig.confidence,
        sessionId: proxyConfig.sessionId
      });

      return proxyConfig;
    } catch (error) {
      console.error('Proxy config generation failed:', error);
      throw error;
    }
  }

  /**
   * Find the best location mapping using fuzzy matching
   */
  private findBestLocationMapping(locationString: string): LocationMapping | null {
    if (!locationString) return null;

    const normalizedLocation = locationString.toLowerCase().trim();

    // Exact match first
    let exactMatch = this.locationMappings.find(mapping => 
      mapping.detectedLocation.toLowerCase() === normalizedLocation
    );
    
    if (exactMatch) return exactMatch;

    // Partial match (contains)
    let partialMatch = this.locationMappings.find(mapping => 
      normalizedLocation.includes(mapping.detectedLocation.toLowerCase()) ||
      mapping.detectedLocation.toLowerCase().includes(normalizedLocation)
    );
    
    if (partialMatch) {
      return {
        ...partialMatch,
        confidence: partialMatch.confidence * 0.8 // Reduce confidence for partial matches
      };
    }

    // Country code match (2-letter codes)
    if (normalizedLocation.length === 2) {
      let countryMatch = this.locationMappings.find(mapping => 
        mapping.brightDataCountry === normalizedLocation
      );
      
      if (countryMatch) return countryMatch;
    }

    return null;
  }

  /**
   * Generate unique session ID for proxy rotation
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `${timestamp}_${random}`;
  }

  /**
   * Test proxy connectivity for a specific location
   */
  async testProxyConnectivity(proxyConfig: BrightDataProxyConfig): Promise<{
    success: boolean;
    responseTime: number;
    actualLocation?: any;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      // Test proxy with Bright Data's geo endpoint
      const testUrl = 'http://geo.brdtest.com/welcome.txt';
      
      const response = await fetch(testUrl, {
        method: 'GET',
        // Note: In a real implementation, you'd configure the proxy here
        // This is a simplified version for demonstration
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const locationData = await response.text();
        
        return {
          success: true,
          responseTime,
          actualLocation: {
            text: locationData,
            expectedCountry: proxyConfig.country,
            expectedState: proxyConfig.state
          }
        };
      } else {
        return {
          success: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get available Bright Data locations for user selection
   */
  getAvailableLocations(): { country: string; state?: string; displayName: string; priority: number }[] {
    const uniqueLocations = new Map<string, any>();

    this.locationMappings.forEach(mapping => {
      const key = `${mapping.brightDataCountry}-${mapping.brightDataState || ''}`;
      
      if (!uniqueLocations.has(key)) {
        uniqueLocations.set(key, {
          country: mapping.brightDataCountry,
          state: mapping.brightDataState,
          displayName: this.getDisplayName(mapping.brightDataCountry, mapping.brightDataState),
          priority: mapping.priority
        });
      }
    });

    return Array.from(uniqueLocations.values())
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get display name for a location
   */
  private getDisplayName(country: string, state?: string): string {
    const countryNames: { [key: string]: string } = {
      'us': 'United States',
      'gb': 'United Kingdom',
      'ca': 'Canada',
      'de': 'Germany',
      'fr': 'France',
      'au': 'Australia',
      'nl': 'Netherlands',
      'br': 'Brazil',
      'es': 'Spain',
      'it': 'Italy',
      'jp': 'Japan',
      'sg': 'Singapore',
      'in': 'India',
      'at': 'Austria',
      'ch': 'Switzerland',
      'ph': 'Philippines'
    };

    const stateNames: { [key: string]: string } = {
      'ca': 'California',
      'ny': 'New York',
      'tx': 'Texas',
      'fl': 'Florida',
      'il': 'Illinois',
      'wa': 'Washington'
    };

    let displayName = countryNames[country] || country.toUpperCase();
    
    if (state && stateNames[state]) {
      displayName += ` (${stateNames[state]})`;
    }

    return displayName;
  }

  /**
   * Log proxy usage for analytics and optimization
   */
  async logProxyUsage(proxyConfig: BrightDataProxyConfig, usage: {
    requestType: string;
    responseTime: number;
    success: boolean;
    dataVolume: number;
    cost?: number;
  }): Promise<void> {
    try {
      // In a real implementation, this would log to your analytics system
      console.log('📊 Proxy usage logged:', {
        country: proxyConfig.country,
        state: proxyConfig.state,
        sessionId: proxyConfig.sessionId,
        confidence: proxyConfig.confidence,
        usage
      });

      // Could also send to a monitoring service like DataDog, New Relic, etc.
      // await fetch('/api/analytics/proxy-usage', {
      //   method: 'POST',
      //   body: JSON.stringify({ proxyConfig, usage })
      // });
    } catch (error) {
      console.error('Failed to log proxy usage:', error);
    }
  }
}