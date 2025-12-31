import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item).trim()))
      .filter((item) => item.length > 0);
  }
  return [];
};

const toRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
};

export async function GET(request: NextRequest) {
  try {
    // Firebase auth verification
    let workspaceId: string;

    try {
      const auth = await verifyAuth(request);
      workspaceId = auth.workspaceId;
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: 'Unauthorized' }, { status: authError.statusCode || 401 });
    }

    const { searchParams } = new URL(request.url);
    const icpFilter = searchParams.get('icp_id');
    const includeInactive = searchParams.get('include_inactive') === 'true';

    let query = `
      SELECT * FROM knowledge_base_personas
      WHERE workspace_id = $1
    `;
    const params: any[] = [workspaceId];
    let paramIndex = 2;

    if (icpFilter) {
      query += ` AND icp_id = $${paramIndex}`;
      params.push(icpFilter);
      paramIndex++;
    }

    if (!includeInactive) {
      query += ` AND is_active = true`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);

    return NextResponse.json({ personas: result.rows ?? [] });
  } catch (error) {
    console.error('Unexpected error in personas GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Firebase auth verification
    let userId: string;
    let workspaceId: string;

    try {
      const auth = await verifyAuth(request);
      userId = auth.userId;
      workspaceId = auth.workspaceId;
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: 'Unauthorized' }, { status: authError.statusCode || 401 });
    }

    const body = await request.json();
    const {
      icp_id,
      name,
      job_title,
      department,
      seniority_level,
      decision_making_role,
      pain_points,
      goals,
      communication_preferences,
      objections,
      messaging_approach
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO knowledge_base_personas (
        workspace_id, icp_id, name, job_title, department, seniority_level,
        decision_making_role, pain_points, goals, communication_preferences,
        objections, messaging_approach, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        workspaceId,
        typeof icp_id === 'string' && icp_id.trim().length > 0 ? icp_id : null,
        name.trim(),
        typeof job_title === 'string' ? job_title : null,
        typeof department === 'string' ? department : null,
        typeof seniority_level === 'string' ? seniority_level : null,
        typeof decision_making_role === 'string' ? decision_making_role : null,
        toStringArray(pain_points),
        toStringArray(goals),
        JSON.stringify(toRecord(communication_preferences)),
        toStringArray(objections),
        JSON.stringify(toRecord(messaging_approach)),
        true,
        userId
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 });
    }

    return NextResponse.json({ persona: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in personas POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Firebase auth verification
    let workspaceId: string;

    try {
      const auth = await verifyAuth(request);
      workspaceId = auth.workspaceId;
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: 'Unauthorized' }, { status: authError.statusCode || 401 });
    }

    const body = await request.json();
    const {
      id,
      icp_id,
      name,
      job_title,
      department,
      seniority_level,
      decision_making_role,
      pain_points,
      goals,
      communication_preferences,
      objections,
      messaging_approach,
      is_active
    } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Persona ID is required' }, { status: 400 });
    }

    // Build dynamic update query
    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (typeof icp_id === 'string') {
      updates.push(`icp_id = $${paramIndex++}`);
      params.push(icp_id);
    }
    if (typeof name === 'string') {
      updates.push(`name = $${paramIndex++}`);
      params.push(name.trim());
    }
    if (job_title !== undefined) {
      updates.push(`job_title = $${paramIndex++}`);
      params.push(typeof job_title === 'string' ? job_title : null);
    }
    if (department !== undefined) {
      updates.push(`department = $${paramIndex++}`);
      params.push(typeof department === 'string' ? department : null);
    }
    if (seniority_level !== undefined) {
      updates.push(`seniority_level = $${paramIndex++}`);
      params.push(typeof seniority_level === 'string' ? seniority_level : null);
    }
    if (decision_making_role !== undefined) {
      updates.push(`decision_making_role = $${paramIndex++}`);
      params.push(typeof decision_making_role === 'string' ? decision_making_role : null);
    }
    if (pain_points !== undefined) {
      updates.push(`pain_points = $${paramIndex++}`);
      params.push(toStringArray(pain_points));
    }
    if (goals !== undefined) {
      updates.push(`goals = $${paramIndex++}`);
      params.push(toStringArray(goals));
    }
    if (communication_preferences !== undefined) {
      updates.push(`communication_preferences = $${paramIndex++}`);
      params.push(JSON.stringify(toRecord(communication_preferences)));
    }
    if (objections !== undefined) {
      updates.push(`objections = $${paramIndex++}`);
      params.push(toStringArray(objections));
    }
    if (messaging_approach !== undefined) {
      updates.push(`messaging_approach = $${paramIndex++}`);
      params.push(JSON.stringify(toRecord(messaging_approach)));
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(Boolean(is_active));
    }

    params.push(id);
    params.push(workspaceId);

    const result = await pool.query(
      `UPDATE knowledge_base_personas
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND workspace_id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    return NextResponse.json({ persona: result.rows[0] });
  } catch (error) {
    console.error('Unexpected error in personas PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Firebase auth verification
    let workspaceId: string;

    try {
      const auth = await verifyAuth(request);
      workspaceId = auth.workspaceId;
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: 'Unauthorized' }, { status: authError.statusCode || 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Persona ID is required' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE knowledge_base_personas
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Persona deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in personas DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
