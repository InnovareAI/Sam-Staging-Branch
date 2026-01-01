import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// Service role client for admin access
// Pool imported from lib/db
// Failed statuses to include
const FAILED_STATUSES = [
  'failed',
  'error',
  'already_invited',
  'invitation_declined',
  'rate_limited',
  'rate_limited_cr',
  'rate_limited_message',
  'bounced'
];

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;

    // Get campaign info
    const { data: campaign, error: campaignError } = await pool
      .from('campaigns')
      .select('campaign_name, name, workspace_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get failed prospects
    const { data: prospects, error } = await pool
      .from('campaign_prospects')
      .select('first_name, last_name, email, company_name, title, linkedin_url, linkedin_user_id, status, notes, updated_at')
      .eq('campaign_id', campaignId)
      .in('status', FAILED_STATUSES)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch prospects:', error);
      return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({ error: 'No failed prospects found' }, { status: 404 });
    }

    // Get error messages from send_queue
    const { data: queueErrors } = await pool
      .from('send_queue')
      .select('linkedin_user_id, error_message')
      .eq('campaign_id', campaignId)
      .eq('status', 'failed');

    const errorMap: Record<string, string> = {};
    (queueErrors || []).forEach(q => {
      if (q.linkedin_user_id && q.error_message) {
        errorMap[q.linkedin_user_id] = q.error_message;
      }
    });

    // Build CSV
    const headers = ['First Name', 'Last Name', 'Email', 'Company', 'Title', 'LinkedIn URL', 'LinkedIn ID', 'Status', 'Error Reason', 'Notes', 'Failed At'];

    const rows = prospects.map(p => [
      escapeCsv(p.first_name || ''),
      escapeCsv(p.last_name || ''),
      escapeCsv(p.email || ''),
      escapeCsv(p.company_name || ''),
      escapeCsv(p.title || ''),
      escapeCsv(p.linkedin_url || ''),
      escapeCsv(p.linkedin_user_id || ''),
      escapeCsv(p.status || ''),
      escapeCsv(errorMap[p.linkedin_user_id] || p.notes || ''),
      escapeCsv(p.notes || ''),
      p.updated_at ? new Date(p.updated_at).toISOString() : ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    // Return as downloadable CSV
    const campaignDisplayName = campaign.campaign_name || campaign.name || campaignId;
    const filename = `failed-prospects-${campaignDisplayName.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('CSV export error:', error);
    return NextResponse.json({ error: 'Failed to export CSV' }, { status: 500 });
  }
}

function escapeCsv(value: string): string {
  if (!value) return '';
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
