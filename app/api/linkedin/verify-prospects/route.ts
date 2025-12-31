import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

/**
 * Verify prospects against existing campaign data
 *
 * Checks for:
 * 1. Previously contacted prospects (CR sent, connected, replied)
 * 2. Pending invitations (already_invited status)
 * 3. Failed attempts (failed status with error details)
 * 4. Duplicate entries across campaigns
 *
 * Returns prospects categorized by their status for user review.
 */

interface ProspectToVerify {
  id?: string;
  linkedin_url?: string;
  linkedinUrl?: string;
  contact?: { linkedin_url?: string; email?: string };
  email?: string;
  name?: string;
}

interface ExistingProspect {
  id: string;
  linkedin_url: string | null;
  email: string | null;
  first_name: string;
  last_name: string;
  status: string;
  error_message?: string;
  campaign_id: string;
  contacted_at: string | null;
  created_at: string;
  campaign_name?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { userId, workspaceId: authWorkspaceId } = await verifyAuth(req);

    const body = await req.json();
    const { prospects, workspaceId: bodyWorkspaceId } = body;

    // Use workspaceId from body if provided, otherwise use from auth
    const workspaceId = bodyWorkspaceId || authWorkspaceId;

    if (!prospects || !Array.isArray(prospects)) {
      return NextResponse.json({
        error: 'prospects array is required'
      }, { status: 400 });
    }

    if (!workspaceId) {
      return NextResponse.json({
        error: 'workspaceId is required'
      }, { status: 400 });
    }

    // If body workspaceId differs from auth, verify access
    if (bodyWorkspaceId && bodyWorkspaceId !== authWorkspaceId) {
      const memberCheck = await pool.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [bodyWorkspaceId, userId]
      );
      if (memberCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    console.log(`Verifying ${prospects.length} prospects for workspace ${workspaceId}`);

    // Extract all LinkedIn URLs and emails from prospects
    const linkedinUrls: string[] = [];
    const emails: string[] = [];

    for (const prospect of prospects) {
      const linkedinUrl = prospect.contact?.linkedin_url || prospect.linkedin_url || prospect.linkedinUrl;
      const email = prospect.contact?.email || prospect.email;

      if (linkedinUrl) {
        // Normalize LinkedIn URL for matching
        const normalized = normalizeLinkedInUrl(linkedinUrl);
        if (normalized) linkedinUrls.push(normalized);
      }
      if (email) {
        emails.push(email.toLowerCase().trim());
      }
    }

    // Query existing prospects by LinkedIn URL
    let existingByLinkedIn: ExistingProspect[] = [];
    if (linkedinUrls.length > 0) {
      // Build OR conditions for LinkedIn URL matching (batched)
      const BATCH_SIZE = 50;
      for (let i = 0; i < linkedinUrls.length; i += BATCH_SIZE) {
        const batch = linkedinUrls.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map((_, idx) => `linkedin_url ILIKE $${idx + 2}`).join(' OR ');
        const params = [workspaceId, ...batch.map(url => `%${url}%`)];

        try {
          const result = await pool.query(
            `SELECT cp.id, cp.linkedin_url, cp.email, cp.first_name, cp.last_name, cp.status,
                    cp.error_message, cp.campaign_id, cp.contacted_at, cp.created_at,
                    c.name as campaign_name
             FROM campaign_prospects cp
             LEFT JOIN campaigns c ON cp.campaign_id = c.id
             WHERE cp.workspace_id = $1 AND (${placeholders})`,
            params
          );
          if (result.rows) existingByLinkedIn.push(...result.rows);
        } catch (err) {
          console.error('Error querying by LinkedIn URL:', err);
        }
      }
    }

    // Query existing prospects by email
    let existingByEmail: ExistingProspect[] = [];
    if (emails.length > 0) {
      try {
        const result = await pool.query(
          `SELECT cp.id, cp.linkedin_url, cp.email, cp.first_name, cp.last_name, cp.status,
                  cp.error_message, cp.campaign_id, cp.contacted_at, cp.created_at,
                  c.name as campaign_name
           FROM campaign_prospects cp
           LEFT JOIN campaigns c ON cp.campaign_id = c.id
           WHERE cp.workspace_id = $1 AND cp.email = ANY($2)`,
          [workspaceId, emails]
        );
        if (result.rows) existingByEmail = result.rows;
      } catch (err) {
        console.error('Error querying by email:', err);
      }
    }

    // Combine and deduplicate existing prospects
    const existingMap = new Map<string, ExistingProspect>();
    [...existingByLinkedIn, ...existingByEmail].forEach(p => {
      existingMap.set(p.id, p);
    });
    const allExisting = Array.from(existingMap.values());

    // Categorize prospects
    const results = {
      clean: [] as ProspectToVerify[],           // No previous contact
      alreadyContacted: [] as any[],             // CR sent, connected, or replied
      pendingInvitation: [] as any[],            // already_invited status
      previouslyFailed: [] as any[],             // failed status
      duplicates: [] as any[]                    // Same person in multiple campaigns
    };

    // Create lookup maps for quick matching
    const linkedinLookup = new Map<string, ExistingProspect[]>();
    const emailLookup = new Map<string, ExistingProspect[]>();

    for (const existing of allExisting) {
      if (existing.linkedin_url) {
        const normalized = normalizeLinkedInUrl(existing.linkedin_url);
        if (normalized) {
          const list = linkedinLookup.get(normalized) || [];
          list.push(existing);
          linkedinLookup.set(normalized, list);
        }
      }
      if (existing.email) {
        const normalizedEmail = existing.email.toLowerCase().trim();
        const list = emailLookup.get(normalizedEmail) || [];
        list.push(existing);
        emailLookup.set(normalizedEmail, list);
      }
    }

    // Check each prospect
    for (const prospect of prospects) {
      const linkedinUrl = prospect.contact?.linkedin_url || prospect.linkedin_url || prospect.linkedinUrl;
      const email = prospect.contact?.email || prospect.email;
      const normalizedLinkedIn = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : null;
      const normalizedEmail = email ? email.toLowerCase().trim() : null;

      // Find matches
      const linkedinMatches = normalizedLinkedIn ? (linkedinLookup.get(normalizedLinkedIn) || []) : [];
      const emailMatches = normalizedEmail ? (emailLookup.get(normalizedEmail) || []) : [];

      // Combine matches (deduplicated)
      const matchMap = new Map<string, ExistingProspect>();
      [...linkedinMatches, ...emailMatches].forEach(m => matchMap.set(m.id, m));
      const matches = Array.from(matchMap.values());

      if (matches.length === 0) {
        // No previous contact - clean prospect
        results.clean.push(prospect);
        continue;
      }

      // Check status of matches
      const contactedMatch = matches.find(m =>
        ['connection_request_sent', 'connected', 'replied', 'messaging', 'completed'].includes(m.status)
      );
      const pendingMatch = matches.find(m => m.status === 'already_invited');
      const failedMatch = matches.find(m => m.status === 'failed');

      if (contactedMatch) {
        results.alreadyContacted.push({
          prospect,
          existingRecord: {
            status: contactedMatch.status,
            campaignName: contactedMatch.campaign_name || 'Unknown Campaign',
            contactedAt: contactedMatch.contacted_at,
            name: `${contactedMatch.first_name} ${contactedMatch.last_name}`.trim()
          }
        });
      } else if (pendingMatch) {
        results.pendingInvitation.push({
          prospect,
          existingRecord: {
            status: 'already_invited',
            campaignName: pendingMatch.campaign_name || 'Unknown Campaign',
            createdAt: pendingMatch.created_at,
            name: `${pendingMatch.first_name} ${pendingMatch.last_name}`.trim()
          }
        });
      } else if (failedMatch) {
        results.previouslyFailed.push({
          prospect,
          existingRecord: {
            status: 'failed',
            errorMessage: failedMatch.error_message || 'Unknown error',
            campaignName: failedMatch.campaign_name || 'Unknown Campaign',
            createdAt: failedMatch.created_at,
            name: `${failedMatch.first_name} ${failedMatch.last_name}`.trim()
          }
        });
      } else if (matches.length > 1) {
        // Multiple pending entries = duplicates
        results.duplicates.push({
          prospect,
          existingRecords: matches.map(m => ({
            status: m.status,
            campaignName: m.campaign_name || 'Unknown Campaign',
            createdAt: m.created_at
          }))
        });
      } else {
        // Single pending entry - can still proceed
        results.clean.push(prospect);
      }
    }

    console.log(`Verification complete:
      - Clean: ${results.clean.length}
      - Already contacted: ${results.alreadyContacted.length}
      - Pending invitation: ${results.pendingInvitation.length}
      - Previously failed: ${results.previouslyFailed.length}
      - Duplicates: ${results.duplicates.length}`);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: prospects.length,
        clean: results.clean.length,
        alreadyContacted: results.alreadyContacted.length,
        pendingInvitation: results.pendingInvitation.length,
        previouslyFailed: results.previouslyFailed.length,
        duplicates: results.duplicates.length,
        canProceed: results.clean.length > 0
      }
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Prospect verification error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Normalize LinkedIn URL for comparison
 * Extracts the vanity/slug portion for matching
 */
function normalizeLinkedInUrl(url: string): string | null {
  if (!url) return null;

  // Extract vanity from URL
  const match = url.match(/linkedin\.com\/in\/([^\/?#]+)/i);
  if (!match) return null;

  // Return lowercase vanity without trailing slashes
  return match[1].toLowerCase().replace(/\/+$/, '');
}
