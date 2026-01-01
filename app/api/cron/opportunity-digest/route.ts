import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';
const POSTMARK_API_KEY = process.env.POSTMARK_SERVER_TOKEN;

interface OpportunityPost {
  id: string;
  post_linkedin_id: string;
  share_url: string;
  post_content: string;
  author_name: string;
  author_headline?: string;
  author_company?: string;
  reactions_count: number;
  comments_count: number;
  quality_score: number;
  post_date: string;
  monitor?: {
    id: string;
    name: string;
    monitor_type: string;
  };
}

interface WorkspaceSettings {
  workspace_id: string;
  digest_email: string;
  digest_timezone: string;
  opportunity_digest_enabled: boolean;
  opportunity_digest_time: string;
}

/**
 * POST /api/cron/opportunity-digest
 * Send daily "Opportunity Digest" emails highlighting trending posts worth engaging with
 *
 * This is DIFFERENT from the commenting-digest:
 * - commenting-digest: Shows pending comments waiting for approval
 * - opportunity-digest: Shows HIGH-QUALITY posts that haven't been commented on yet
 *
 * Added Dec 30, 2025
 *
 * Query params:
 * - test_email: Send test digest to this email instead of workspace emails
 * - workspace_id: Only process this workspace (for testing)
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Fail-closed if CRON_SECRET not configured
    if (!CRON_SECRET) {
      console.error('❌ CRON_SECRET not configured - rejecting request');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    // Verify cron secret
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const testEmail = request.nextUrl.searchParams.get('test_email');
    const testWorkspaceId = request.nextUrl.searchParams.get('workspace_id');

    console.log('🎯 Starting opportunity digest cron...');
    console.log(`🧪 Test mode: ${testEmail ? `sending to ${testEmail}` : 'OFF'}`);

    const supabase = pool;

    // Get workspaces with opportunity digest enabled
    let workspacesQuery = supabase
      .from('linkedin_brand_guidelines')
      .select('workspace_id, digest_email, digest_timezone, opportunity_digest_enabled, opportunity_digest_time')
      .eq('opportunity_digest_enabled', true)
      .not('digest_email', 'is', null);

    if (testWorkspaceId) {
      workspacesQuery = workspacesQuery.eq('workspace_id', testWorkspaceId);
    }

    const { data: workspaces, error: wsError } = await workspacesQuery;

    if (wsError) {
      console.error('Error fetching workspaces:', wsError);
      return NextResponse.json({ error: wsError.message }, { status: 500 });
    }

    console.log(`📋 Found ${workspaces?.length || 0} workspaces with opportunity digest enabled`);

    let totalSent = 0;
    const results: { workspace_id: string; email: string; posts_count: number; success: boolean; error?: string }[] = [];

    for (const ws of (workspaces || []) as WorkspaceSettings[]) {
      try {
        console.log(`\n🎯 Processing workspace ${ws.workspace_id}`);

        // Get high-quality discovered posts from last 48 hours that:
        // 1. Have NOT been commented on (no matching record in linkedin_post_comments)
        // 2. Have good engagement (quality_score >= 40)
        // 3. Are recent (within 48 hours)
        // 4. Are not already skipped
        const { data: opportunities, error: postsError } = await supabase
          .from('linkedin_posts_discovered')
          .select(`
            id,
            post_linkedin_id,
            share_url,
            post_content,
            author_name,
            author_headline,
            author_company,
            reactions_count,
            comments_count,
            quality_score,
            post_date,
            monitor:linkedin_post_monitors (
              id,
              name,
              monitor_type
            )
          `)
          .eq('workspace_id', ws.workspace_id)
          .eq('status', 'pending')
          .gte('quality_score', 40) // Only high-quality posts
          .gte('post_date', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()) // Last 48 hours
          .order('quality_score', { ascending: false })
          .limit(10);

        if (postsError) {
          console.error(`Error fetching opportunities for ${ws.workspace_id}:`, postsError);
          results.push({ workspace_id: ws.workspace_id, email: ws.digest_email, posts_count: 0, success: false, error: postsError.message });
          continue;
        }

        const posts = (opportunities || []) as OpportunityPost[];
        console.log(`🎯 Found ${posts.length} high-quality opportunity posts`);

        if (posts.length === 0) {
          console.log('No opportunities found, skipping email');
          results.push({ workspace_id: ws.workspace_id, email: ws.digest_email, posts_count: 0, success: true });
          continue;
        }

        // Build email content
        const emailTo = testEmail || ws.digest_email;
        const emailHtml = buildOpportunityDigestHtml(posts, ws.workspace_id);
        const emailText = buildOpportunityDigestText(posts);

        // Send via Postmark
        if (!POSTMARK_API_KEY) {
          console.error('POSTMARK_SERVER_TOKEN not configured');
          results.push({ workspace_id: ws.workspace_id, email: emailTo, posts_count: posts.length, success: false, error: 'Email not configured' });
          continue;
        }

        const emailResponse = await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': POSTMARK_API_KEY
          },
          body: JSON.stringify({
            From: 'sam@meet-sam.com',
            To: emailTo,
            Subject: `🎯 ${posts.length} Engagement Opportunities Today`,
            HtmlBody: emailHtml,
            TextBody: emailText,
            MessageStream: 'outbound'
          })
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`Failed to send opportunity digest to ${emailTo}:`, errorText);
          results.push({ workspace_id: ws.workspace_id, email: emailTo, posts_count: posts.length, success: false, error: errorText });
          continue;
        }

        console.log(`✅ Sent opportunity digest to ${emailTo} with ${posts.length} posts`);
        totalSent++;
        results.push({ workspace_id: ws.workspace_id, email: emailTo, posts_count: posts.length, success: true });

      } catch (wsError) {
        console.error(`Error processing workspace ${ws.workspace_id}:`, wsError);
        results.push({
          workspace_id: ws.workspace_id,
          email: ws.digest_email,
          posts_count: 0,
          success: false,
          error: wsError instanceof Error ? wsError.message : 'Unknown error'
        });
      }
    }

    console.log(`\n📊 Opportunity Digest Summary: ${totalSent} emails sent`);

    return NextResponse.json({
      success: true,
      digests_sent: totalSent,
      results
    });

  } catch (error) {
    console.error('❌ Opportunity Digest cron error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Build HTML email for opportunity digest
 */
function buildOpportunityDigestHtml(posts: OpportunityPost[], workspaceId: string): string {
  const postRows = posts.map((post, idx) => {
    const truncatedContent = post.post_content?.length > 200
      ? post.post_content.substring(0, 200) + '...'
      : post.post_content || 'No content preview';

    const qualityColor = post.quality_score >= 70 ? '#22c55e' :
                         post.quality_score >= 50 ? '#eab308' : '#f97316';

    const monitorBadge = post.monitor
      ? `<span style="background: #1e293b; color: #94a3b8; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${post.monitor.name}</span>`
      : '';

    return `
      <tr>
        <td style="padding: 16px; border-bottom: 1px solid #374151;">
          <div style="margin-bottom: 8px;">
            <strong style="color: #f9fafb; font-size: 14px;">${post.author_name}</strong>
            ${post.author_headline ? `<br><span style="color: #9ca3af; font-size: 12px;">${post.author_headline}</span>` : ''}
            ${monitorBadge}
          </div>
          <p style="color: #d1d5db; font-size: 13px; margin: 8px 0; line-height: 1.5;">${truncatedContent}</p>
          <div style="display: flex; align-items: center; gap: 16px; margin-top: 12px;">
            <span style="color: ${qualityColor}; font-size: 12px; font-weight: 600;">Score: ${post.quality_score}</span>
            <span style="color: #9ca3af; font-size: 12px;">👍 ${post.reactions_count} reactions</span>
            <span style="color: #9ca3af; font-size: 12px;">💬 ${post.comments_count} comments</span>
          </div>
          <div style="margin-top: 12px;">
            <a href="${post.share_url}" style="background: #ec4899; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500;">View Post & Comment</a>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="background: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #1f2937; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎯 Engagement Opportunities</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">${posts.length} high-quality posts worth engaging with today</p>
        </div>

        <div style="padding: 16px;">
          <p style="color: #9ca3af; font-size: 13px; margin: 0 0 16px 0;">
            These posts from your monitored profiles and hashtags have high engagement potential.
            Commenting on these could help build valuable relationships.
          </p>

          <table style="width: 100%; border-collapse: collapse; background: #111827; border-radius: 8px; overflow: hidden;">
            ${postRows}
          </table>
        </div>

        <div style="padding: 16px; text-align: center; border-top: 1px solid #374151;">
          <a href="${APP_URL}/workspace/${workspaceId}/commenting-agent" style="color: #ec4899; text-decoration: none; font-size: 13px;">Open Commenting Agent →</a>
        </div>

        <div style="padding: 16px; text-align: center; background: #111827;">
          <p style="color: #6b7280; font-size: 11px; margin: 0;">
            Sent by Sam AI • <a href="${APP_URL}/workspace/${workspaceId}/commenting-agent" style="color: #6b7280;">Manage Settings</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Build plain text email for opportunity digest
 */
function buildOpportunityDigestText(posts: OpportunityPost[]): string {
  const lines = [
    `🎯 ENGAGEMENT OPPORTUNITIES`,
    `${posts.length} high-quality posts worth engaging with today`,
    '',
    '---',
    ''
  ];

  posts.forEach((post, idx) => {
    const truncatedContent = post.post_content?.length > 150
      ? post.post_content.substring(0, 150) + '...'
      : post.post_content || 'No content';

    lines.push(`${idx + 1}. ${post.author_name}`);
    if (post.author_headline) lines.push(`   ${post.author_headline}`);
    lines.push(`   "${truncatedContent}"`);
    lines.push(`   Score: ${post.quality_score} | 👍 ${post.reactions_count} | 💬 ${post.comments_count}`);
    lines.push(`   ${post.share_url}`);
    lines.push('');
  });

  lines.push('---');
  lines.push('Sent by Sam AI');

  return lines.join('\n');
}

// Also support GET for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Opportunity Digest endpoint. Use POST with x-cron-secret header.',
    test_url: '/api/cron/opportunity-digest?test_email=your@email.com&workspace_id=xxx'
  });
}
