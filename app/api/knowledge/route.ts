import { NextRequest, NextResponse } from 'next/server';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';

// GET /api/knowledge - Get all knowledge base items or search
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');

    let data;
    if (search) {
      data = await supabaseKnowledge.search(search, category || undefined);
    } else {
      data = await supabaseKnowledge.getByCategory(category || undefined);
    }

    return NextResponse.json({
      success: true,
      data,
      count: data.length
    });

  } catch (error) {
    console.error('Knowledge API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/knowledge - Add new knowledge base item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, subcategory, title, content, tags, version = '4.4' } = body;

    if (!category || !title || !content) {
      return NextResponse.json(
        { error: 'Category, title, and content are required' },
        { status: 400 }
      );
    }

    const newItem = await supabaseKnowledge.addKnowledgeItem({
      category,
      subcategory,
      title,
      content,
      tags: tags || [],
      version,
      is_active: true
    });

    if (!newItem) {
      return NextResponse.json(
        { error: 'Failed to create knowledge item' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: newItem
    });

  } catch (error) {
    console.error('Knowledge create API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}