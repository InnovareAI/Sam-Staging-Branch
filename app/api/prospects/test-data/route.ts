import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Firebase auth + workspace context
    const { userId, workspaceId } = await verifyAuth(request)

    const body = await request.json()
    const { action, count = 25, data_source = 'linkedin', data_type = 'prospect' } = body

    switch (action) {
      case 'generate_prospects':
        return await generateTestProspects(userId, count, data_source)

      case 'generate_campaign_data':
        return await generateCampaignData(userId, count)

      case 'create_approval_session':
        return await createTestApprovalSession(userId, workspaceId, count, data_type)

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error: any) {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Test data generation error:', error)
    return NextResponse.json({
      error: 'Failed to generate test data'
    }, { status: 500 })
  }
}

async function generateTestProspects(userId: string, count: number, source: string) {
  const titles = [
    'CEO', 'CTO', 'VP Sales', 'VP Marketing', 'Director of Sales', 'Sales Manager',
    'Marketing Manager', 'COO', 'Founder', 'Head of Growth', 'Business Development Manager',
    'Director of Marketing', 'Head of Sales', 'Chief Marketing Officer', 'Revenue Operations Manager'
  ]

  const companies = [
    'TechFlow Solutions', 'DataDriven Corp', 'Innovation Labs', 'Growth Partners LLC',
    'Enterprise Systems', 'Analytics Co', 'CloudFirst Ltd', 'AI Solutions Inc',
    'Marketing Hub', 'Sales Platform', 'Digital Dynamics', 'StartupBoost',
    'ScaleVentures', 'TechAdvantage', 'BusinessGrowth Co'
  ]

  const industries = [
    'SaaS', 'FinTech', 'HealthTech', 'EdTech', 'E-commerce', 'Manufacturing',
    'Consulting', 'Marketing Technology', 'Real Estate Tech', 'InsurTech',
    'HR Technology', 'Cybersecurity', 'Data Analytics', 'Cloud Services'
  ]

  const companySizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
  const locations = [
    'San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA', 'Boston, MA',
    'Denver, CO', 'Chicago, IL', 'Atlanta, GA', 'Los Angeles, CA', 'Miami, FL'
  ]

  const prospects = Array.from({ length: count }, (_, i) => {
    const title = titles[Math.floor(Math.random() * titles.length)]
    const company = companies[Math.floor(Math.random() * companies.length)]
    const industry = industries[Math.floor(Math.random() * industries.length)]
    const size = companySizes[Math.floor(Math.random() * companySizes.length)]
    const location = locations[Math.floor(Math.random() * locations.length)]

    // Generate realistic names
    const firstNames = ['Alex', 'Morgan', 'Jordan', 'Casey', 'Taylor', 'Riley', 'Avery', 'Quinn', 'Blake', 'Cameron']
    const lastNames = ['Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas']
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
    const name = `${firstName} ${lastName}`

    // Calculate quality scores
    const titleScore = ['CEO', 'CTO', 'VP Sales', 'VP Marketing', 'Founder'].includes(title) ? 0.9 :
                      ['Director', 'Head of', 'Chief'].some(t => title.includes(t)) ? 0.7 : 0.5
    const sizeScore = ['201-500', '501-1000', '1000+'].includes(size) ? 0.8 :
                     ['51-200'].includes(size) ? 0.6 : 0.4
    const industryScore = ['SaaS', 'FinTech', 'HealthTech', 'EdTech'].includes(industry) ? 0.8 : 0.6

    const overallQuality = (titleScore + sizeScore + industryScore) / 3
    const confidence = Math.min(0.95, overallQuality + (Math.random() * 0.2 - 0.1)) // Add some randomness

    // Generate email with some variety
    const emailDomains = ['gmail.com', 'outlook.com', company.toLowerCase().replace(/[^a-z]/g, '') + '.com']
    const emailDomain = Math.random() > 0.3 ? emailDomains[2] : emailDomains[Math.floor(Math.random() * 2)]

    return {
      id: `test_${source}_${Date.now()}_${i}`,
      name,
      title,
      company,
      industry,
      companySize: size,
      location,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${emailDomain}`,
      phone: Math.random() > 0.4 ? `+1 (${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}` : null,
      linkedinUrl: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${Math.floor(Math.random() * 999)}`,
      source,
      confidence: Math.round(confidence * 100) / 100,
      complianceFlags: Math.random() > 0.8 ? ['gdpr-review'] : [],

      // Additional metadata for realistic testing
      titleScore: Math.round(titleScore * 100) / 100,
      sizeScore: Math.round(sizeScore * 100) / 100,
      industryScore: Math.round(industryScore * 100) / 100,
      priority: overallQuality > 0.75 ? 'high' : overallQuality > 0.55 ? 'medium' : 'low',

      // Enrichment data
      lastActive: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      connectionDegree: Math.floor(Math.random() * 3) + 1,
      mutualConnections: Math.floor(Math.random() * 15),
      profileCompleteness: Math.random() * 0.4 + 0.6 // 60-100%
    }
  })

  return NextResponse.json({
    success: true,
    prospects,
    count: prospects.length,
    metadata: {
      data_source: source,
      generated_at: new Date().toISOString(),
      average_quality: Math.round((prospects.reduce((sum, p) => sum + p.confidence, 0) / prospects.length) * 100) / 100,
      high_priority: prospects.filter(p => p.priority === 'high').length,
      medium_priority: prospects.filter(p => p.priority === 'medium').length,
      low_priority: prospects.filter(p => p.priority === 'low').length
    }
  })
}

async function generateCampaignData(userId: string, count: number) {
  // Generate campaign-specific test data
  const campaignTypes = ['LinkedIn Outreach', 'Email Campaign', 'Cold Email', 'Warm Intro', 'Content Marketing']
  const campaignStatuses = ['draft', 'scheduled', 'active', 'paused', 'completed']

  const campaigns = Array.from({ length: Math.min(count, 10) }, (_, i) => {
    const type = campaignTypes[Math.floor(Math.random() * campaignTypes.length)]
    const status = campaignStatuses[Math.floor(Math.random() * campaignStatuses.length)]

    return {
      id: `campaign_${Date.now()}_${i}`,
      name: `${type} - Q4 2024`,
      type,
      status,
      created_at: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
      prospect_count: Math.floor(Math.random() * 500) + 50,
      response_rate: Math.round((Math.random() * 0.15 + 0.02) * 100) / 100, // 2-17%
      open_rate: Math.round((Math.random() * 0.4 + 0.15) * 100) / 100, // 15-55%
      click_rate: Math.round((Math.random() * 0.1 + 0.01) * 100) / 100 // 1-11%
    }
  })

  return NextResponse.json({
    success: true,
    campaigns,
    count: campaigns.length
  })
}

async function createTestApprovalSession(userId: string, workspaceId: string, count: number, dataType: string) {
  try {
    // Get or create workspace
    let workspace = null
    const workspaceResult = await pool.query(
      `SELECT id FROM workspaces WHERE id = $1`,
      [workspaceId]
    )

    if (workspaceResult.rows.length === 0) {
      // Try to create workspace
      try {
        const createResult = await pool.query(
          `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           RETURNING id`,
          [
            workspaceId,
            'Default Workspace',
            `workspace-${workspaceId.slice(0, 8)}`
          ]
        )
        workspace = createResult.rows[0]
        console.log('Successfully created workspace:', workspace)
      } catch (createError) {
        console.warn('Could not create workspace, using demo workspace:', createError)
        // For demo purposes, create a fake workspace ID to continue with test data generation
        workspace = { id: `demo-workspace-${userId.slice(0, 8)}` }
        console.log('Using demo workspace for test data generation:', workspace)
      }
    } else {
      workspace = workspaceResult.rows[0]
    }

    // Generate test prospects
    const testProspectsResponse = await generateTestProspects(userId, count, 'test_data')
    const testProspectsData = await testProspectsResponse.json()

    if (!testProspectsData.success) {
      throw new Error('Failed to generate test prospects')
    }

    const prospects = testProspectsData.prospects

    // Create approval session - try different approaches if the table doesn't exist or has schema issues
    const sessionId = `test_${dataType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Try to insert approval session, but don't fail if the table doesn't exist
    let session = null
    try {
      const sessionResult = await pool.query(
        `INSERT INTO data_approval_sessions
          (session_id, user_id, workspace_id, dataset_name, dataset_type, dataset_source, raw_data, processed_data, data_preview, total_count, quota_limit, data_quality_score, completeness_score, duplicate_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          sessionId,
          userId,
          workspace.id,
          `Test ${dataType} Data - ${count} records`,
          dataType === 'icp' ? 'prospect_list' : 'campaign',
          'test_data',
          JSON.stringify({
            prospects,
            generated_at: new Date().toISOString(),
            test_session: true
          }),
          JSON.stringify(prospects),
          JSON.stringify(prospects.slice(0, 10)),
          prospects.length,
          dataType === 'icp' ? 30 : 2500, // LinkedIn Premium allows exporting up to 2,500 connections
          testProspectsData.metadata.average_quality,
          0.85,
          0
        ]
      )
      session = sessionResult.rows[0]
      console.log('Successfully created approval session:', sessionId)
    } catch (sessionError) {
      console.log('Failed to create approval session:', sessionError)
      // Create a mock session for demo purposes
      session = {
        session_id: sessionId,
        user_id: userId,
        workspace_id: workspace.id,
        dataset_name: `Test ${dataType} Data - ${count} records`,
        data_quality_score: testProspectsData.metadata.average_quality
      }
      console.log('Using mock session for demo:', session)
    }

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      session: session,
      prospects: prospects,
      message: `Created test approval session with ${prospects.length} prospects`,
      ui_instructions: {
        step1: 'Use the DataApprovalPanel component to display this data',
        step2: 'Pass the prospects array to the component',
        step3: 'User can approve/reject individual prospects',
        step4: 'Call the approval decision API to save results'
      }
    })

  } catch (error) {
    console.error('Create test session error:', error)
    return NextResponse.json({ error: 'Failed to create test approval session' }, { status: 500 })
  }
}

// GET endpoint removed - test data should only be generated through authenticated POST requests
