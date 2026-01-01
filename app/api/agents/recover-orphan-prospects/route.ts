import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/**
 * ORPHAN PROSPECT RECOVERY AGENT
 *
 * Runs every hour to find and fix prospects that were approved but never
 * made it to campaign_prospects table (due to bulk insert failures, etc.)
 *
 * What it does:
 * 1. Finds sessions with approved prospects that have campaigns
 * 2. Checks if those prospects exist in campaign_prospects
 * 3. Adds missing prospects to campaign_prospects
 * 4. Adds missing prospects to send_queue (if campaign is active)
 * 5. Sends alert to Google Chat with recovery summary
 */

const GOOGLE_CHAT_WEBHOOK = process.env.GOOGLE_CHAT_WEBHOOK_URL;

interface OrphanProspect {
  id: string;
  prospect_id: string;
  name: string;
  title: string;
  contact: { email?: string; linkedin_url?: string };
  company: { name?: string };
  connection_degree: number;
  session_id: string;
  workspace_id: string;
}

interface RecoveryResult {
  sessionId: string;
  campaignId: string;
  campaignName: string;
  orphansFound: number;
  recovered: number;
  queuedForSending: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🔍 Starting orphan prospect recovery agent...');

  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Find sessions with campaigns that have approved prospects
    const { data: sessions, error: sessionsError } = await supabase
      .from('prospect_approval_sessions')
      .select(`
        id,
        campaign_id,
        campaign_name,
        workspace_id,
        total_prospects,
        approved_count,
        completed_at
      `)
      .not('campaign_id', 'is', null)
      .eq('status', 'completed')
      .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('completed_at', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      throw sessionsError;
    }

    if (!sessions || sessions.length === 0) {
      console.log('✅ No recent sessions with campaigns found');
      return NextResponse.json({ success: true, message: 'No sessions to check' });
    }

    console.log(`📋 Found ${sessions.length} sessions to check`);

    const results: RecoveryResult[] = [];
    let totalOrphansFound = 0;
    let totalRecovered = 0;

    // 2. Check each session for orphan prospects
    for (const session of sessions) {
      console.log(`\n🔎 Checking session ${session.id} (${session.campaign_name})`);

      // Get approved prospects from approval data
      const { data: approvedProspects, error: approvedError } = await supabase
        .from('prospect_approval_data')
        .select('id, prospect_id, name, title, contact, company, connection_degree')
        .eq('session_id', session.id)
        .eq('approval_status', 'approved');

      if (approvedError || !approvedProspects) {
        console.error(`Error fetching approved prospects for session ${session.id}:`, approvedError);
        continue;
      }

      if (approvedProspects.length === 0) {
        console.log(`  No approved prospects in session`);
        continue;
      }

      // Get existing campaign prospects
      const { data: existingProspects, error: existingError } = await supabase
        .from('campaign_prospects')
        .select('linkedin_url, email')
        .eq('campaign_id', session.campaign_id);

      if (existingError) {
        console.error(`Error fetching campaign prospects:`, existingError);
        continue;
      }

      // Build set of existing identifiers
      const existingUrls = new Set(existingProspects?.map(p => p.linkedin_url?.toLowerCase()).filter(Boolean));
      const existingEmails = new Set(existingProspects?.map(p => p.email?.toLowerCase()).filter(Boolean));

      // Find orphans (approved but not in campaign)
      const orphans: OrphanProspect[] = [];
      for (const prospect of approvedProspects) {
        const linkedinUrl = prospect.contact?.linkedin_url?.toLowerCase();
        const email = prospect.contact?.email?.toLowerCase();

        // Check if already in campaign by LinkedIn URL or email
        const alreadyExists =
          (linkedinUrl && existingUrls.has(linkedinUrl)) ||
          (email && existingEmails.has(email));

        if (!alreadyExists && (linkedinUrl || email)) {
          orphans.push({
            ...prospect,
            session_id: session.id,
            workspace_id: session.workspace_id
          } as OrphanProspect);
        }
      }

      if (orphans.length === 0) {
        console.log(`  ✅ All ${approvedProspects.length} prospects accounted for`);
        continue;
      }

      console.log(`  ⚠️ Found ${orphans.length} orphan prospects`);
      totalOrphansFound += orphans.length;

      // 3. Recover orphans - add to campaign_prospects
      const result: RecoveryResult = {
        sessionId: session.id,
        campaignId: session.campaign_id,
        campaignName: session.campaign_name,
        orphansFound: orphans.length,
        recovered: 0,
        queuedForSending: 0,
        errors: []
      };

      // Get campaign details for queue creation
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('status, message_templates, linkedin_account_id')
        .eq('id', session.campaign_id)
        .single();

      for (const orphan of orphans) {
        try {
          // Parse name
          const nameParts = orphan.name?.split(' ') || ['Unknown'];
          const firstName = nameParts[0] || 'Unknown';
          const lastName = nameParts.slice(1).join(' ') || '';
          const linkedinUrl = orphan.contact?.linkedin_url || null;

          // Convert connection degree
          let connectionDegreeStr: string | null = null;
          if (orphan.connection_degree === 1) connectionDegreeStr = '1st';
          else if (orphan.connection_degree === 2) connectionDegreeStr = '2nd';
          else if (orphan.connection_degree === 3) connectionDegreeStr = '3rd';

          // Insert into campaign_prospects
          const { data: newProspect, error: insertError } = await supabase
            .from('campaign_prospects')
            .insert({
              campaign_id: session.campaign_id,
              workspace_id: session.workspace_id,
              first_name: firstName,
              last_name: lastName,
              email: orphan.contact?.email || null,
              company_name: orphan.company?.name || '',
              title: orphan.title || '',
              linkedin_url: linkedinUrl,
              linkedin_user_id: linkedinUrl, // Use URL as ID for queue processing
              connection_degree: connectionDegreeStr,
              status: 'approved',
              personalization_data: {
                source: 'orphan_recovery',
                original_session_id: session.id,
                recovered_at: new Date().toISOString()
              }
            })
            .select('id')
            .single();

          if (insertError) {
            result.errors.push(`${orphan.name}: ${insertError.message}`);
            console.warn(`  ❌ Failed to recover ${orphan.name}: ${insertError.message}`);
            continue;
          }

          result.recovered++;
          console.log(`  ✅ Recovered ${orphan.name}`);

          // 4. If campaign is active and has LinkedIn, add to send queue
          if (campaign?.status === 'active' && campaign.linkedin_account_id && linkedinUrl && newProspect) {
            const connectionMessage = campaign.message_templates?.connection_request || '';

            if (connectionMessage) {
              // Calculate next available slot (30 min from now + 2 min per existing queue item)
              const { count: queueCount } = await supabase
                .from('send_queue')
                .select('id', { count: 'exact', head: true })
                .eq('campaign_id', session.campaign_id)
                .eq('status', 'pending');

              const scheduledFor = new Date(Date.now() + (30 + (queueCount || 0) * 2) * 60 * 1000);

              // Personalize message
              let message = connectionMessage
                .replace(/{first_name}/g, firstName)
                .replace(/{company_name}/g, orphan.company?.name || 'your company');

              const { error: queueError } = await supabase
                .from('send_queue')
                .insert({
                  campaign_id: session.campaign_id,
                  prospect_id: newProspect.id,
                  linkedin_user_id: linkedinUrl,
                  message: message,
                  scheduled_for: scheduledFor.toISOString(),
                  status: 'pending'
                });

              if (!queueError) {
                result.queuedForSending++;
                console.log(`  📤 Queued ${orphan.name} for sending`);
              }
            }
          }
        } catch (err) {
          result.errors.push(`${orphan.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      totalRecovered += result.recovered;
      if (result.recovered > 0 || result.errors.length > 0) {
        results.push(result);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // 5. Send summary to Google Chat if any recoveries were made
    if (totalRecovered > 0 && GOOGLE_CHAT_WEBHOOK) {
      const summaryLines = results.map(r =>
        `• *${r.campaignName}*: ${r.recovered}/${r.orphansFound} recovered${r.queuedForSending > 0 ? `, ${r.queuedForSending} queued` : ''}${r.errors.length > 0 ? ` (${r.errors.length} errors)` : ''}`
      );

      await fetch(GOOGLE_CHAT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🔧 *Orphan Prospect Recovery Complete*\n\n` +
            `Found ${totalOrphansFound} orphans, recovered ${totalRecovered}\n\n` +
            summaryLines.join('\n') +
            `\n\n_Duration: ${duration}s_`
        })
      });
    }

    console.log(`\n✅ Recovery complete: ${totalOrphansFound} found, ${totalRecovered} recovered in ${duration}s`);

    return NextResponse.json({
      success: true,
      orphansFound: totalOrphansFound,
      recovered: totalRecovered,
      results,
      duration: `${duration}s`
    });

  } catch (error) {
    console.error('❌ Recovery agent error:', error);

    // Alert on failure
    if (GOOGLE_CHAT_WEBHOOK) {
      await fetch(GOOGLE_CHAT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 *Orphan Prospect Recovery FAILED*\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
