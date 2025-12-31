import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate with Firebase
    await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Get sections for the workspace
    const { rows: sections } = await pool.query(
      `SELECT * FROM knowledge_base_sections
       WHERE workspace_id = $1 AND is_active = true
       ORDER BY sort_order`,
      [workspaceId]
    );

    // If no sections exist, initialize default sections
    if (!sections || sections.length === 0) {
      try {
        await pool.query(
          'SELECT initialize_knowledge_base_sections($1)',
          [workspaceId]
        );

        // Fetch the newly created sections
        const { rows: newSections } = await pool.query(
          `SELECT * FROM knowledge_base_sections
           WHERE workspace_id = $1 AND is_active = true
           ORDER BY sort_order`,
          [workspaceId]
        );

        return NextResponse.json({ sections: newSections });
      } catch (initError) {
        console.error('Error initializing KB sections:', initError);
        return NextResponse.json({ error: 'Failed to initialize sections' }, { status: 500 });
      }
    }

    return NextResponse.json({ sections });
  } catch (error) {
    console.error('Unexpected error in KB sections API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate with Firebase
    await verifyAuth(request);

    const body = await request.json();
    const { workspace_id, section_id, title, description, icon, sort_order } = body;

    if (!workspace_id || !section_id || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create new section
    const { rows } = await pool.query(
      `INSERT INTO knowledge_base_sections (
        workspace_id, section_id, title, description, icon, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        workspace_id,
        section_id,
        title,
        description,
        icon,
        sort_order || 0
      ]
    );

    const section = rows[0];

    if (!section) {
      console.error('Error creating KB section');
      return NextResponse.json({ error: 'Failed to create section' }, { status: 500 });
    }

    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in KB sections POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate with Firebase
    await verifyAuth(request);

    const body = await request.json();
    const { id, title, description, icon, sort_order, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
    }

    // Build dynamic update query
    const updates: string[] = ['updated_at = $1'];
    const params: any[] = [new Date().toISOString()];
    let paramIndex = 2;

    if (title !== undefined) { updates.push(`title = $${paramIndex++}`); params.push(title); }
    if (description !== undefined) { updates.push(`description = $${paramIndex++}`); params.push(description); }
    if (icon !== undefined) { updates.push(`icon = $${paramIndex++}`); params.push(icon); }
    if (sort_order !== undefined) { updates.push(`sort_order = $${paramIndex++}`); params.push(sort_order); }
    if (is_active !== undefined) { updates.push(`is_active = $${paramIndex++}`); params.push(is_active); }

    params.push(id);

    const { rows } = await pool.query(
      `UPDATE knowledge_base_sections SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    const section = rows[0];

    if (!section) {
      console.error('Error updating KB section');
      return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
    }

    return NextResponse.json({ section });
  } catch (error) {
    console.error('Unexpected error in KB sections PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
