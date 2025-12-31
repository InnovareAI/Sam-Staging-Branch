import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

// Helper to normalize LinkedIn URL to hash (vanity name only)
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i)
  if (match) return match[1].toLowerCase().trim()
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim()
}

/**
 * Quick Add Single Prospect API
 * Just paste LinkedIn URL - system handles everything automatically
 * DATABASE-FIRST: Upserts to workspace_prospects first
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Quick Add API called')

    // Firebase auth + workspace context
    const { userId, workspaceId } = await verifyAuth(request)

    console.log('Auth check:', {
      hasUser: true,
      userId: userId
    })

    const { linkedin_url, workspace_id, campaign_name } = await request.json()

    // Use workspace_id from body if provided, otherwise from auth context
    const effectiveWorkspaceId = workspace_id || workspaceId

    console.log('Request data:', { linkedin_url, workspace_id: effectiveWorkspaceId, campaign_name, userId })

    if (!linkedin_url) {
      return NextResponse.json({ error: 'LinkedIn URL required' }, { status: 400 })
    }

    if (!effectiveWorkspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    console.log('🚀 Quick Add Prospect:', linkedin_url)

    // Step 1: Extract LinkedIn username from URL
    const username = extractLinkedInUsername(linkedin_url)
    if (!username) {
      return NextResponse.json({
        error: 'Invalid LinkedIn URL. Expected format: https://linkedin.com/in/username'
      }, { status: 400 })
    }

    console.log('📝 Extracted username:', username)

    // Step 2: Check if it's a 1st degree connection (has chat ID)
    let linkedinUserId = null
    let connectionDegree = '2nd/3rd' // Default assumption
    let fullName = 'LinkedIn User'

    try {
      // Try to find this person in Unipile connections (with 5 second timeout)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const unipileResponse = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/users/${username}?account_id=${process.env.UNIPILE_ACCOUNT_ID}`, {
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY || ''
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (unipileResponse.ok) {
        const unipileData = await unipileResponse.json()

        // If we got profile data, they might be a connection
        if (unipileData.provider_id) {
          linkedinUserId = unipileData.provider_id
          connectionDegree = '1st' // They're in our connections
          fullName = unipileData.display_name || unipileData.name || 'LinkedIn User'
          console.log('✅ Found 1st degree connection:', linkedinUserId)
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not check Unipile connection, treating as 2nd/3rd degree')
      // Continue - we'll treat as 2nd/3rd degree connection
    }

    // Step 3: DATABASE-FIRST - Upsert to workspace_prospects master table
    const linkedinHash = normalizeLinkedInUrl(linkedin_url)

    // Check if prospect exists
    const existingResult = await pool.query(
      `SELECT id FROM workspace_prospects WHERE workspace_id = $1 AND linkedin_url_hash = $2`,
      [effectiveWorkspaceId, linkedinHash]
    )

    let masterProspectId: string
    if (existingResult.rows.length > 0) {
      // Update existing
      masterProspectId = existingResult.rows[0].id
      await pool.query(
        `UPDATE workspace_prospects SET
          first_name = $1,
          last_name = $2,
          linkedin_provider_id = $3,
          connection_status = $4,
          source = $5,
          updated_at = NOW()
        WHERE id = $6`,
        [
          fullName.split(' ')[0] || 'Unknown',
          fullName.split(' ').slice(1).join(' ') || '',
          linkedinUserId,
          connectionDegree === '1st' ? 'connected' : 'not_connected',
          'quick_add',
          masterProspectId
        ]
      )
    } else {
      // Insert new
      const insertResult = await pool.query(
        `INSERT INTO workspace_prospects
          (workspace_id, linkedin_url, linkedin_url_hash, first_name, last_name, linkedin_provider_id, connection_status, source, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id`,
        [
          effectiveWorkspaceId,
          linkedin_url,
          linkedinHash,
          fullName.split(' ')[0] || 'Unknown',
          fullName.split(' ').slice(1).join(' ') || '',
          linkedinUserId,
          connectionDegree === '1st' ? 'connected' : 'not_connected',
          'quick_add'
        ]
      )
      masterProspectId = insertResult.rows[0].id
    }

    console.log('✅ Upserted to workspace_prospects:', masterProspectId)

    // Step 4: Create approval session
    const sessionId = `quick_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    try {
      await pool.query(
        `INSERT INTO prospect_approval_sessions
          (id, workspace_id, campaign_name, status, total_count, approved_count, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          sessionId,
          effectiveWorkspaceId,
          campaign_name || `Quick Add - ${new Date().toLocaleDateString()}`,
          'pending',
          1,
          0,
          userId
        ]
      )
    } catch (sessionError) {
      console.error('Session creation error:', sessionError)
      throw new Error('Failed to create approval session')
    }

    // Step 5: Save prospect to approval database with master_prospect_id reference
    const prospectData = {
      session_id: sessionId,
      workspace_id: effectiveWorkspaceId,
      master_prospect_id: masterProspectId,  // FK to workspace_prospects
      contact: {
        name: fullName,
        linkedin_url: linkedin_url,
        linkedin_user_id: linkedinUserId,
        connection_degree: connectionDegree
      },
      source: 'quick_add',
      confidence_score: 0.8,
      status: 'pending'
    }

    try {
      await pool.query(
        `INSERT INTO prospect_approval_data
          (session_id, workspace_id, master_prospect_id, contact, source, confidence_score, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          prospectData.session_id,
          prospectData.workspace_id,
          prospectData.master_prospect_id,
          JSON.stringify(prospectData.contact),
          prospectData.source,
          prospectData.confidence_score,
          prospectData.status
        ]
      )
    } catch (insertError) {
      console.error('Prospect insert error:', insertError)
      throw new Error('Failed to save prospect')
    }

    console.log('✅ Prospect saved to database')

    // Step 6: Return success with prospect data
    return NextResponse.json({
      success: true,
      message: connectionDegree === '1st'
        ? '✅ Added as 1st degree connection (Messenger campaign ready)'
        : '✅ Added as 2nd/3rd degree (Connector campaign ready)',
      campaign_type_suggestion: connectionDegree === '1st' ? 'messenger' : 'connector',
      session_id: sessionId,
      prospect: {
        name: fullName,
        linkedin_url: linkedin_url,
        linkedin_user_id: linkedinUserId,
        connection_degree: connectionDegree,
        source: 'quick_add'
      }
    })

  } catch (error: any) {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Quick add prospect error:', error)
    return NextResponse.json({
      error: 'Failed to add prospect',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Extract LinkedIn username from various URL formats
 */
function extractLinkedInUsername(url: string): string | null {
  try {
    // Handle various LinkedIn URL formats
    const patterns = [
      /linkedin\.com\/in\/([^\/\?]+)/i,           // https://linkedin.com/in/username
      /linkedin\.com\/profile\/view\?id=([^&]+)/i // Old format
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    return null
  } catch (error) {
    return null
  }
}
