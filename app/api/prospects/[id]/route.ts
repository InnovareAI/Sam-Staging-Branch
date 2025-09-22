import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prospectId = params.id;

    // Get prospect details with campaign associations
    const { data: prospect, error } = await supabase
      .from('workspace_prospects')
      .select(`
        *,
        campaign_prospects (
          campaign_id,
          status,
          invitation_sent_at,
          invitation_id,
          error_message,
          campaigns (
            name,
            status,
            campaign_type
          )
        )
      `)
      .eq('id', prospectId)
      .single();

    if (error) {
      console.error('Failed to fetch prospect:', error);
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    return NextResponse.json({ prospect });

  } catch (error: any) {
    console.error('Prospect fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prospect', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prospectId = params.id;
    const updates = await req.json();

    // Remove fields that shouldn't be updated directly
    const { 
      id, 
      created_at, 
      workspace_id, 
      prospect_hash,
      contact_count,
      last_contacted_at,
      ...updateData 
    } = updates;

    // Update prospect
    const { data: prospect, error } = await supabase
      .from('workspace_prospects')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', prospectId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update prospect:', error);
      return NextResponse.json({ 
        error: 'Failed to update prospect',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Prospect updated successfully',
      prospect 
    });

  } catch (error: any) {
    console.error('Prospect update error:', error);
    return NextResponse.json(
      { error: 'Failed to update prospect', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prospectId = params.id;

    // Check if prospect has been contacted (prevent deletion of contacted prospects)
    const { data: prospect, error: prospectError } = await supabase
      .from('workspace_prospects')
      .select('contact_count, full_name')
      .eq('id', prospectId)
      .single();

    if (prospectError) {
      console.error('Failed to check prospect status:', prospectError);
      return NextResponse.json({ 
        error: 'Failed to verify prospect status' 
      }, { status: 500 });
    }

    if (prospect.contact_count > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete contacted prospects',
        details: `${prospect.full_name} has been contacted ${prospect.contact_count} times` 
      }, { status: 400 });
    }

    // Delete prospect
    const { error } = await supabase
      .from('workspace_prospects')
      .delete()
      .eq('id', prospectId);

    if (error) {
      console.error('Failed to delete prospect:', error);
      return NextResponse.json({ 
        error: 'Failed to delete prospect',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Prospect deleted successfully' 
    });

  } catch (error: any) {
    console.error('Prospect deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete prospect', details: error.message },
      { status: 500 }
    );
  }
}