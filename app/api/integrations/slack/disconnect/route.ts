import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id } = body;

    if (!workspace_id) {
      return NextResponse.json(
        { success: false, error: 'workspace_id required' },
        { status: 400 }
      );
    }

    // Update integration status to inactive
    const { error } = await supabase
      .from('workspace_integrations')
      .update({
        status: 'inactive',
        config: {},
        updated_at: new Date().toISOString()
      })
      .eq('workspace_id', workspace_id)
      .eq('integration_type', 'slack');

    if (error) {
      console.error('Error disconnecting Slack:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Slack disconnected'
    });

  } catch (error) {
    console.error('Slack disconnect error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
