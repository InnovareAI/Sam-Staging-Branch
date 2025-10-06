import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/app/lib/supabase'
import { createPostmarkHelper } from '@/lib/postmark-helper'
import { generateTrialConfirmationEmail } from '@/lib/email-templates'

const PLAN_PRICES = {
  perseat: 99,
  sme: 349
}

/**
 * POST /api/auth/send-trial-confirmation
 *
 * Send trial confirmation email with account details and trial information
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const body = await request.json()
    const { workspaceId, userId, plan } = body

    // Validate input
    if (!workspaceId || !userId || !plan) {
      return NextResponse.json({
        error: 'Missing required fields: workspaceId, userId, plan'
      }, { status: 400 })
    }

    if (!['perseat', 'sme'].includes(plan)) {
      return NextResponse.json({
        error: 'Invalid plan. Must be "perseat" or "sme"'
      }, { status: 400 })
    }

    // Fetch user details
    const { data: profile } = await supabase
      .from('users')
      .select('email, first_name, last_name')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch workspace details
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name, slug')
      .eq('id', workspaceId)
      .single()

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Fetch subscription trial end date
    const { data: subscription } = await supabase
      .from('workspace_subscriptions')
      .select('trial_end')
      .eq('workspace_id', workspaceId)
      .single()

    const trialEndDate = subscription?.trial_end
      ? new Date(subscription.trial_end)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // Default: 14 days from now

    // Determine company (InnovareAI is default)
    const company = 'InnovareAI' // TODO: Add logic to detect company based on workspace or subdomain

    // Generate email content
    const emailTemplate = generateTrialConfirmationEmail({
      recipientEmail: profile.email,
      recipientName: profile.first_name,
      workspaceName: workspace.name,
      plan: plan as 'perseat' | 'sme',
      planPrice: PLAN_PRICES[plan as 'perseat' | 'sme'],
      trialEndDate,
      loginLink: process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com',
      company
    })

    // Send email using Postmark
    const postmarkHelper = createPostmarkHelper(company)
    if (!postmarkHelper) {
      console.error('Failed to create Postmark helper')
      return NextResponse.json({
        error: 'Email service not configured'
      }, { status: 500 })
    }

    const emailResult = await postmarkHelper.sendEmailSafely({
      To: emailTemplate.to,
      From: emailTemplate.from,
      Subject: emailTemplate.subject,
      HtmlBody: emailTemplate.htmlBody,
      TextBody: emailTemplate.textBody,
      MessageStream: emailTemplate.messageStream
    })

    if (!emailResult.success) {
      console.error('Failed to send trial confirmation email:', emailResult.error)
      return NextResponse.json({
        error: 'Failed to send confirmation email',
        details: emailResult.error
      }, { status: 500 })
    }

    console.log('✅ Trial confirmation email sent:', {
      to: profile.email,
      workspace: workspace.name,
      plan,
      messageId: emailResult.messageId
    })

    return NextResponse.json({
      success: true,
      messageId: emailResult.messageId,
      message: 'Trial confirmation email sent successfully'
    })

  } catch (error) {
    console.error('Send trial confirmation email error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send confirmation email'
      },
      { status: 500 }
    )
  }
}
