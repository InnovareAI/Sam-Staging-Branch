import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { normalizeCompanyName } from '@/lib/prospect-normalization';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 [PROSPECTS API] Request started for campaign:', params.id);

    const { userId, workspaceId } = await verifyAuth(req);
    console.log('🔐 [PROSPECTS API] Auth check:', { hasUser: true, userId });

    const campaignId = params.id;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log('📋 [PROSPECTS API] Query params:', { campaignId, status, limit, offset });

    // Verify campaign exists and user has access
    const campaignResult = await pool.query(
      `SELECT workspace_id FROM campaigns WHERE id = $1`,
      [campaignId]
    );

    console.log('🏢 [PROSPECTS API] Campaign lookup:', {
      found: campaignResult.rows.length > 0,
      workspaceId: campaignResult.rows[0]?.workspace_id
    });

    if (campaignResult.rows.length === 0) {
      console.error('❌ [PROSPECTS API] Campaign not found');
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaign = campaignResult.rows[0];

    console.log('📊 Fetching prospects for campaign:', campaignId, 'workspace:', campaign.workspace_id);

    // Build query for campaign prospects
    let query = `SELECT * FROM campaign_prospects WHERE campaign_id = $1 AND workspace_id = $2`;
    const queryParams: any[] = [campaignId, campaign.workspace_id];

    if (status) {
      query += ` AND status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const prospectsResult = await pool.query(query, queryParams);

    console.log('✅ Found', prospectsResult.rows?.length || 0, 'prospects for campaign', campaignId);

    // Map company_name to company for frontend compatibility
    const mappedProspects = (prospectsResult.rows || []).map(p => ({
      ...p,
      company: p.company_name || p.company || null
    }));

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM campaign_prospects WHERE campaign_id = $1`,
      [campaignId]
    );

    return NextResponse.json({
      prospects: mappedProspects,
      total: parseInt(countResult.rows[0]?.count || '0'),
      limit,
      offset
    });

  } catch (error: any) {
    if ((error as AuthError).statusCode) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('❌ [PROSPECTS API] Fatal error:', error);
    console.error('❌ [PROSPECTS API] Error stack:', error.stack);
    console.error('❌ [PROSPECTS API] Error details:', {
      name: error.name,
      message: error.message,
      cause: error.cause
    });
    return NextResponse.json(
      {
        error: 'Failed to fetch campaign prospects',
        details: error.message,
        errorName: error.name
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, workspaceId } = await verifyAuth(req);

    const campaignId = params.id;
    const body = await req.json();

    // Verify campaign exists and user has access
    const campaignResult = await pool.query(
      `SELECT workspace_id FROM campaigns WHERE id = $1`,
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaign = campaignResult.rows[0];

    // Handle two modes: prospect_ids (existing prospects) or prospects (new prospect data)
    if (body.prospect_ids && Array.isArray(body.prospect_ids)) {
      // Mode 1: Add existing prospects to campaign
      const { prospect_ids } = body;

      console.log(`📋 Add to campaign: Received ${prospect_ids.length} prospect IDs`);
      console.log(`📋 Sample IDs:`, prospect_ids.slice(0, 3));
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prospect_ids[0]);
      console.log(`📋 ID format check: First ID is UUID? ${isUUID}`);

      // First, try to find prospects in prospect_approval_data (from CSV approval flow)
      let approvalProspects: any[] = [];

      if (isUUID) {
        // Try UUID lookup first (new flow)
        const approvalResult = await pool.query(
          `SELECT * FROM prospect_approval_data WHERE id = ANY($1)`,
          [prospect_ids]
        );
        console.log(`📋 Found in prospect_approval_data by UUID: ${approvalResult.rows?.length || 0}`);
        if (approvalResult.rows) approvalProspects = approvalResult.rows;
      }

      // Also try matching by prospect_id (csv_xxx format) if UUID lookup fails or IDs aren't UUIDs
      if (approvalProspects.length === 0) {
        console.log(`📋 Trying prospect_id field lookup...`);
        const prospectIdResult = await pool.query(
          `SELECT * FROM prospect_approval_data WHERE prospect_id = ANY($1)`,
          [prospect_ids]
        );
        console.log(`📋 Found by prospect_id: ${prospectIdResult.rows?.length || 0}`);
        if (prospectIdResult.rows && prospectIdResult.rows.length > 0) {
          approvalProspects = prospectIdResult.rows;
        }
      }

      // If we found prospects in approval data, add them directly to campaign_prospects
      if (approvalProspects && approvalProspects.length > 0) {
        console.log(`Found ${approvalProspects.length} prospects in prospect_approval_data`);

        let addedCount = 0;
        for (const prospect of approvalProspects) {
          // Extract name parts
          const nameParts = prospect.name?.split(' ') || ['Unknown'];
          const firstName = nameParts[0] || 'Unknown';
          const lastName = nameParts.slice(1).join(' ') || '';

          // Extract LinkedIn URL from contact object
          const linkedinUrl = prospect.contact?.linkedin_url || null;

          // Extract and normalize company name
          const rawCompanyName = prospect.company?.name || '';
          const normalizedCompany = rawCompanyName ? normalizeCompanyName(rawCompanyName) : '';

          const insertResult = await pool.query(
            `INSERT INTO campaign_prospects (
              campaign_id, workspace_id, first_name, last_name, email, company_name,
              title, location, linkedin_url, linkedin_user_id, connection_degree,
              status, personalization_data, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id`,
            [
              campaignId,
              campaign.workspace_id,
              firstName,
              lastName,
              prospect.contact?.email || null,
              normalizedCompany,
              prospect.title || '',
              prospect.location || null,
              linkedinUrl,
              prospect.linkedin_user_id || null,
              prospect.connection_degree ? String(prospect.connection_degree) : null,
              'approved',
              JSON.stringify({
                source: 'approval_flow',
                original_prospect_id: prospect.prospect_id,
                approved_at: new Date().toISOString()
              }),
              new Date().toISOString()
            ]
          );
          if (insertResult.rows.length > 0) addedCount++;
        }

        // Mark as transferred in approval data
        await pool.query(
          `UPDATE prospect_approval_data
           SET approval_status = 'transferred_to_campaign',
               transferred_at = $1,
               transferred_to_campaign_id = $2
           WHERE id = ANY($3)`,
          [new Date().toISOString(), campaignId, prospect_ids]
        );

        return NextResponse.json({
          message: 'Prospects added to campaign successfully',
          added_prospects: addedCount,
          total_requested: prospect_ids.length
        }, { status: 201 });
      }

      // Fallback: Try workspace_prospects table (original behavior for UUID prospect IDs)
      const existingProspectsResult = await pool.query(
        `SELECT id FROM workspace_prospects WHERE workspace_id = $1 AND id = ANY($2)`,
        [campaign.workspace_id, prospect_ids]
      );

      const validProspectIds = existingProspectsResult.rows?.map(p => p.id) || [];
      const invalidIds = prospect_ids.filter(id => !validProspectIds.includes(id));

      if (invalidIds.length > 0) {
        return NextResponse.json({
          error: 'Some prospect IDs are invalid',
          invalid_ids: invalidIds
        }, { status: 400 });
      }

      // Add prospects to campaign (with conflict handling)
      let addedCount = 0;
      for (const prospectId of prospect_ids) {
        const insertResult = await pool.query(
          `INSERT INTO campaign_prospects (campaign_id, prospect_id, workspace_id, status, created_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (campaign_id, prospect_id) DO NOTHING
           RETURNING id`,
          [campaignId, prospectId, campaign.workspace_id, 'pending', new Date().toISOString()]
        );
        if (insertResult.rows.length > 0) addedCount++;
      }

      return NextResponse.json({
        message: 'Prospects added to campaign successfully',
        added_prospects: addedCount,
        total_requested: prospect_ids.length
      }, { status: 201 });

    } else if (body.prospects && Array.isArray(body.prospects)) {
      // Mode 2: Create new prospects directly in campaign_prospects table
      const { prospects } = body;

      if (prospects.length === 0) {
        return NextResponse.json({
          error: 'prospects array cannot be empty'
        }, { status: 400 });
      }

      // CRITICAL: Check if any prospects are already in active campaigns
      const linkedinUrls = prospects
        .map(p => p.linkedin_url || p.linkedin_profile_url || p.contact?.linkedin_url)
        .filter(Boolean)
        .map(url => url.toLowerCase().trim().replace(/\/$/, ''));

      const emails = prospects
        .map(p => p.email)
        .filter(Boolean)
        .map(email => email.toLowerCase().trim());

      if (linkedinUrls.length > 0 || emails.length > 0) {
        // Check for existing prospects in active campaigns
        const existingResult = await pool.query(
          `SELECT cp.id, cp.first_name, cp.last_name, cp.linkedin_url, cp.email, cp.status,
                  cp.campaign_id, c.name as campaign_name, c.status as campaign_status
           FROM campaign_prospects cp
           JOIN campaigns c ON cp.campaign_id = c.id
           WHERE cp.workspace_id = $1
             AND cp.campaign_id != $2
             AND cp.status IN ('pending', 'approved', 'processing', 'cr_sent', 'fu1_sent', 'fu2_sent', 'fu3_sent', 'fu4_sent', 'fu5_sent', 'connection_requested', 'connected', 'messaging', 'completed')
             AND (cp.linkedin_url = ANY($3) OR cp.email = ANY($4))`,
          [campaign.workspace_id, campaignId, linkedinUrls, emails]
        );

        const conflictingProspects = (existingResult.rows || []).filter(p =>
          p.campaign_status === 'active' || p.campaign_status === 'draft'
        );

        if (conflictingProspects.length > 0) {
          const conflictDetails = conflictingProspects.map(p => ({
            name: `${p.first_name} ${p.last_name}`,
            linkedin_url: p.linkedin_url,
            current_campaign: p.campaign_name || 'Unknown',
            status: p.status
          }));

          return NextResponse.json({
            error: 'campaign_conflict',
            message: `${conflictingProspects.length} prospect(s) are already in active campaigns. Remove them from existing campaigns before adding to this one.`,
            conflicts: conflictDetails
          }, { status: 409 });
        }
      }

      // Insert prospects directly into campaign_prospects
      let addedCount = 0;
      for (const prospect of prospects) {
        // Extract raw company name from multiple possible sources
        const rawCompanyName = prospect.company_name || prospect.company?.name || prospect.company || null;
        // Normalize: "Goldman Sachs Group, Inc." → "Goldman Sachs"
        const normalizedCompany = rawCompanyName ? normalizeCompanyName(rawCompanyName) : null;

        const insertResult = await pool.query(
          `INSERT INTO campaign_prospects (
            campaign_id, first_name, last_name, email, company_name, linkedin_url,
            title, phone, location, industry, status, personalization_data, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id`,
          [
            campaignId,
            prospect.first_name || '',
            prospect.last_name || '',
            prospect.email || prospect.contact?.email || null,
            normalizedCompany,
            prospect.linkedin_url || prospect.linkedin_profile_url || prospect.contact?.linkedin_url || null,
            prospect.title || null,
            prospect.phone || prospect.contact?.phone || null,
            prospect.location || null,
            prospect.industry || prospect.company?.industry?.[0] || null,
            prospect.status || 'approved',
            JSON.stringify({
              ...(prospect.personalization_data || {}),
              source: prospect.personalization_data?.source || 'direct_add',
              added_at: new Date().toISOString()
            }),
            new Date().toISOString()
          ]
        );
        if (insertResult.rows.length > 0) addedCount++;
      }

      return NextResponse.json({
        message: 'Prospects created and added to campaign successfully',
        added_prospects: addedCount,
        total_requested: prospects.length
      }, { status: 201 });

    } else {
      return NextResponse.json({
        error: 'Either prospect_ids or prospects array is required'
      }, { status: 400 });
    }

  } catch (error: any) {
    if ((error as AuthError).statusCode) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Add prospects to campaign error:', error);
    return NextResponse.json(
      { error: 'Failed to add prospects to campaign', details: error.message },
      { status: 500 }
    );
  }
}
