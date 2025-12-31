import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { normalizeCompanyName } from '@/lib/enrich-prospect-name';

// Prevent 504 timeout on large prospect uploads
export const maxDuration = 60; // 60 seconds

// Helper to normalize LinkedIn URL to hash (vanity name only)
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  if (match) return match[1].toLowerCase().trim();
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
}

// GET - Check endpoint status
export async function GET() {
  return NextResponse.json({
    success: true,
    endpoint: '/api/prospect-approval/upload-prospects',
    methods: ['POST'],
    description: 'Upload prospects for approval',
    required_fields: {
      prospects: 'Array of prospect objects',
      workspace_id: 'UUID of the workspace (optional if authenticated)',
      campaign_name: 'Name of the campaign (optional)',
      campaign_tag: 'Tag for the campaign (optional)',
      source: 'Source of prospects (optional)'
    },
    prospect_format: {
      name: 'Full name (or use first_name + last_name)',
      first_name: 'First name',
      last_name: 'Last name',
      email: 'Email address',
      company: 'Company name or { name: "..." }',
      title: 'Job title',
      linkedin_url: 'LinkedIn profile URL',
      location: 'Location',
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId: authWorkspaceId } = await verifyAuth(request);

    const body = await request.json();
    let { campaign_name, campaign_tag, source, prospects, workspace_id } = body;

    console.log('📥 Upload request:', {
      campaign_name,
      prospect_count: prospects?.length,
      workspace_id,
      authWorkspaceId
    });

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({ success: false, error: 'No prospects provided' }, { status: 400 });
    }

    // Use workspace_id from request or auth context
    workspace_id = workspace_id || authWorkspaceId;

    if (!workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No workspace selected. Please select your workspace.'
      }, { status: 400 });
    }

    // Verify user has access to this workspace
    const memberResult = await pool.query(
      `SELECT id, role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
      [workspace_id, userId]
    );

    if (memberResult.rows.length === 0) {
      console.error('Paste Upload - User not authorized for workspace:', {
        userId,
        workspaceId: workspace_id
      });
      return NextResponse.json({
        success: false,
        error: 'You do not have access to this workspace'
      }, { status: 403 });
    }

    console.log('Paste Upload - Workspace access verified:', {
      userId,
      workspaceId: workspace_id,
      role: memberResult.rows[0].role
    });

    // Verify workspace exists
    const workspaceResult = await pool.query(
      'SELECT id, name FROM workspaces WHERE id = $1',
      [workspace_id]
    );

    if (workspaceResult.rows.length === 0) {
      console.error('Workspace not found:', workspace_id);
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    // Create approval session
    const sessionResult = await pool.query(
      `INSERT INTO prospect_approval_sessions
       (workspace_id, user_id, campaign_name, campaign_tag, prospect_source, total_prospects, pending_count, approved_count, rejected_count, status, batch_number, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        workspace_id, userId, campaign_name || 'Uploaded Prospects', campaign_tag || 'manual-upload',
        source || 'manual-upload', prospects.length, prospects.length, 0, 0, 'active', 1, new Date().toISOString()
      ]
    );

    const session = sessionResult.rows[0];

    // CHECK FOR DUPLICATES: Campaign-type-aware validation
    const linkedinUrls = prospects
      .map((p: any) => p.linkedin_url || p.contact?.linkedin_url)
      .filter(Boolean);

    const emails = prospects
      .map((p: any) => p.email || p.contact?.email)
      .filter(Boolean);

    let duplicateWarnings: any[] = [];

    // Check LinkedIn URL duplicates
    if (linkedinUrls.length > 0) {
      const existingLinkedInResult = await pool.query(
        `SELECT cp.linkedin_url, cp.campaign_id, c.id as campaign_id, c.campaign_name, c.campaign_type
         FROM campaign_prospects cp
         JOIN campaigns c ON cp.campaign_id = c.id
         WHERE cp.linkedin_url = ANY($1)`,
        [linkedinUrls]
      );

      if (existingLinkedInResult.rows.length > 0) {
        duplicateWarnings = duplicateWarnings.concat(
          existingLinkedInResult.rows.map((ep: any) => ({
            type: 'linkedin',
            identifier: ep.linkedin_url,
            existing_campaign_id: ep.campaign_id,
            existing_campaign_name: ep.campaign_name || 'Unknown campaign',
            existing_campaign_type: ep.campaign_type || 'unknown',
            blocking: ['connector', 'messenger'].includes(ep.campaign_type || '')
          }))
        );
      }
    }

    // Check email duplicates
    if (emails.length > 0) {
      const existingEmailResult = await pool.query(
        `SELECT cp.email, cp.campaign_id, c.id as campaign_id, c.campaign_name, c.campaign_type
         FROM campaign_prospects cp
         JOIN campaigns c ON cp.campaign_id = c.id
         WHERE cp.email = ANY($1) AND cp.email IS NOT NULL`,
        [emails]
      );

      if (existingEmailResult.rows.length > 0) {
        duplicateWarnings = duplicateWarnings.concat(
          existingEmailResult.rows.map((ep: any) => ({
            type: 'email',
            identifier: ep.email,
            existing_campaign_id: ep.campaign_id,
            existing_campaign_name: ep.campaign_name || 'Unknown campaign',
            existing_campaign_type: ep.campaign_type || 'unknown',
            blocking: false
          }))
        );
      }
    }

    // Helper function to clean LinkedIn URLs
    const cleanLinkedInUrl = (url: string): string => {
      if (!url) return '';
      try {
        const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
        if (match) {
          const username = match[1];
          return `https://www.linkedin.com/in/${username}`;
        }
        return url;
      } catch (error) {
        console.error('Error cleaning LinkedIn URL:', url, error);
        return url;
      }
    };

    // Save prospects to approval data table
    const approvalData = prospects.map((p: any, index: number) => {
      const prospectId = p.prospect_id || p.id || `upload_${session.id}_${index}_${Date.now()}`;
      const name = p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown';
      const linkedinUrl = p.linkedin_url || p.contact?.linkedin_url || '';

      const contact = {
        email: p.email || p.contact?.email || '',
        linkedin_url: linkedinUrl,
        linkedin_provider_id: p.providerId || p.contact?.linkedin_provider_id || null,
        public_identifier: p.publicIdentifier || p.public_identifier || null,
        first_name: p.first_name || p.contact?.first_name || name.split(' ')[0] || '',
        last_name: p.last_name || p.contact?.last_name || name.split(' ').slice(1).join(' ') || ''
      };

      let companyName = typeof p.company === 'string'
        ? p.company
        : (p.company?.name || p.company_name || '');
      const cleanCompanyName = normalizeCompanyName(companyName);

      const company = {
        name: cleanCompanyName,
        industry: p.company?.industry || ''
      };

      return {
        session_id: session.id,
        prospect_id: prospectId,
        workspace_id: workspace_id,
        name: name,
        title: p.title || '',
        company: company,
        location: p.location || '',
        contact: contact,
        connection_degree: p.connectionDegree || p.connection_degree || null,
        source: p.source || source || 'manual-upload',
        enrichment_score: p.enrichment_score || 70,
        approval_status: p.approval_status || 'pending',
        created_at: new Date().toISOString()
      };
    });

    // DATABASE-FIRST: Upsert all prospects to workspace_prospects master table
    console.log(`💾 Step 1: Upserting ${approvalData.length} prospects to workspace_prospects (master table)`);

    const masterProspects = approvalData.map((p: any) => ({
      workspace_id: workspace_id,
      linkedin_url: p.contact?.linkedin_url || null,
      linkedin_url_hash: normalizeLinkedInUrl(p.contact?.linkedin_url),
      first_name: p.contact?.first_name || p.name?.split(' ')[0] || 'Unknown',
      last_name: p.contact?.last_name || p.name?.split(' ').slice(1).join(' ') || '',
      email: p.contact?.email || null,
      company: p.company?.name || '',
      title: p.title || '',
      location: p.location || '',
      linkedin_provider_id: p.contact?.linkedin_provider_id || null,
      connection_status: p.connection_degree === '1st' ? 'connected' : 'unknown',
      source: p.source || 'manual-upload',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })).filter((p: any) => p.linkedin_url_hash);

    // Batch upsert to workspace_prospects
    if (masterProspects.length > 0) {
      try {
        for (const prospect of masterProspects) {
          await pool.query(
            `INSERT INTO workspace_prospects (workspace_id, linkedin_url, linkedin_url_hash, first_name, last_name, email, company, title, location, linkedin_provider_id, connection_status, source, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (workspace_id, linkedin_url_hash)
             DO UPDATE SET first_name = $4, last_name = $5, email = $6, company = $7, title = $8, location = $9, updated_at = $14`,
            [prospect.workspace_id, prospect.linkedin_url, prospect.linkedin_url_hash, prospect.first_name, prospect.last_name,
             prospect.email, prospect.company, prospect.title, prospect.location, prospect.linkedin_provider_id,
             prospect.connection_status, prospect.source, prospect.created_at, prospect.updated_at]
          );
        }
        console.log(`✅ Upserted ${masterProspects.length} prospects to workspace_prospects`);
      } catch (masterError: any) {
        console.error('❌ Master prospect upsert error:', masterError);
        console.warn('⚠️ Continuing despite master table error');
      }
    }

    // Get master_prospect_ids for linking
    const linkedinHashes = approvalData
      .map((p: any) => normalizeLinkedInUrl(p.contact?.linkedin_url))
      .filter(Boolean);

    let masterIdMap: Record<string, string> = {};
    if (linkedinHashes.length > 0) {
      const masterRecordsResult = await pool.query(
        'SELECT id, linkedin_url_hash FROM workspace_prospects WHERE workspace_id = $1 AND linkedin_url_hash = ANY($2)',
        [workspace_id, linkedinHashes]
      );

      if (masterRecordsResult.rows) {
        masterIdMap = masterRecordsResult.rows.reduce((acc: Record<string, string>, r: any) => {
          acc[r.linkedin_url_hash] = r.id;
          return acc;
        }, {});
      }
    }

    // Add master_prospect_id to approval data
    const approvalDataWithMasterId = approvalData.map((p: any) => {
      const hash = normalizeLinkedInUrl(p.contact?.linkedin_url);
      return {
        ...p,
        master_prospect_id: hash ? masterIdMap[hash] || null : null
      };
    });

    console.log(`💾 Step 2: Inserting ${approvalDataWithMasterId.length} prospects into prospect_approval_data`);

    // Insert prospects into prospect_approval_data
    let insertedCount = 0;
    for (const prospect of approvalDataWithMasterId) {
      try {
        await pool.query(
          `INSERT INTO prospect_approval_data
           (session_id, prospect_id, workspace_id, name, title, company, location, contact, connection_degree, source, enrichment_score, approval_status, created_at, master_prospect_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [prospect.session_id, prospect.prospect_id, prospect.workspace_id, prospect.name, prospect.title,
           JSON.stringify(prospect.company), prospect.location, JSON.stringify(prospect.contact), prospect.connection_degree,
           prospect.source, prospect.enrichment_score, prospect.approval_status, prospect.created_at, prospect.master_prospect_id]
        );
        insertedCount++;
      } catch (insertError: any) {
        console.error('❌ Error inserting prospect:', insertError);
      }
    }

    // Verify prospects were inserted
    const verifyCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM prospect_approval_data WHERE session_id = $1',
      [session.id]
    );
    const verifyCount = parseInt(verifyCountResult.rows[0].count);

    console.log('✅ Prospect upload verification:', {
      expected: prospects.length,
      verified: verifyCount,
      match: verifyCount === prospects.length,
      session_id: session.id
    });

    if (verifyCount !== prospects.length) {
      console.error(`❌ Insert count mismatch: expected ${prospects.length}, verified ${verifyCount}`);

      // Rollback session and any partial data
      await pool.query('DELETE FROM prospect_approval_data WHERE session_id = $1', [session.id]);
      await pool.query('DELETE FROM prospect_approval_sessions WHERE id = $1', [session.id]);

      return NextResponse.json({
        success: false,
        error: `Failed to insert all prospects: ${verifyCount}/${prospects.length} inserted`,
        details: 'This may be due to database constraints or permissions. Check server logs.'
      }, { status: 500 });
    }

    console.log(`✅ Successfully inserted ${verifyCount} prospects`);
    console.log(`📋 Session ID: ${session.id}`);

    const responseMessage = duplicateWarnings.length > 0
      ? `Successfully uploaded ${verifyCount} prospects. ${duplicateWarnings.length} duplicate(s) detected - review warnings during approval.`
      : `Successfully uploaded ${verifyCount} prospects. Go to Prospect Approval to review.`;

    return NextResponse.json({
      success: true,
      session_id: session.id,
      count: verifyCount,
      campaign_name: campaign_name,
      message: responseMessage,
      duplicate_warnings: duplicateWarnings.length > 0 ? duplicateWarnings : undefined
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Upload prospects error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
