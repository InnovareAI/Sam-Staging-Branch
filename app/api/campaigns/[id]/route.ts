import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { apiError, handleApiError, apiSuccess } from '@/lib/api-error-handler';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, workspaceId } = await verifyAuth(req);

    const campaignId = params.id;

    // Get campaign details with performance metrics
    const campaignResult = await pool.query(
      `SELECT * FROM campaign_performance_summary WHERE campaign_id = $1`,
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      throw apiError.notFound('Campaign');
    }

    const campaign = campaignResult.rows[0];

    // Verify user has access to this campaign's workspace
    const membershipResult = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [campaign.workspace_id, userId]
    );

    if (membershipResult.rows.length === 0) {
      throw apiError.forbidden('Access denied to this campaign');
    }

    // Get campaign messages and replies
    const messagesResult = await pool.query(
      `SELECT cm.*,
              COALESCE(
                json_agg(cr.*) FILTER (WHERE cr.id IS NOT NULL),
                '[]'
              ) as campaign_replies
       FROM campaign_messages cm
       LEFT JOIN campaign_replies cr ON cm.id = cr.message_id
       WHERE cm.campaign_id = $1
       GROUP BY cm.id
       ORDER BY cm.sent_at DESC`,
      [campaignId]
    );

    return apiSuccess({
      campaign: {
        ...campaign,
        messages: messagesResult.rows || []
      }
    });

  } catch (error) {
    if ((error as AuthError).statusCode) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    return handleApiError(error, 'campaign_get');
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, workspaceId } = await verifyAuth(req);

    const campaignId = params.id;
    const updates = await req.json();

    console.log('Campaign update request:', { campaignId, updates, userId });

    // First, verify the campaign exists and user has access
    const existingCampaignResult = await pool.query(
      `SELECT id, workspace_id FROM campaigns WHERE id = $1`,
      [campaignId]
    );

    if (existingCampaignResult.rows.length === 0) {
      throw apiError.notFound('Campaign');
    }

    const existingCampaign = existingCampaignResult.rows[0];

    // Verify user is a member of the campaign's workspace
    const membershipResult = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [existingCampaign.workspace_id, userId]
    );

    if (membershipResult.rows.length === 0) {
      throw apiError.forbidden('You do not have access to this campaign');
    }

    // Remove fields that shouldn't be updated directly
    const { id, created_at, created_by, workspace_id, ...updateData } = updates;

    // CRITICAL: For email campaigns, validate email body and subject exist when updating messages
    // Get the current campaign to check its type
    const currentCampaignResult = await pool.query(
      `SELECT campaign_type, message_templates FROM campaigns WHERE id = $1`,
      [campaignId]
    );

    const currentCampaign = currentCampaignResult.rows[0];

    if (currentCampaign?.campaign_type === 'email') {
      // Check if message_templates is being updated
      if (updateData.message_templates) {
        const templates = updateData.message_templates;
        const emailBody = templates.email_body || templates.alternative_message;
        const emailSubject = templates.initial_subject || templates.email_subject;

        if (!emailBody || emailBody.trim() === '') {
          throw apiError.validation('Email campaigns require an email body', 'Please add email content');
        }

        if (!emailSubject || emailSubject.trim() === '') {
          throw apiError.validation('Email campaigns require a subject line', 'Please add an email subject');
        }

        console.log('✅ Email campaign update validation passed');
      }
    }

    console.log('Updating campaign with data:', updateData);

    // Build dynamic update query
    const updateFields = Object.keys(updateData);
    if (updateFields.length === 0) {
      throw apiError.validation('No fields to update');
    }

    // Add updated_at
    updateData.updated_at = new Date().toISOString();
    updateFields.push('updated_at');

    const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const values = updateFields.map(field => {
      const value = updateData[field];
      // Convert objects to JSON string for JSONB columns
      if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
      }
      return value;
    });
    values.push(campaignId);

    const updateResult = await pool.query(
      `UPDATE campaigns SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (updateResult.rows.length === 0) {
      throw apiError.internal('Campaign update failed', 'No data returned after update');
    }

    const campaign = updateResult.rows[0];
    console.log('Campaign updated successfully:', campaign.id);

    return apiSuccess({ campaign }, 'Campaign updated successfully');

  } catch (error) {
    if ((error as AuthError).statusCode) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    return handleApiError(error, 'campaign_put');
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // PATCH is the same as PUT for this endpoint
  return PUT(req, { params });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, workspaceId } = await verifyAuth(req);
    const url = new URL(req.url);
    const forceDelete = url.searchParams.get('force') === 'true';

    const campaignId = params.id;

    // Get campaign to verify workspace access
    const campaignResult = await pool.query(
      `SELECT id, workspace_id FROM campaigns WHERE id = $1`,
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      throw apiError.notFound('Campaign');
    }

    const campaign = campaignResult.rows[0];

    // Verify user has access to this campaign's workspace
    const membershipResult = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [campaign.workspace_id, userId]
    );

    if (membershipResult.rows.length === 0) {
      throw apiError.forbidden('Access denied to this campaign');
    }

    // Force delete: skip message check and delete everything
    if (forceDelete) {
      // Delete related data first
      await pool.query('DELETE FROM campaign_messages WHERE campaign_id = $1', [campaignId]);
      await pool.query('DELETE FROM campaign_prospects WHERE campaign_id = $1', [campaignId]);
      await pool.query('DELETE FROM send_queue WHERE campaign_id = $1', [campaignId]);

      await pool.query('DELETE FROM campaigns WHERE id = $1', [campaignId]);

      return apiSuccess({ deleted: true, forced: true }, 'Campaign and all related data deleted');
    }

    // Check if campaign has sent messages (prevent deletion of active campaigns)
    const messagesResult = await pool.query(
      `SELECT id FROM campaign_messages WHERE campaign_id = $1 LIMIT 1`,
      [campaignId]
    );

    if (messagesResult.rows.length > 0) {
      // Archive instead of delete if messages exist
      await pool.query(
        `UPDATE campaigns SET status = 'archived', updated_at = $1 WHERE id = $2`,
        [new Date().toISOString(), campaignId]
      );

      return apiSuccess({ archived: true }, 'Campaign archived (cannot delete campaigns with sent messages)');
    }

    // Delete campaign if no messages sent
    await pool.query('DELETE FROM campaigns WHERE id = $1', [campaignId]);

    return apiSuccess({ deleted: true }, 'Campaign deleted successfully');

  } catch (error) {
    if ((error as AuthError).statusCode) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    return handleApiError(error, 'campaign_delete');
  }
}
