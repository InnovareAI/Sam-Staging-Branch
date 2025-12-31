import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Prevent 504 timeout on bulk upserts

/**
 * Normalize LinkedIn URL to vanity name hash
 * Examples:
 *   https://www.linkedin.com/in/john-doe-123/ -> john-doe-123
 *   https://linkedin.com/in/john-doe?param=1 -> john-doe
 *   linkedin.com/in/JOHN-DOE/ -> john-doe
 */
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Remove protocol and www
  let normalized = url
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/^linkedin\.com\/in\//i, '');

  // Remove trailing slash and everything after
  normalized = normalized.split('/')[0];

  // Remove query params
  normalized = normalized.split('?')[0];

  // Lowercase and trim
  normalized = normalized.toLowerCase().trim();

  return normalized || null;
}

/**
 * Normalize email for deduplication
 */
function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.toLowerCase().trim() || null;
}

interface ProspectInput {
  linkedin_url?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  location?: string;
  phone?: string;
  linkedin_provider_id?: string;
  connection_degree?: number;
  source?: string;
  batch_id?: string;
  enrichment_data?: Record<string, unknown>;
}

interface UpsertResult {
  prospect_id: string;
  is_new: boolean;
  existing_status?: string;
  existing_campaign_id?: string | null;
}

/**
 * POST /api/prospects/upsert
 *
 * Central endpoint for all prospect creation/updates.
 * - Deduplicates by linkedin_url_hash or email_hash
 * - New prospects get approval_status='pending'
 * - Existing prospects are updated (enriched) but approval status preserved
 *
 * Accepts single prospect or batch:
 * Body: { workspaceId, prospect: {...} } OR { workspaceId, prospects: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId: authWorkspaceId } = await verifyAuth(request);

    const body = await request.json();
    const { workspaceId, prospect, prospects, batch_id, source = 'api' } = body;

    // Use workspaceId from body if provided, otherwise use from auth
    const effectiveWorkspaceId = workspaceId || authWorkspaceId;

    if (!effectiveWorkspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // If body workspaceId differs from auth, verify access
    if (workspaceId && workspaceId !== authWorkspaceId) {
      const memberCheck = await pool.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
      );
      if (memberCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Handle single or batch
    const prospectList: ProspectInput[] = prospects || (prospect ? [prospect] : []);

    if (prospectList.length === 0) {
      return NextResponse.json(
        { error: 'prospect or prospects array is required' },
        { status: 400 }
      );
    }

    // Generate batch_id if not provided (for grouping imports)
    const effectiveBatchId = batch_id || `batch_${Date.now()}_${userId.slice(0, 8)}`;

    const results: UpsertResult[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < prospectList.length; i++) {
      const p = prospectList[i];

      // Must have at least linkedin_url or email
      if (!p.linkedin_url && !p.email) {
        errors.push({ index: i, error: 'linkedin_url or email is required' });
        continue;
      }

      const linkedinHash = normalizeLinkedInUrl(p.linkedin_url);
      const emailHash = normalizeEmail(p.email);

      // Check if prospect already exists (by linkedin_url_hash first, then email)
      let existingProspect = null;

      if (linkedinHash) {
        const existingResult = await pool.query(
          'SELECT id, approval_status, active_campaign_id FROM workspace_prospects WHERE workspace_id = $1 AND linkedin_url_hash = $2',
          [effectiveWorkspaceId, linkedinHash]
        );
        if (existingResult.rows.length > 0) {
          existingProspect = existingResult.rows[0];
        }
      }

      if (!existingProspect && emailHash) {
        const existingResult = await pool.query(
          'SELECT id, approval_status, active_campaign_id FROM workspace_prospects WHERE workspace_id = $1 AND email_hash = $2',
          [effectiveWorkspaceId, emailHash]
        );
        if (existingResult.rows.length > 0) {
          existingProspect = existingResult.rows[0];
        }
      }

      if (existingProspect) {
        // Update existing prospect (enrich data, but preserve approval status)
        const updateFields: string[] = ['updated_at = $1'];
        const updateValues: any[] = [new Date().toISOString()];
        let paramIndex = 2;

        // Only update fields if provided and not empty
        if (p.first_name) {
          updateFields.push(`first_name = $${paramIndex++}`);
          updateValues.push(p.first_name);
        }
        if (p.last_name) {
          updateFields.push(`last_name = $${paramIndex++}`);
          updateValues.push(p.last_name);
        }
        if (p.company) {
          updateFields.push(`company = $${paramIndex++}`);
          updateValues.push(p.company);
        }
        if (p.title) {
          updateFields.push(`title = $${paramIndex++}`);
          updateValues.push(p.title);
        }
        if (p.location) {
          updateFields.push(`location = $${paramIndex++}`);
          updateValues.push(p.location);
        }
        if (p.phone) {
          updateFields.push(`phone = $${paramIndex++}`);
          updateValues.push(p.phone);
        }
        if (p.linkedin_provider_id) {
          updateFields.push(`linkedin_provider_id = $${paramIndex++}`);
          updateValues.push(p.linkedin_provider_id);
        }
        if (p.connection_degree) {
          updateFields.push(`connection_degree = $${paramIndex++}`);
          updateValues.push(p.connection_degree);
        }
        if (p.enrichment_data) {
          updateFields.push(`enrichment_data = $${paramIndex++}`);
          updateValues.push(JSON.stringify(p.enrichment_data));
        }

        // Update if we have any fields to update
        if (updateFields.length > 1) {
          updateValues.push(existingProspect.id);
          await pool.query(
            `UPDATE workspace_prospects SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
            updateValues
          );
        }

        results.push({
          prospect_id: existingProspect.id,
          is_new: false,
          existing_status: existingProspect.approval_status,
          existing_campaign_id: existingProspect.active_campaign_id,
        });
      } else {
        // Insert new prospect with pending approval status
        const now = new Date().toISOString();
        try {
          const insertResult = await pool.query(
            `INSERT INTO workspace_prospects (
              workspace_id, linkedin_url, linkedin_url_hash, email, email_hash,
              first_name, last_name, company, title, location, phone,
              linkedin_provider_id, connection_degree, source, batch_id,
              approval_status, enrichment_data, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING id`,
            [
              effectiveWorkspaceId,
              p.linkedin_url || null,
              linkedinHash,
              p.email || null,
              emailHash,
              p.first_name || null,
              p.last_name || null,
              p.company || null,
              p.title || null,
              p.location || null,
              p.phone || null,
              p.linkedin_provider_id || null,
              p.connection_degree || null,
              p.source || source,
              effectiveBatchId,
              'pending',
              JSON.stringify(p.enrichment_data || {}),
              now,
              now
            ]
          );

          results.push({
            prospect_id: insertResult.rows[0].id,
            is_new: true,
          });
        } catch (insertError: any) {
          // Handle unique constraint violations gracefully
          if (insertError.code === '23505') {
            errors.push({
              index: i,
              error: 'Duplicate prospect (race condition - already exists)'
            });
          } else {
            errors.push({ index: i, error: insertError.message });
          }
          continue;
        }
      }
    }

    return NextResponse.json({
      success: true,
      batch_id: effectiveBatchId,
      total: prospectList.length,
      created: results.filter(r => r.is_new).length,
      updated: results.filter(r => !r.is_new).length,
      errors: errors.length,
      results,
      error_details: errors.length > 0 ? errors : undefined,
    });

  } catch (error: unknown) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Prospect upsert error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prospects/upsert?workspaceId=xxx&batch_id=xxx
 *
 * Get prospects by batch_id (useful after bulk import)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId: authWorkspaceId } = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || authWorkspaceId;
    const batchId = searchParams.get('batch_id');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // If query workspaceId differs from auth, verify access
    if (workspaceId !== authWorkspaceId) {
      const memberCheck = await pool.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
      );
      if (memberCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    let query = 'SELECT * FROM workspace_prospects WHERE workspace_id = $1';
    const params: any[] = [workspaceId];

    if (batchId) {
      query += ' AND batch_id = $2';
      params.push(batchId);
    }

    query += ' ORDER BY created_at DESC LIMIT 500';

    const prospectsResult = await pool.query(query, params);
    const prospects = prospectsResult.rows;

    return NextResponse.json({
      success: true,
      prospects,
      count: prospects?.length || 0,
    });

  } catch (error: unknown) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Prospect fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
