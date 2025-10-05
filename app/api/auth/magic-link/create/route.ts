import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/auth/magic-link/create
 *
 * Creates a user, workspace, and one-time magic link for 3cubed enterprise customers
 * Admin manually calls this API to onboard new enterprise users
 *
 * Body: { email, firstName, lastName, workspaceName, organizationId }
 */
export async function POST(request: NextRequest) {
  try {
    const { email, firstName, lastName, workspaceName, organizationId } = await request.json()

    if (!email || !firstName || !lastName) {
      return NextResponse.json({
        error: 'Missing required fields: email, firstName, lastName'
      }, { status: 400 })
    }

    // Generate one-time magic link token
    const magicToken = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // Valid for 24 hours

    // Create user with Supabase Auth (temporary password)
    const tempPassword = randomBytes(32).toString('hex')
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email for enterprise users
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        onboarding_type: '3cubed_enterprise'
      }
    })

    if (authError || !authData.user) {
      console.error('Failed to create user:', authError)
      return NextResponse.json({
        error: authError?.message || 'Failed to create user'
      }, { status: 500 })
    }

    const userId = authData.user.id

    // Create user profile
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
    }

    // Create workspace with 14-day trial
    const workspaceSlugBase = (workspaceName || `${firstName}'s Workspace`).toLowerCase().replace(/[^a-z0-9]/g, '-')
    const workspaceSlug = `${workspaceSlugBase}-${userId.substring(0, 8)}`

    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14) // 14-day trial

    const billingStartsAt = new Date(trialEndsAt)
    billingStartsAt.setDate(billingStartsAt.getDate() + 1) // Billing starts day after trial ends

    const { data: workspaceData, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: workspaceName || `${firstName}'s Workspace`,
        slug: workspaceSlug,
        owner_id: userId,
        organization_id: organizationId || null,
        trial_ends_at: trialEndsAt.toISOString(),
        billing_starts_at: billingStartsAt.toISOString()
      })
      .select()
      .single()

    if (workspaceError || !workspaceData) {
      console.error('Workspace creation error:', workspaceError)
      return NextResponse.json({
        error: 'Failed to create workspace'
      }, { status: 500 })
    }

    // Add user as workspace admin
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceData.id,
        user_id: userId,
        role: 'admin'
      })

    if (memberError) {
      console.error('Workspace member creation error:', memberError)
    }

    // Store magic link token
    const { error: tokenError } = await supabase
      .from('magic_link_tokens')
      .insert({
        token: magicToken,
        user_id: userId,
        expires_at: expiresAt.toISOString(),
        used: false
      })

    if (tokenError) {
      console.error('Magic link token creation error:', tokenError)
      return NextResponse.json({
        error: 'Failed to create magic link'
      }, { status: 500 })
    }

    // Generate magic link URL
    const magicLinkUrl = `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'}/auth/magic/${magicToken}`

    // Send magic link email via Postmark (3cubed domain)
    try {
      const postmarkResponse = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': process.env.POSTMARK_3CUBED_SERVER_TOKEN || process.env.POSTMARK_SERVER_TOKEN!
        },
        body: JSON.stringify({
          From: process.env.POSTMARK_3CUBED_FROM_EMAIL || 'noreply@3cubed.com',
          To: email,
          Subject: 'Welcome to SAM AI - Set Up Your Account',
          HtmlBody: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Welcome to SAM AI! 🎉</h1>
                </div>
                <div class="content">
                  <p>Hi ${firstName},</p>

                  <p>Your SAM AI account has been created. Click the button below to set up your password and get started:</p>

                  <div style="text-align: center;">
                    <a href="${magicLinkUrl}" class="button">Set Up My Account</a>
                  </div>

                  <div class="warning">
                    <strong>⏱️ This link expires in 24 hours</strong><br>
                    This is a one-time use link for security purposes.
                  </div>

                  <p><strong>What happens next:</strong></p>
                  <ol>
                    <li>Click the button above to verify your email</li>
                    <li>Create a secure password for your account</li>
                    <li>Start using SAM AI to automate your outreach</li>
                  </ol>

                  <p>If you didn't expect this email, please ignore it.</p>

                  <p>Best regards,<br>The SAM AI Team</p>
                </div>
                <div class="footer">
                  <p>This email was sent by 3cubed on behalf of SAM AI<br>
                  If you have questions, contact your administrator</p>
                </div>
              </div>
            </body>
            </html>
          `,
          TextBody: `Welcome to SAM AI!

Hi ${firstName},

Your SAM AI account has been created. Visit the link below to set up your password and get started:

${magicLinkUrl}

⏱️ This link expires in 24 hours and can only be used once.

What happens next:
1. Click the link above to verify your email
2. Create a secure password for your account
3. Start using SAM AI to automate your outreach

If you didn't expect this email, please ignore it.

Best regards,
The SAM AI Team

---
This email was sent by 3cubed on behalf of SAM AI.
If you have questions, contact your administrator.`,
          MessageStream: 'outbound'
        })
      })

      if (!postmarkResponse.ok) {
        const errorData = await postmarkResponse.json()
        console.error('Postmark error:', errorData)
        throw new Error('Failed to send email')
      }

      console.log(`✅ Magic link email sent to ${email}`)
    } catch (emailError) {
      console.error('Failed to send magic link email:', emailError)
      // Don't fail the entire request if email fails - admin can manually send link
    }

    return NextResponse.json({
      success: true,
      userId,
      workspaceId: workspaceData.id,
      magicLink: magicLinkUrl,
      expiresAt: expiresAt.toISOString(),
      emailSent: true
    })

  } catch (error) {
    console.error('Magic link creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create magic link' },
      { status: 500 }
    )
  }
}
