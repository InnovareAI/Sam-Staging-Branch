/**
 * SAM Template Library API
 * Manages creation, retrieval, and search of message templates
 * Updated Dec 31, 2025: Migrated to verifyAuth and pool.query
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

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
    query?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = auth.user;
    const body: TemplateLibraryRequest = await req.json();
    const { action, template, template_id, search_params } = body;

    switch (action) {
      case 'create':
        return await createTemplate(user.uid, template!);

      case 'list':
        return await listTemplates(user.uid, search_params);

      case 'update':
        return await updateTemplate(user.uid, template_id!, template!);

      case 'delete':
        return await deleteTemplate(user.uid, template_id!);

      case 'search':
        return await searchTemplates(user.uid, search_params!);

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
    const auth = await verifyAuth(req);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const industry = searchParams.get('industry');
    const campaign_type = searchParams.get('campaign_type');
    const limit = parseInt(searchParams.get('limit') || '20');

    return await listTemplates(auth.user.uid, {
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

async function createTemplate(userId: string, template: any) {
  // Get user's workspace
  const userRes = await pool.query(
    'SELECT current_workspace_id FROM users WHERE id = $1',
    [userId]
  );
  const workspaceId = userRes.rows[0]?.current_workspace_id;

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
  }

  const res = await pool.query(
    `INSERT INTO sam_template_library (
      workspace_id, created_by, name, type, content, variables, 
      industry, campaign_type, target_audience, performance_data, 
      tags, is_active, usage_count, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, 0, NOW(), NOW())
    RETURNING *`,
    [
      workspaceId,
      userId,
      template.name,
      template.type,
      template.content,
      template.variables || [],
      template.industry,
      template.campaign_type,
      template.target_audience,
      JSON.stringify(template.performance_data || {}),
      template.tags || []
    ]
  );

  return NextResponse.json({
    success: true,
    template: res.rows[0],
    message: `Template "${template.name}" created successfully!`
  });
}

async function listTemplates(userId: string, searchParams: any = {}) {
  const userRes = await pool.query(
    'SELECT current_workspace_id FROM users WHERE id = $1',
    [userId]
  );
  const workspaceId = userRes.rows[0]?.current_workspace_id;

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
  }

  let queryText = `
    SELECT * FROM sam_template_library 
    WHERE workspace_id = $1 AND is_active = true
  `;
  const queryParams: any[] = [workspaceId];

  if (searchParams.type) {
    queryParams.push(searchParams.type);
    queryText += ` AND type = $${queryParams.length}`;
  }
  if (searchParams.industry) {
    queryParams.push(searchParams.industry);
    queryText += ` AND industry = $${queryParams.length}`;
  }
  if (searchParams.campaign_type) {
    queryParams.push(searchParams.campaign_type);
    queryText += ` AND campaign_type = $${queryParams.length}`;
  }

  queryText += ` ORDER BY updated_at DESC`;

  if (searchParams.limit) {
    queryParams.push(searchParams.limit);
    queryText += ` LIMIT $${queryParams.length}`;
  }

  const res = await pool.query(queryText, queryParams);
  const data = res.rows;

  // Group templates by type
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
      workspace_id: workspaceId,
      filters_applied: searchParams
    }
  });
}

async function updateTemplate(userId: string, templateId: string, updates: any) {
  const userRes = await pool.query(
    'SELECT current_workspace_id FROM users WHERE id = $1',
    [userId]
  );
  const workspaceId = userRes.rows[0]?.current_workspace_id;

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
  }

  // Filter allowed updates
  const allowedUpdates = [
    'name', 'type', 'content', 'variables', 'industry',
    'campaign_type', 'target_audience', 'performance_data', 'tags', 'is_active'
  ];

  const setClauses: string[] = [];
  const queryParams: any[] = [templateId, workspaceId];

  Object.keys(updates).forEach(key => {
    if (allowedUpdates.includes(key)) {
      queryParams.push(key === 'performance_data' ? JSON.stringify(updates[key]) : updates[key]);
      setClauses.push(`${key} = $${queryParams.length}`);
    }
  });

  if (setClauses.length === 0) {
    return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
  }

  const queryText = `
    UPDATE sam_template_library 
    SET ${setClauses.join(', ')}, updated_at = NOW()
    WHERE id = $1 AND workspace_id = $2
    RETURNING *
  `;

  const res = await pool.query(queryText, queryParams);

  if (res.rowCount === 0) {
    return NextResponse.json({ error: 'Template not found or unauthorized' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    template: res.rows[0],
    message: 'Template updated successfully!'
  });
}

async function deleteTemplate(userId: string, templateId: string) {
  const userRes = await pool.query(
    'SELECT current_workspace_id FROM users WHERE id = $1',
    [userId]
  );
  const workspaceId = userRes.rows[0]?.current_workspace_id;

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
  }

  // Soft delete
  const res = await pool.query(
    `UPDATE sam_template_library 
     SET is_active = false, updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2
     RETURNING id`,
    [templateId, workspaceId]
  );

  if (res.rowCount === 0) {
    return NextResponse.json({ error: 'Template not found or unauthorized' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    message: 'Template deleted successfully!'
  });
}

async function searchTemplates(userId: string, searchParams: any) {
  const userRes = await pool.query(
    'SELECT current_workspace_id FROM users WHERE id = $1',
    [userId]
  );
  const workspaceId = userRes.rows[0]?.current_workspace_id;

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
  }

  let queryText = `
    SELECT * FROM sam_template_library 
    WHERE workspace_id = $1 AND is_active = true
  `;
  const queryParams: any[] = [workspaceId];

  // Text search in content and name
  if (searchParams.query) {
    queryParams.push(`%${searchParams.query}%`);
    queryText += ` AND (name ILIKE $${queryParams.length} OR content ILIKE $${queryParams.length})`;
  }

  // Tag search
  if (searchParams.tags && searchParams.tags.length > 0) {
    queryParams.push(searchParams.tags);
    queryText += ` AND tags @> $${queryParams.length}`;
  }

  // Type filter
  if (searchParams.type) {
    queryParams.push(searchParams.type);
    queryText += ` AND type = $${queryParams.length}`;
  }

  queryText += ` ORDER BY usage_count DESC`;

  if (searchParams.limit) {
    queryParams.push(searchParams.limit);
    queryText += ` LIMIT $${queryParams.length}`;
  } else {
    queryText += ` LIMIT 20`;
  }

  const res = await pool.query(queryText, queryParams);

  return NextResponse.json({
    success: true,
    templates: res.rows,
    search_query: searchParams,
    results_count: res.rows.length
  });
}