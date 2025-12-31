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

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';

    let query = `
      SELECT * FROM knowledge_base_competitors
      WHERE workspace_id = $1
    `;
    const params: any[] = [workspaceId];

    if (!includeInactive) {
      query += ` AND is_active = true`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);

    return NextResponse.json({ competitors: result.rows ?? [] });
  } catch (error) {
    console.error('Unexpected error in competitors GET:', error);
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
      name,
      website,
      description,
      strengths,
      weaknesses,
      pricing_model,
      key_features,
      target_market,
      competitive_positioning
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO knowledge_base_competitors (
        workspace_id, name, website, description, strengths, weaknesses,
        pricing_model, key_features, target_market, competitive_positioning, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        workspaceId,
        name.trim(),
        typeof website === 'string' ? website : null,
        typeof description === 'string' ? description : null,
        toStringArray(strengths),
        toStringArray(weaknesses),
        typeof pricing_model === 'string' ? pricing_model : null,
        toStringArray(key_features),
        typeof target_market === 'string' ? target_market : null,
        JSON.stringify(toRecord(competitive_positioning)),
        true,
        userId
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Failed to create competitor' }, { status: 500 });
    }

    return NextResponse.json({ competitor: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in competitors POST:', error);
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
      name,
      website,
      description,
      strengths,
      weaknesses,
      pricing_model,
      key_features,
      target_market,
      competitive_positioning,
      is_active
    } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Competitor ID is required' }, { status: 400 });
    }

    // Build dynamic update query
    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (typeof name === 'string') {
      updates.push(`name = $${paramIndex++}`);
      params.push(name.trim());
    }
    if (website !== undefined) {
      updates.push(`website = $${paramIndex++}`);
      params.push(typeof website === 'string' ? website : null);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(typeof description === 'string' ? description : null);
    }
    if (strengths !== undefined) {
      updates.push(`strengths = $${paramIndex++}`);
      params.push(toStringArray(strengths));
    }
    if (weaknesses !== undefined) {
      updates.push(`weaknesses = $${paramIndex++}`);
      params.push(toStringArray(weaknesses));
    }
    if (pricing_model !== undefined) {
      updates.push(`pricing_model = $${paramIndex++}`);
      params.push(typeof pricing_model === 'string' ? pricing_model : null);
    }
    if (key_features !== undefined) {
      updates.push(`key_features = $${paramIndex++}`);
      params.push(toStringArray(key_features));
    }
    if (target_market !== undefined) {
      updates.push(`target_market = $${paramIndex++}`);
      params.push(typeof target_market === 'string' ? target_market : null);
    }
    if (competitive_positioning !== undefined) {
      updates.push(`competitive_positioning = $${paramIndex++}`);
      params.push(JSON.stringify(toRecord(competitive_positioning)));
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(Boolean(is_active));
    }

    params.push(id);
    params.push(workspaceId);

    const result = await pool.query(
      `UPDATE knowledge_base_competitors
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND workspace_id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
    }

    return NextResponse.json({ competitor: result.rows[0] });
  } catch (error) {
    console.error('Unexpected error in competitors PUT:', error);
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
      return NextResponse.json({ error: 'Competitor ID is required' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE knowledge_base_competitors
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Competitor deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in competitors DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
