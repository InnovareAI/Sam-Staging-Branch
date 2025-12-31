import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate with Firebase
    await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const sectionId = searchParams.get('section_id');
    const contentType = searchParams.get('content_type');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Build query
    let query = 'SELECT * FROM knowledge_base_content WHERE workspace_id = $1 AND is_active = true';
    const params: any[] = [workspaceId];
    let paramIndex = 2;

    if (sectionId) {
      query += ` AND section_id = $${paramIndex++}`;
      params.push(sectionId);
    }

    if (contentType) {
      query += ` AND content_type = $${paramIndex++}`;
      params.push(contentType);
    }

    query += ' ORDER BY created_at DESC';

    const { rows: content } = await pool.query(query, params);

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Unexpected error in KB content API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate with Firebase
    const { userId } = await verifyAuth(request);

    const body = await request.json();
    const { workspace_id, section_id, content_type, title, content, metadata, tags } = body;

    if (!workspace_id || !section_id || !content_type || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create new content
    const { rows } = await pool.query(
      `INSERT INTO knowledge_base_content (
        workspace_id, section_id, content_type, title, content, metadata, tags, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        workspace_id,
        section_id,
        content_type,
        title,
        content,
        JSON.stringify(metadata || {}),
        tags || [],
        userId
      ]
    );

    const newContent = rows[0];

    if (!newContent) {
      console.error('Error creating KB content');
      return NextResponse.json({ error: 'Failed to create content' }, { status: 500 });
    }

    return NextResponse.json({ content: newContent }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in KB content POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate with Firebase
    await verifyAuth(request);

    const body = await request.json();
    const { id, title, content, metadata, tags, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
    }

    // Build dynamic update query
    const updates: string[] = ['updated_at = $1'];
    const params: any[] = [new Date().toISOString()];
    let paramIndex = 2;

    if (title !== undefined) { updates.push(`title = $${paramIndex++}`); params.push(title); }
    if (content !== undefined) { updates.push(`content = $${paramIndex++}`); params.push(content); }
    if (metadata !== undefined) { updates.push(`metadata = $${paramIndex++}`); params.push(JSON.stringify(metadata)); }
    if (tags !== undefined) { updates.push(`tags = $${paramIndex++}`); params.push(tags); }
    if (is_active !== undefined) { updates.push(`is_active = $${paramIndex++}`); params.push(is_active); }

    params.push(id);

    const { rows } = await pool.query(
      `UPDATE knowledge_base_content SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    const updatedContent = rows[0];

    if (!updatedContent) {
      console.error('Error updating KB content');
      return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
    }

    return NextResponse.json({ content: updatedContent });
  } catch (error) {
    console.error('Unexpected error in KB content PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate with Firebase
    await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
    }

    // Soft delete by setting is_active to false
    const result = await pool.query(
      'UPDATE knowledge_base_content SET is_active = false, updated_at = $1 WHERE id = $2 RETURNING *',
      [new Date().toISOString(), id]
    );

    if (result.rowCount === 0) {
      console.error('Error deleting KB content');
      return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Content deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in KB content DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
