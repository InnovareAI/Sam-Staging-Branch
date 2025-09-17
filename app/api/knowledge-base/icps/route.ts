import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get ICPs for the workspace
    const { data: icps, error } = await supabase
      .from('knowledge_base_icps')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching ICPs:', error);
      return NextResponse.json({ error: 'Failed to fetch ICPs' }, { status: 500 });
    }

    return NextResponse.json({ icps });
  } catch (error) {
    console.error('Unexpected error in ICPs API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();
    const { 
      workspace_id, 
      name, 
      company_size_min, 
      company_size_max, 
      industries, 
      job_titles, 
      locations, 
      technologies, 
      pain_points, 
      qualification_criteria, 
      messaging_framework 
    } = body;

    if (!workspace_id || !name) {
      return NextResponse.json({ error: 'Workspace ID and name are required' }, { status: 400 });
    }

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create new ICP
    const { data: icp, error } = await supabase
      .from('knowledge_base_icps')
      .insert({
        workspace_id,
        name,
        company_size_min,
        company_size_max,
        industries: industries || [],
        job_titles: job_titles || [],
        locations: locations || [],
        technologies: technologies || [],
        pain_points: pain_points || [],
        qualification_criteria: qualification_criteria || {},
        messaging_framework: messaging_framework || {},
        created_by: session.user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating ICP:', error);
      return NextResponse.json({ error: 'Failed to create ICP' }, { status: 500 });
    }

    return NextResponse.json({ icp }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in ICPs POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();
    const { 
      id, 
      name, 
      company_size_min, 
      company_size_max, 
      industries, 
      job_titles, 
      locations, 
      technologies, 
      pain_points, 
      qualification_criteria, 
      messaging_framework,
      is_active 
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ICP ID is required' }, { status: 400 });
    }

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update ICP
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name;
    if (company_size_min !== undefined) updateData.company_size_min = company_size_min;
    if (company_size_max !== undefined) updateData.company_size_max = company_size_max;
    if (industries !== undefined) updateData.industries = industries;
    if (job_titles !== undefined) updateData.job_titles = job_titles;
    if (locations !== undefined) updateData.locations = locations;
    if (technologies !== undefined) updateData.technologies = technologies;
    if (pain_points !== undefined) updateData.pain_points = pain_points;
    if (qualification_criteria !== undefined) updateData.qualification_criteria = qualification_criteria;
    if (messaging_framework !== undefined) updateData.messaging_framework = messaging_framework;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: icp, error } = await supabase
      .from('knowledge_base_icps')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating ICP:', error);
      return NextResponse.json({ error: 'Failed to update ICP' }, { status: 500 });
    }

    return NextResponse.json({ icp });
  } catch (error) {
    console.error('Unexpected error in ICPs PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ICP ID is required' }, { status: 400 });
    }

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Soft delete by setting is_active to false
    const { data: deletedIcp, error } = await supabase
      .from('knowledge_base_icps')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error deleting ICP:', error);
      return NextResponse.json({ error: 'Failed to delete ICP' }, { status: 500 });
    }

    return NextResponse.json({ message: 'ICP deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in ICPs DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}