import { NextRequest, NextResponse } from 'next/server';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';
import { apiError, handleApiError, apiSuccess } from '@/lib/api-error-handler';

// GET /api/knowledge - Get all knowledge base items or search
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      throw apiError.validation('Workspace ID is required');
    }

    let data;
    if (search) {
      data = await supabaseKnowledge.search(search, {
        category: category || undefined,
        workspaceId
      });
    } else {
      data = await supabaseKnowledge.getByCategory({
        category: category || undefined,
        workspaceId
      });
    }

    return apiSuccess({
      data,
      count: data.length
    });

  } catch (error) {
    return handleApiError(error, 'knowledge_fetch');
  }
}

// POST /api/knowledge - Add new knowledge base item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspace_id, category, subcategory, title, content, tags, version = '4.4' } = body;

    if (!workspace_id || !category || !title || !content) {
      throw apiError.validation(
        'Missing required fields',
        'Workspace ID, category, title, and content are required'
      );
    }

    const newItem = await supabaseKnowledge.addKnowledgeItem({
      workspace_id,
      category,
      subcategory,
      title,
      content,
      tags: tags || [],
      version,
      is_active: true
    });

    if (!newItem) {
      throw apiError.internal('Failed to create knowledge item');
    }

    return apiSuccess({ data: newItem }, 'Knowledge item created successfully');

  } catch (error) {
    return handleApiError(error, 'knowledge_create');
  }
}
