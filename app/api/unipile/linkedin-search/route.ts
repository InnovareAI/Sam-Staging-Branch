import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // For now, we'll use mock data since the full Unipile MCP integration isn't complete
    // This prevents the "s is not a function" error and provides realistic test data
    
    const body = await request.json()
    const { query, action } = body
    
    if (!query) {
      return NextResponse.json({
        success: false,
        error: 'Search query is required'
      }, { status: 400 })
    }

    if (action === 'search_prospects') {
      // Generate realistic LinkedIn prospect data based on search query
      const prospects = generateLinkedInProspects(query)
      
      return NextResponse.json({
        success: true,
        prospects,
        metadata: {
          query,
          source: 'unipile_mock',
          total_found: prospects.length,
          search_timestamp: new Date().toISOString(),
          note: 'This is mock data. Full Unipile integration pending.'
        }
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action specified'
    }, { status: 400 })

  } catch (error) {
    console.error('LinkedIn search error:', error)
    return NextResponse.json({
      success: false,
      error: 'LinkedIn search service temporarily unavailable'
    }, { status: 500 })
  }
}

function generateLinkedInProspects(query: string) {
  // Generate realistic prospects based on query keywords
  const queryLower = query.toLowerCase()
  
  // Determine industry and roles based on query
  let titles: string[] = []
  let companies: string[] = []
  let industries: string[] = []
  
  if (queryLower.includes('sales') || queryLower.includes('revenue')) {
    titles = ['VP Sales', 'Sales Director', 'Head of Sales', 'Chief Revenue Officer', 'Sales Manager', 'Business Development Manager', 'Regional Sales Director']
    companies = ['SalesForce', 'HubSpot', 'Outreach', 'ZoomInfo', 'Apollo.io', 'Gong', 'Revenue.io']
    industries = ['SaaS', 'Sales Technology', 'CRM', 'Marketing Automation']
  } else if (queryLower.includes('marketing') || queryLower.includes('growth')) {
    titles = ['VP Marketing', 'Marketing Director', 'Head of Growth', 'Chief Marketing Officer', 'Growth Manager', 'Digital Marketing Manager', 'Content Marketing Manager']
    companies = ['Marketo', 'Mailchimp', 'Segment', 'Amplitude', 'Mixpanel', 'ContentStack', 'Unbounce']
    industries = ['MarTech', 'Digital Marketing', 'Content Marketing', 'Growth Hacking']
  } else if (queryLower.includes('tech') || queryLower.includes('engineer') || queryLower.includes('developer')) {
    titles = ['CTO', 'VP Engineering', 'Engineering Manager', 'Senior Software Engineer', 'Tech Lead', 'Principal Engineer', 'Director of Engineering']
    companies = ['Google', 'Microsoft', 'Amazon', 'Meta', 'Netflix', 'Uber', 'Airbnb', 'Stripe']
    industries = ['Technology', 'Software Development', 'Cloud Computing', 'AI/ML']
  } else if (queryLower.includes('finance') || queryLower.includes('fintech')) {
    titles = ['CFO', 'VP Finance', 'Finance Director', 'Controller', 'Financial Analyst', 'Treasury Manager', 'Head of FP&A']
    companies = ['JPMorgan', 'Goldman Sachs', 'Stripe', 'Square', 'Plaid', 'Robinhood', 'Coinbase']
    industries = ['FinTech', 'Banking', 'Financial Services', 'Investment']
  } else {
    // Default business prospects
    titles = ['CEO', 'COO', 'VP Operations', 'General Manager', 'Director of Operations', 'Business Development Manager']
    companies = ['Microsoft', 'Salesforce', 'Adobe', 'Oracle', 'IBM', 'Cisco', 'Dell']
    industries = ['Technology', 'Business Services', 'Consulting', 'Software']
  }

  const locations = [
    'San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Boston, MA',
    'Los Angeles, CA', 'Chicago, IL', 'Denver, CO', 'Atlanta, GA', 'Miami, FL',
    'Toronto, ON', 'London, UK', 'Berlin, DE', 'Sydney, AU'
  ]

  const firstNames = ['Alex', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'Robert', 'Amanda', 'James', 'Lisa', 'John', 'Michelle', 'Chris', 'Rachel', 'Matt']
  const lastNames = ['Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Lewis']

  const prospectsCount = Math.floor(Math.random() * 20) + 5 // 5-25 prospects

  return Array.from({ length: prospectsCount }, (_, i) => {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
    const title = titles[Math.floor(Math.random() * titles.length)]
    const company = companies[Math.floor(Math.random() * companies.length)]
    const industry = industries[Math.floor(Math.random() * industries.length)]
    const location = locations[Math.floor(Math.random() * locations.length)]

    // Calculate confidence based on title seniority and query relevance
    const seniorityScore = ['CEO', 'CTO', 'CFO', 'VP', 'Chief', 'Head of', 'Director'].some(senior => title.includes(senior)) ? 0.9 : 0.7
    const relevanceScore = titles.includes(title) ? 0.9 : 0.6
    const confidence = Math.min(0.95, (seniorityScore + relevanceScore) / 2 + (Math.random() * 0.1))

    return {
      id: `unipile_${Date.now()}_${i}`,
      name: `${firstName} ${lastName}`,
      title,
      company,
      industry,
      location,
      email: Math.random() > 0.3 ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.toLowerCase().replace(/[^a-z]/g, '')}.com` : null,
      phone: Math.random() > 0.6 ? `+1 (${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}` : null,
      linkedinUrl: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${Math.floor(Math.random() * 999)}`,
      profileUrl: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${Math.floor(Math.random() * 999)}`,
      confidence: Math.round(confidence * 100) / 100,
      complianceFlags: Math.random() > 0.85 ? ['gdpr-review'] : [],
      
      // Additional LinkedIn-specific metadata
      connectionDegree: Math.floor(Math.random() * 3) + 1,
      mutualConnections: Math.floor(Math.random() * 25),
      lastActive: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      profileCompleteness: Math.round((Math.random() * 0.4 + 0.6) * 100), // 60-100%
      hasPhoto: Math.random() > 0.2,
      isOpenToWork: Math.random() > 0.8,
      premiumAccount: Math.random() > 0.7
    }
  })
}