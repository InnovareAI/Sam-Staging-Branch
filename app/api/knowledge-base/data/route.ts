import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    // Build query for the correct knowledge_base table
    let query = supabase
      .from('knowledge_base')
      .select('*')
      .eq('is_active', true);

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      // Use the search function we created
      const { data: searchResults, error: searchError } = await supabase
        .rpc('search_knowledge_base', {
          search_query: search,
          category_filter: category
        });

      if (searchError) {
        console.error('Search error:', searchError);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
      }

      return NextResponse.json({ 
        content: searchResults || [],
        search_query: search,
        category_filter: category
      });
    }

    const { data: content, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching KB data:', error);
      return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
    }

    // Group by category for easy display
    const groupedContent = content?.reduce((acc: any, item: any) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {}) || {};

    return NextResponse.json({ 
      content: content || [],
      grouped: groupedContent,
      categories: Object.keys(groupedContent)
    });
  } catch (error) {
    console.error('Unexpected error in KB data API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const body = await request.json();
    const { category, subcategory, title, content, tags } = body;

    if (!category || !title || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create new knowledge base entry
    const { data: newEntry, error } = await supabase
      .from('knowledge_base')
      .insert({
        category,
        subcategory,
        title,
        content,
        tags: tags || []
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating KB entry:', error);
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
    }

    return NextResponse.json({ entry: newEntry }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in KB data POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}