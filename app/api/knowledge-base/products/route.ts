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
    const includeInactive = searchParams.get('include_inactive') === 'true';

    let query = `
      SELECT * FROM knowledge_base_products
      WHERE workspace_id = $1
    `;
    const params: any[] = [workspaceId];

    if (!includeInactive) {
      query += ` AND is_active = true`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);

    return NextResponse.json({ products: result.rows ?? [] });
  } catch (error) {
    console.error('Unexpected error in products GET:', error);
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
      description,
      category,
      pricing,
      features,
      benefits,
      use_cases,
      competitive_advantages,
      target_segments
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO knowledge_base_products (
        workspace_id, name, description, category, pricing, features,
        benefits, use_cases, competitive_advantages, target_segments, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        workspaceId,
        name.trim(),
        typeof description === 'string' ? description : null,
        typeof category === 'string' ? category : null,
        JSON.stringify(toRecord(pricing)),
        toStringArray(features),
        toStringArray(benefits),
        toStringArray(use_cases),
        toStringArray(competitive_advantages),
        toStringArray(target_segments),
        true,
        userId
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
    }

    return NextResponse.json({ product: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in products POST:', error);
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
      description,
      category,
      pricing,
      features,
      benefits,
      use_cases,
      competitive_advantages,
      target_segments,
      is_active
    } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Build dynamic update query
    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (typeof name === 'string') {
      updates.push(`name = $${paramIndex++}`);
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(typeof description === 'string' ? description : null);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      params.push(typeof category === 'string' ? category : null);
    }
    if (pricing !== undefined) {
      updates.push(`pricing = $${paramIndex++}`);
      params.push(JSON.stringify(toRecord(pricing)));
    }
    if (features !== undefined) {
      updates.push(`features = $${paramIndex++}`);
      params.push(toStringArray(features));
    }
    if (benefits !== undefined) {
      updates.push(`benefits = $${paramIndex++}`);
      params.push(toStringArray(benefits));
    }
    if (use_cases !== undefined) {
      updates.push(`use_cases = $${paramIndex++}`);
      params.push(toStringArray(use_cases));
    }
    if (competitive_advantages !== undefined) {
      updates.push(`competitive_advantages = $${paramIndex++}`);
      params.push(toStringArray(competitive_advantages));
    }
    if (target_segments !== undefined) {
      updates.push(`target_segments = $${paramIndex++}`);
      params.push(toStringArray(target_segments));
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(Boolean(is_active));
    }

    params.push(id);
    params.push(workspaceId);

    const result = await pool.query(
      `UPDATE knowledge_base_products
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND workspace_id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product: result.rows[0] });
  } catch (error) {
    console.error('Unexpected error in products PUT:', error);
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
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE knowledge_base_products
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in products DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
