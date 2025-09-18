import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface TemplateLibraryRequest {
  action: 'create' | 'list' | 'update' | 'delete' | 'search';
  template?: {
    name: string;
    type: 'connection_request' | 'follow_up_1' | 'follow_up_2' | 'follow_up_3' | 'email' | 'sequence';
    content: string;
    variables: string[];
    industry?: string;
    campaign_type?: string;
    target_audience?: string;
    performance_data?: any;
    tags?: string[];
  };
  template_id?: string;
  search_params?: {
    type?: string;
    industry?: string;
    campaign_type?: string;
    tags?: string[];
    limit?: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, template, template_id, search_params }: TemplateLibraryRequest = await req.json();

    switch (action) {
      case 'create':
        return await createTemplate(supabase, user.id, template!);
      
      case 'list':
        return await listTemplates(supabase, user.id, search_params);
      
      case 'update':
        return await updateTemplate(supabase, user.id, template_id!, template!);
      
      case 'delete':
        return await deleteTemplate(supabase, user.id, template_id!);
      
      case 'search':
        return await searchTemplates(supabase, user.id, search_params!);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Template library error:', error);
    return NextResponse.json(
      { error: 'Template library operation failed', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const industry = searchParams.get('industry');
    const campaign_type = searchParams.get('campaign_type');
    const limit = parseInt(searchParams.get('limit') || '20');

    return await listTemplates(supabase, user.id, {
      type, industry, campaign_type, limit
    });

  } catch (error: any) {
    console.error('Template library GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates', details: error.message },
      { status: 500 }
    );
  }
}

async function createTemplate(supabase: any, userId: string, template: any) {
  // Get user's workspace
  const { data: userWorkspace } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', userId)
    .single();

  if (!userWorkspace?.workspace_id) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
  }

  // Check if table exists, if not create it
  await ensureTemplateTableExists(supabase);

  const templateData = {
    workspace_id: userWorkspace.workspace_id,
    created_by: userId,
    name: template.name,
    type: template.type,
    content: template.content,
    variables: template.variables,
    industry: template.industry,
    campaign_type: template.campaign_type,
    target_audience: template.target_audience,
    performance_data: template.performance_data || {},
    tags: template.tags || [],
    is_active: true,
    usage_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('sam_template_library')
    .insert(templateData)
    .select()
    .single();

  if (error) {
    console.error('Template creation error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    template: data,
    message: `Template "${template.name}" created successfully!`
  });
}

async function listTemplates(supabase: any, userId: string, searchParams: any = {}) {
  const { data: userWorkspace } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', userId)
    .single();

  if (!userWorkspace?.workspace_id) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
  }

  let query = supabase
    .from('sam_template_library')
    .select('*')
    .eq('workspace_id', userWorkspace.workspace_id)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  // Apply filters
  if (searchParams.type) {
    query = query.eq('type', searchParams.type);
  }
  if (searchParams.industry) {
    query = query.eq('industry', searchParams.industry);
  }
  if (searchParams.campaign_type) {
    query = query.eq('campaign_type', searchParams.campaign_type);
  }
  if (searchParams.limit) {
    query = query.limit(searchParams.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Template list error:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }

  // Group templates by type for better organization
  const groupedTemplates = data.reduce((acc: any, template: any) => {
    if (!acc[template.type]) {
      acc[template.type] = [];
    }
    acc[template.type].push(template);
    return acc;
  }, {});

  return NextResponse.json({
    success: true,
    templates: data,
    grouped_templates: groupedTemplates,
    total_count: data.length,
    metadata: {
      workspace_id: userWorkspace.workspace_id,
      filters_applied: searchParams
    }
  });
}

async function updateTemplate(supabase: any, userId: string, templateId: string, updates: any) {
  const { data: userWorkspace } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', userId)
    .single();

  if (!userWorkspace?.workspace_id) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
  }

  const updateData = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('sam_template_library')
    .update(updateData)
    .eq('id', templateId)
    .eq('workspace_id', userWorkspace.workspace_id)
    .select()
    .single();

  if (error) {
    console.error('Template update error:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    template: data,
    message: 'Template updated successfully!'
  });
}

async function deleteTemplate(supabase: any, userId: string, templateId: string) {
  const { data: userWorkspace } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', userId)
    .single();

  if (!userWorkspace?.workspace_id) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
  }

  // Soft delete by setting is_active to false
  const { data, error } = await supabase
    .from('sam_template_library')
    .update({ 
      is_active: false, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', templateId)
    .eq('workspace_id', userWorkspace.workspace_id)
    .select()
    .single();

  if (error) {
    console.error('Template delete error:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Template deleted successfully!'
  });
}

async function searchTemplates(supabase: any, userId: string, searchParams: any) {
  const { data: userWorkspace } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', userId)
    .single();

  if (!userWorkspace?.workspace_id) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
  }

  // Build search query with text search capabilities
  let query = supabase
    .from('sam_template_library')
    .select('*')
    .eq('workspace_id', userWorkspace.workspace_id)
    .eq('is_active', true);

  // Text search in content and name
  if (searchParams.query) {
    query = query.or(`name.ilike.%${searchParams.query}%,content.ilike.%${searchParams.query}%`);
  }

  // Tag search
  if (searchParams.tags && searchParams.tags.length > 0) {
    query = query.contains('tags', searchParams.tags);
  }

  // Type filter
  if (searchParams.type) {
    query = query.eq('type', searchParams.type);
  }

  const { data, error } = await query
    .order('usage_count', { ascending: false })
    .limit(searchParams.limit || 20);

  if (error) {
    console.error('Template search error:', error);
    return NextResponse.json({ error: 'Failed to search templates' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    templates: data,
    search_query: searchParams,
    results_count: data.length
  });
}

async function ensureTemplateTableExists(supabase: any) {
  // Tables are now created via proper migrations
  // This function is kept for backwards compatibility but is now safe
  try {
    // Simple existence check - if this fails, tables don't exist and need migration
    const { error } = await supabase
      .from('sam_template_library')
      .select('id')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      console.error('Template tables do not exist. Please run Supabase migrations.');
      throw new Error('Database schema not initialized. Run migrations first.');
    }
  } catch (error) {
    console.error('Template table check failed:', error);
    throw new Error('Database schema verification failed');
  }
}