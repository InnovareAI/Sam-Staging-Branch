import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * POST /api/workspace/invite
 *
 * Create a workspace invitation and send email
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceId, email, role = 'member' } = await request.json()

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
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only workspace admins can send invitations' },
        { status: 403 }
      )
    }

    // Check if user already exists in workspace
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', (
        await supabase.from('users').select('id').eq('email', email).single()
      ).data?.id || '')
      .single()

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this workspace' },
        { status: 409 }
      )
    }

    // Check if pending invitation already exists
    const { data: existingInvite } = await supabase
      .from('workspace_invitations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('invited_email', email.toLowerCase())
      .eq('status', 'pending')
      .single()

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email' },
        { status: 409 }
      )
    }

    // Generate invitation token
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: tokenData } = await supabaseAdmin
      .rpc('generate_invitation_token')

    const token = tokenData || crypto.randomUUID()

    // Get workspace name
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single()

    // Create invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('workspace_invitations')
      .insert({
        workspace_id: workspaceId,
        invited_by: user.id,
        invited_email: email.toLowerCase(),
        role,
        token,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Invitation creation error:', inviteError)
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      )
    }

    // Send invitation email
    try {
      const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/signup/innovareai?invite=${token}`

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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get invitation details
    const { data: invitation, error } = await supabase
      .from('workspace_invitations')
      .select('*, workspaces(name)')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (error || !invitation) {
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
          name: invitation.workspaces?.name
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
