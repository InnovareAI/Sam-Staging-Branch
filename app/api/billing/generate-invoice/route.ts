import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db';

/**
 * POST /api/billing/generate-invoice
 *
 * Generates a monthly invoice for a workspace
 * 3cubed customers: $199 per seat (workspace) per month flat rate
 *
 * Billing cycles start when trial ends (billing_starts_at), not calendar months
 * Example: Trial ends Nov 3 → Bill Nov 3-Dec 2, Dec 3-Jan 2, etc.
 *
 * Body: {
 *   workspaceId: string
 *   billingPeriodStart?: string (ISO date) - Auto-calculated if omitted
 *   billingPeriodEnd?: string (ISO date) - Auto-calculated if omitted
 *   customAmount?: number (cents) - Override flat rate if needed
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const {
      workspaceId,
      billingPeriodStart: providedStart,
      billingPeriodEnd: providedEnd,
      customAmount
    } = await request.json()

    if (!workspaceId) {
      return NextResponse.json({
        error: 'Missing required field: workspaceId'
      }, { status: 400 })
    }

    // Flat rate: $199 per workspace per month (19900 cents)
    const FLAT_RATE_CENTS = 19900

    // Get workspace info
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, organization_id, trial_ends_at, billing_starts_at')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({
        error: 'Workspace not found'
      }, { status: 404 })
    }

    // Auto-calculate billing period if not provided
    let billingPeriodStart: string
    let billingPeriodEnd: string

    if (!providedStart || !providedEnd) {
      // Find the current billing cycle based on billing_starts_at
      const billingStartsAt = workspace.billing_starts_at ? new Date(workspace.billing_starts_at) : null

      if (!billingStartsAt) {
        return NextResponse.json({
          error: 'Workspace has no billing_starts_at date. Trial may not have ended yet.'
        }, { status: 400 })
      }

      // Calculate which billing cycle we're in
      const now = new Date()
      const dayOfMonth = billingStartsAt.getDate()

      // Start of current billing cycle
      const cycleStart = new Date(now.getFullYear(), now.getMonth(), dayOfMonth)
      if (cycleStart > now) {
        // If the billing day hasn't occurred this month, go back one month
        cycleStart.setMonth(cycleStart.getMonth() - 1)
      }

      // End of current billing cycle (day before next cycle starts)
      const cycleEnd = new Date(cycleStart)
      cycleEnd.setMonth(cycleEnd.getMonth() + 1)
      cycleEnd.setDate(cycleEnd.getDate() - 1)
      cycleEnd.setHours(23, 59, 59, 999)

      billingPeriodStart = cycleStart.toISOString()
      billingPeriodEnd = cycleEnd.toISOString()
    } else {
      billingPeriodStart = providedStart
      billingPeriodEnd = providedEnd
    }

    // Check if invoice already exists for this period
    const { data: existingInvoice } = await supabase
      .from('workspace_invoices')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('billing_period_start', billingPeriodStart)
      .single()

    if (existingInvoice) {
      return NextResponse.json({
        error: 'Invoice already exists for this billing period',
        existingInvoice
      }, { status: 409 })
    }

    // Retrieve usage data for the billing period (for record-keeping only)
    const { data: usageData, error: usageError } = await supabase
      .from('workspace_usage')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', billingPeriodStart)
      .lte('created_at', billingPeriodEnd)

    if (usageError) {
      console.error('Usage retrieval error:', usageError)
      return NextResponse.json({
        error: 'Failed to retrieve usage data'
      }, { status: 500 })
    }

    // Aggregate usage by type (for reporting purposes)
    const usage = {
      messages: 0,
      campaigns: 0,
      prospects: 0,
      ai_credits: 0
    }

    usageData?.forEach((record: any) => {
      switch (record.usage_type) {
        case 'message':
          usage.messages += record.quantity
          break
        case 'campaign':
          usage.campaigns += record.quantity
          break
        case 'prospect':
          usage.prospects += record.quantity
          break
        case 'ai_credits':
          usage.ai_credits += record.quantity
          break
      }
    })

    // Calculate total amount: Flat rate of $199 per workspace per month
    const totalAmountCents = customAmount || FLAT_RATE_CENTS

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('workspace_invoices')
      .insert({
        workspace_id: workspaceId,
        organization_id: workspace.organization_id,
        billing_period_start: billingPeriodStart,
        billing_period_end: billingPeriodEnd,
        total_messages: usage.messages,
        total_campaigns: usage.campaigns,
        total_prospects: usage.prospects,
        total_ai_credits: usage.ai_credits,
        total_amount_cents: totalAmountCents,
        currency: 'USD',
        status: 'draft'
      })
      .select()
      .single()

    if (invoiceError) {
      console.error('Invoice creation error:', invoiceError)
      return NextResponse.json({
        error: 'Failed to create invoice'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        workspace_name: workspace.name,
        total_amount_dollars: (totalAmountCents / 100).toFixed(2),
        billing_model: 'flat_rate',
        rate_description: '$199 per workspace per month',
        usage_summary: {
          messages: usage.messages,
          campaigns: usage.campaigns,
          prospects: usage.prospects,
          ai_credits: usage.ai_credits
        }
      }
    })

  } catch (error) {
    console.error('Invoice generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate invoice' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/billing/generate-invoice?workspaceId={id}&status={status}
 *
 * Retrieves invoices for a workspace
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const organizationId = searchParams.get('organizationId')
    const status = searchParams.get('status')

    let query = supabase
      .from('workspace_invoices')
      .select('*, workspaces(name)')
      .order('billing_period_start', { ascending: false })

    // Filter by workspace or organization
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId)
    } else if (organizationId) {
      query = query.eq('organization_id', organizationId)
    } else {
      return NextResponse.json({
        error: 'Missing required parameter: workspaceId or organizationId'
      }, { status: 400 })
    }

    // Filter by status
    if (status) {
      query = query.eq('status', status)
    }

    const { data: invoices, error: invoicesError } = await query

    if (invoicesError) {
      console.error('Invoice retrieval error:', invoicesError)
      return NextResponse.json({
        error: 'Failed to retrieve invoices'
      }, { status: 500 })
    }

    // Format invoices with dollar amounts
    const formattedInvoices = invoices?.map((invoice: any) => ({
      ...invoice,
      total_amount_dollars: (invoice.total_amount_cents / 100).toFixed(2)
    }))

    return NextResponse.json({
      success: true,
      invoices: formattedInvoices
    })

  } catch (error) {
    console.error('Invoice retrieval error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve invoices' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/billing/generate-invoice
 *
 * Updates an invoice (e.g., mark as finalized, sent, paid)
 *
 * Body: {
 *   invoiceId: string
 *   status?: 'draft' | 'finalized' | 'sent' | 'paid'
 *   stripeInvoiceId?: string
 *   invoicePdfUrl?: string
 *   notes?: string
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { invoiceId, status, stripeInvoiceId, invoicePdfUrl, notes } = await request.json()

    if (!invoiceId) {
      return NextResponse.json({
        error: 'Missing required field: invoiceId'
      }, { status: 400 })
    }

    // Build update object
    const updates: any = {}
    if (status) updates.status = status
    if (stripeInvoiceId) updates.stripe_invoice_id = stripeInvoiceId
    if (invoicePdfUrl) updates.invoice_pdf_url = invoicePdfUrl
    if (notes) updates.notes = notes

    const { data: invoice, error: updateError } = await supabase
      .from('workspace_invoices')
      .update(updates)
      .eq('id', invoiceId)
      .select()
      .single()

    if (updateError) {
      console.error('Invoice update error:', updateError)
      return NextResponse.json({
        error: 'Failed to update invoice'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      invoice
    })

  } catch (error) {
    console.error('Invoice update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update invoice' },
      { status: 500 }
    )
  }
}
