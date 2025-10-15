import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

async function getWorkspaceId(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', userId)
    .single();

  if (profile?.current_workspace_id) {
    return profile.current_workspace_id;
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  return membership?.workspace_id ?? null;
}

function generateMarkdownReport(documents: any[], workspace: any, section?: string) {
  const title = section ? `Knowledge Base - ${section}` : 'Knowledge Base - Complete Export';
  const date = new Date().toISOString().split('T')[0];

  let markdown = `# ${title}\n\n`;
  markdown += `**Workspace:** ${workspace.name || 'Unnamed Workspace'}\n`;
  markdown += `**Export Date:** ${date}\n`;
  markdown += `**Total Documents:** ${documents.length}\n\n`;
  markdown += `---\n\n`;

  // Group by section
  const bySection: Record<string, any[]> = {};
  documents.forEach(doc => {
    const sec = doc.section_id || 'Uncategorized';
    if (!bySection[sec]) bySection[sec] = [];
    bySection[sec].push(doc);
  });

  Object.entries(bySection).forEach(([sectionName, docs]) => {
    markdown += `## ${sectionName}\n\n`;

    docs.forEach((doc: any) => {
      markdown += `### ${doc.filename}\n\n`;

      if (doc.summary) {
        markdown += `**Summary:** ${doc.summary}\n\n`;
      }

      if (doc.tags && doc.tags.length > 0) {
        markdown += `**Tags:** ${doc.tags.join(', ')}\n\n`;
      }

      if (doc.vector_chunks) {
        markdown += `**Vector Chunks:** ${doc.vector_chunks}\n\n`;
      }

      if (doc.usage_count) {
        markdown += `**Usage Count:** ${doc.usage_count} times\n\n`;
      }

      if (doc.last_used_at) {
        markdown += `**Last Used:** ${new Date(doc.last_used_at).toLocaleDateString()}\n\n`;
      }

      markdown += `**Uploaded:** ${new Date(doc.created_at).toLocaleDateString()}\n\n`;

      if (doc.metadata) {
        markdown += `**Metadata:**\n\`\`\`json\n${JSON.stringify(doc.metadata, null, 2)}\n\`\`\`\n\n`;
      }

      markdown += `---\n\n`;
    });
  });

  return markdown;
}

function generateCSVReport(documents: any[]) {
  const headers = [
    'ID',
    'Filename',
    'Section',
    'Summary',
    'Tags',
    'Vector Chunks',
    'Usage Count',
    'Last Used',
    'Created At',
    'Updated At'
  ];

  let csv = headers.join(',') + '\n';

  documents.forEach(doc => {
    const row = [
      doc.id || '',
      `"${(doc.filename || '').replace(/"/g, '""')}"`,
      doc.section_id || '',
      `"${(doc.summary || '').replace(/"/g, '""')}"`,
      `"${(doc.tags || []).join('; ')}"`,
      doc.vector_chunks || 0,
      doc.usage_count || 0,
      doc.last_used_at ? new Date(doc.last_used_at).toISOString() : '',
      doc.created_at ? new Date(doc.created_at).toISOString() : '',
      doc.updated_at ? new Date(doc.updated_at).toISOString() : ''
    ];
    csv += row.join(',') + '\n';
  });

  return csv;
}

function generateJSONReport(documents: any[], workspace: any, section?: string) {
  return {
    metadata: {
      workspace: {
        id: workspace.id,
        name: workspace.name
      },
      exportDate: new Date().toISOString(),
      section: section || 'all',
      totalDocuments: documents.length
    },
    documents: documents.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      section: doc.section_id,
      summary: doc.summary,
      tags: doc.tags || [],
      vectorChunks: doc.vector_chunks || 0,
      usageCount: doc.usage_count || 0,
      lastUsedAt: doc.last_used_at,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
      metadata: doc.metadata || {}
    }))
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { searchParams } = new URL(request.url);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getWorkspaceId(supabase, user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    // Get workspace info
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', workspaceId)
      .single();

    // Parse query parameters
    const format = searchParams.get('format') || 'json'; // json, csv, markdown
    const section = searchParams.get('section') || null; // specific section or null for all
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Build query
    let query = supabase
      .from('knowledge_base_documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('section_id', { ascending: true })
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (section) {
      query = query.eq('section_id', section);
    }

    const { data: documents, error: docsError } = await query;

    if (docsError) {
      console.error('Failed to fetch documents for export:', docsError);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: 'No documents found to export' }, { status: 404 });
    }

    // Generate export based on format
    let content: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'csv':
        content = generateCSVReport(documents);
        contentType = 'text/csv';
        filename = `kb-export-${section || 'all'}-${Date.now()}.csv`;
        break;

      case 'markdown':
      case 'md':
        content = generateMarkdownReport(documents, workspace, section || undefined);
        contentType = 'text/markdown';
        filename = `kb-export-${section || 'all'}-${Date.now()}.md`;
        break;

      case 'json':
      default:
        const jsonData = generateJSONReport(documents, workspace, section || undefined);
        content = JSON.stringify(jsonData, null, 2);
        contentType = 'application/json';
        filename = `kb-export-${section || 'all'}-${Date.now()}.json`;
        break;
    }

    // Return file download
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Knowledge base export API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
