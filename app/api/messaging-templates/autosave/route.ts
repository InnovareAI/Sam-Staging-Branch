import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Firebase auth - workspace comes from header
    let authContext;
    try {
      authContext = await verifyAuth(request);
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }

    const { userId, workspaceId } = authContext;

    const body = await request.json();
    const {
      campaign_name,
      campaign_type,
      connection_message,
      alternative_message,
      follow_up_messages
    } = body;

    if (!campaign_name) {
      return NextResponse.json(
        { error: 'campaign_name required' },
        { status: 400 }
      );
    }

    const template_name = `autosave_${campaign_name}`;

    // Upsert template
    const { rows } = await pool.query(
      `INSERT INTO messaging_templates
       (workspace_id, template_name, campaign_type, connection_message, alternative_message, follow_up_messages, created_by, is_active)
       VALUES ($1, $2, 'custom', $3, $4, $5, $6, true)
       ON CONFLICT (workspace_id, template_name)
       DO UPDATE SET
         connection_message = EXCLUDED.connection_message,
         alternative_message = EXCLUDED.alternative_message,
         follow_up_messages = EXCLUDED.follow_up_messages,
         updated_at = NOW()
       RETURNING *`,
      [
        workspaceId,
        template_name,
        connection_message || '',
        alternative_message || '',
        JSON.stringify(follow_up_messages || []),
        userId
      ]
    );

    const template = rows[0];

    return NextResponse.json({ success: true, template_id: template.id });
  } catch (error: any) {
    console.error('Autosave error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
