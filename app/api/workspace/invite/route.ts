import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool, AuthError } from '@/lib/auth'

/**
 * POST /api/workspace/invite
 *
 * Create a workspace invitation and send email
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user via Firebase
    let userId: string
    let workspaceId: string | undefined

    try {
      const auth = await verifyAuth(request)
      userId = auth.userId
      workspaceId = auth.workspaceId
    } catch (authError) {
      const err = authError as AuthError
      return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.statusCode || 401 })
    }

    const body = await request.json()
    const email = body.email
    const role = body.role || 'member'
    // Use workspaceId from body if provided, otherwise use from header
    workspaceId = body.workspaceId || workspaceId

    // Validate input
    if (!workspaceId || !email) {
      return NextResponse.json(
        { error: 'workspaceId and email are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Validate role
    if (!['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, member, or viewer' },
        { status: 400 }
      )
    }

    // Check if user is admin of the workspace
    const { rows: membershipRows } = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    )

    const membership = membershipRows[0]
    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only workspace admins can send invitations' },
        { status: 403 }
      )
    }

    // Check if user already exists in workspace (by email)
    const { rows: existingUserRows } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )

    if (existingUserRows.length > 0) {
      const existingUserId = existingUserRows[0].id
      const { rows: existingMemberRows } = await pool.query(
        'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, existingUserId]
      )

      if (existingMemberRows.length > 0) {
        return NextResponse.json(
          { error: 'User is already a member of this workspace' },
          { status: 409 }
        )
      }
    }

    // Check if pending invitation already exists
    const { rows: existingInviteRows } = await pool.query(
      `SELECT id FROM workspace_invitations
       WHERE workspace_id = $1 AND invited_email = $2 AND status = 'pending'`,
      [workspaceId, email.toLowerCase()]
    )

    if (existingInviteRows.length > 0) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email' },
        { status: 409 }
      )
    }

    // Generate invitation token
    const token = crypto.randomUUID()

    // Get workspace name
    const { rows: workspaceRows } = await pool.query(
      'SELECT name FROM workspaces WHERE id = $1',
      [workspaceId]
    )
    const workspace = workspaceRows[0]

    // Create invitation
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { rows: invitationRows } = await pool.query(
      `INSERT INTO workspace_invitations (workspace_id, invited_by, invited_email, role, token, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING id, invited_email, role, expires_at`,
      [workspaceId, userId, email.toLowerCase(), role, token, expiresAt]
    )

    const invitation = invitationRows[0]

    if (!invitation) {
      console.error('Invitation creation failed')
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      )
    }

    // Send invitation email
    try {
      const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/signup/innovareai?invite=${token}`

      await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN!
        },
        body: JSON.stringify({
          From: 'noreply@innovareai.com',
          To: email,
          Subject: `You've been invited to join ${workspace?.name || 'a workspace'} on SAM AI`,
          HtmlBody: `
            <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #8907FF;">You're Invited to SAM AI!</h2>
                  <p>You've been invited to join <strong>${workspace?.name || 'a workspace'}</strong> on SAM AI.</p>
                  <p>Click the button below to accept your invitation and create your account:</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${inviteUrl}" style="background-color: #8907FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                      Accept Invitation
                    </a>
                  </div>
                  <p style="color: #666; font-size: 14px;">
                    This invitation will expire in 7 days.
                  </p>
                  <p style="color: #666; font-size: 14px;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="${inviteUrl}">${inviteUrl}</a>
                  </p>
                </div>
              </body>
            </html>
          `,
          TextBody: `You've been invited to join ${workspace?.name || 'a workspace'} on SAM AI.\n\nAccept your invitation: ${inviteUrl}\n\nThis invitation will expire in 7 days.`
        })
      })
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      // Don't fail the request if email fails - invitation is still created
    }

    return NextResponse.json({
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.invited_email,
        role: invitation.role,
        expires_at: invitation.expires_at
      }
    })

  } catch (error) {
    console.error('Workspace invitation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/workspace/invite?token=xyz
 *
 * Validate an invitation token
 * Note: This is a public endpoint that doesn't require authentication
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Get invitation details with workspace name
    const { rows: invitationRows } = await pool.query(
      `SELECT wi.*, w.name as workspace_name
       FROM workspace_invitations wi
       JOIN workspaces w ON wi.workspace_id = w.id
       WHERE wi.token = $1 AND wi.status = 'pending'`,
      [token]
    )

    const invitation = invitationRows[0]

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 404 }
      )
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      )
    }

    return NextResponse.json({
      valid: true,
      invitation: {
        email: invitation.invited_email,
        role: invitation.role,
        workspace: {
          id: invitation.workspace_id,
          name: invitation.workspace_name
        }
      }
    })

  } catch (error) {
    console.error('Invitation validation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
