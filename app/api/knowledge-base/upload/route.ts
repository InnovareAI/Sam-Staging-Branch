import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === 'application/pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData = await pdfParse(buffer);
    return pdfData.text;
  }

  return new TextDecoder().decode(buffer);
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate with Firebase
    const { userId } = await verifyAuth(request);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const workspaceId = formData.get('workspace_id') as string;
    const sectionId = formData.get('section_id') as string;
    const contentType = formData.get('content_type') as string || 'document';
    const tags = formData.get('tags') as string || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    if (!sectionId) {
      return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
    }

    // Read file content
    const text = await extractText(file);
    const fileName = file.name;
    const fileSize = file.size;

    // Parse tags
    const parsedTags = tags ? tags.split(',').map(tag => tag.trim()) : [];
    parsedTags.push('uploaded', contentType);

    // Create title from filename (remove extension)
    const title = fileName.replace(/\.[^/.]+$/, '');

    // Insert into knowledge_base_content
    const { rows } = await pool.query(
      `INSERT INTO knowledge_base_content (
        workspace_id, section_id, content_type, title, content,
        metadata, tags, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        workspaceId,
        sectionId,
        contentType,
        title,
        text,
        JSON.stringify({
          filename: fileName,
          file_size: fileSize,
          uploaded_at: new Date().toISOString(),
          uploaded_by: userId,
          tags: parsedTags
        }),
        parsedTags,
        true,
        userId
      ]
    );

    const content = rows[0];

    if (!content) {
      console.error('Error inserting KB content');
      return NextResponse.json({ error: 'Failed to save document' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: content,
      message: `Document "${title}" uploaded successfully to Knowledge Base`
    });

  } catch (error) {
    console.error('Knowledge Base upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

// GET method to retrieve upload history for a section
export async function GET(request: NextRequest) {
  try {
    // Authenticate with Firebase
    await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const sectionId = searchParams.get('section_id');
    const limit = parseInt(searchParams.get('limit') || '50');

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

    // Only show uploaded documents (tags contains 'uploaded')
    query += ` AND $${paramIndex++} = ANY(tags)`;
    params.push('uploaded');

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
    params.push(limit);

    const { rows: uploads } = await pool.query(query, params);

    return NextResponse.json({ uploads });
  } catch (error) {
    console.error('Unexpected error in uploads API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}