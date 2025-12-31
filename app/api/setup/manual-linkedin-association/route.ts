import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Authenticate with Firebase
    const { userId, userEmail } = await verifyAuth(request)

    console.log(`🔧 Manual LinkedIn association for user: ${userEmail}`)

    // Get the latest Thorsten Linz LinkedIn account from the request (created today)
    const thorstenLinkedInAccountId = 'isCX0_ZQStWs1xxqilsw5Q' // From Unipile accounts list
    const publicIdentifier = 'tvonlinz'
    const accountName = 'Thorsten Linz'

    // Check if association already exists
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM user_unipile_accounts WHERE user_id = $1 AND unipile_account_id = $2',
      [userId, thorstenLinkedInAccountId]
    )

    if (existingRows.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'LinkedIn account already associated',
        association: existingRows[0],
        timestamp: new Date().toISOString()
      })
    }

    // Create the association using upsert
    const { rows } = await pool.query(
      `INSERT INTO user_unipile_accounts (
        user_id, unipile_account_id, platform, account_name, account_email,
        linkedin_public_identifier, linkedin_profile_url, connection_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (unipile_account_id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        account_name = EXCLUDED.account_name,
        account_email = EXCLUDED.account_email,
        linkedin_public_identifier = EXCLUDED.linkedin_public_identifier,
        linkedin_profile_url = EXCLUDED.linkedin_profile_url,
        connection_status = EXCLUDED.connection_status,
        updated_at = NOW()
      RETURNING *`,
      [
        userId,
        thorstenLinkedInAccountId,
        'LINKEDIN',
        accountName,
        null,
        publicIdentifier,
        `https://linkedin.com/in/${publicIdentifier}`,
        'active'
      ]
    )

    const newAssociation = rows[0]

    if (!newAssociation) {
      console.error('Error creating LinkedIn association')
      return NextResponse.json({
        success: false,
        error: 'Failed to create association',
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    console.log(`✅ Successfully associated LinkedIn account ${accountName} with user ${userEmail}`)

    return NextResponse.json({
      success: true,
      message: 'LinkedIn account successfully associated',
      association: newAssociation,
      account_details: {
        account_id: thorstenLinkedInAccountId,
        account_name: accountName,
        public_identifier: publicIdentifier,
        platform: 'LINKEDIN',
        status: 'active'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in manual LinkedIn association:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}