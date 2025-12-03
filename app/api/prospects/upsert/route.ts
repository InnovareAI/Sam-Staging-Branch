import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, prospect, prospects, batch_id, source = 'api' } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Verify workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    const effectiveBatchId = batch_id || `batch_${Date.now()}_${user.id.slice(0, 8)}`;

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
        const { data } = await supabase
          .from('workspace_prospects')
          .select('id, approval_status, active_campaign_id')
          .eq('workspace_id', workspaceId)
          .eq('linkedin_url_hash', linkedinHash)
          .single();
        existingProspect = data;
      }

      if (!existingProspect && emailHash) {
        const { data } = await supabase
          .from('workspace_prospects')
          .select('id, approval_status, active_campaign_id')
          .eq('workspace_id', workspaceId)
          .eq('email_hash', emailHash)
          .single();
        existingProspect = data;
      }

      if (existingProspect) {
        // Update existing prospect (enrich data, but preserve approval status)
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        // Only update fields if provided and not empty
        if (p.first_name) updateData.first_name = p.first_name;
        if (p.last_name) updateData.last_name = p.last_name;
        if (p.company) updateData.company = p.company;
        if (p.title) updateData.title = p.title;
        if (p.location) updateData.location = p.location;
        if (p.phone) updateData.phone = p.phone;
        if (p.linkedin_provider_id) updateData.linkedin_provider_id = p.linkedin_provider_id;
        if (p.connection_degree) updateData.connection_degree = p.connection_degree;
        if (p.enrichment_data) {
          // Merge enrichment data
          updateData.enrichment_data = p.enrichment_data;
        }

        // Update if we have any fields to update
        if (Object.keys(updateData).length > 1) {
          await supabase
            .from('workspace_prospects')
            .update(updateData)
            .eq('id', existingProspect.id);
        }

        results.push({
          prospect_id: existingProspect.id,
          is_new: false,
          existing_status: existingProspect.approval_status,
          existing_campaign_id: existingProspect.active_campaign_id,
        });
      } else {
        // Insert new prospect with pending approval status
        const insertData = {
          workspace_id: workspaceId,
          linkedin_url: p.linkedin_url || null,
          linkedin_url_hash: linkedinHash,
          email: p.email || null,
          email_hash: emailHash,
          first_name: p.first_name || null,
          last_name: p.last_name || null,
          company: p.company || null,
          title: p.title || null,
          location: p.location || null,
          phone: p.phone || null,
          linkedin_provider_id: p.linkedin_provider_id || null,
          connection_degree: p.connection_degree || null,
          source: p.source || source,
          batch_id: effectiveBatchId,
          approval_status: 'pending',
          enrichment_data: p.enrichment_data || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: newProspect, error: insertError } = await supabase
          .from('workspace_prospects')
          .insert(insertData)
          .select('id')
          .single();

        if (insertError) {
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

        results.push({
          prospect_id: newProspect.id,
          is_new: true,
        });
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
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const batchId = searchParams.get('batch_id');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Verify workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('workspace_prospects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (batchId) {
      query = query.eq('batch_id', batchId);
    }

    const { data: prospects, error } = await query.limit(500);

    if (error) {
      console.error('Error fetching prospects:', error);
      return NextResponse.json(
        { error: 'Failed to fetch prospects' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      prospects,
      count: prospects?.length || 0,
    });

  } catch (error: unknown) {
    console.error('Prospect fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
