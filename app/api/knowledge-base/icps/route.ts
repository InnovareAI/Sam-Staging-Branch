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
      SELECT * FROM knowledge_base_icps
      WHERE workspace_id = $1
    `;
    const params: any[] = [workspaceId];

    if (!includeInactive) {
      query += ` AND is_active = true`;
    }

    query += ` ORDER BY created_at DESC`;

    const icpsResult = await pool.query(query, params);
    const icps = icpsResult.rows;

    // ALSO count ICP documents from knowledge_base_documents table (section_id='icp')
    // This fixes the completion calculation for workspaces with uploaded ICP docs
    // Also catches ICP docs that may be miscategorized (e.g., "Ideal Client Dossier" in products section)
    const icpDocsResult = await pool.query(
      `SELECT id, filename, created_at FROM knowledge_base_documents
       WHERE workspace_id = $1
       AND (section_id = 'icp' OR section_id = 'ideal-customer' OR filename ILIKE '%ideal%client%' OR filename ILIKE '%icp%')
       ORDER BY created_at DESC`,
      [workspaceId]
    );
    const icpDocs = icpDocsResult.rows;

    // Transform database schema to match frontend expectations
    const transformedIcps = (icps ?? []).map((icp: any) => {
      const metadata = typeof icp.metadata === 'string' ? JSON.parse(icp.metadata) : (icp.metadata || {});
      const pain_points_parsed = typeof icp.pain_points === 'string' ? JSON.parse(icp.pain_points) : (icp.pain_points || []);

      // Parse company_size range if it exists
      const companySizeMatch = icp.company_size?.match(/(\d+)-(\d+)/);

      return {
        id: icp.id,
        name: icp.title || icp.name || 'Untitled ICP',
        workspace_id: icp.workspace_id,
        is_active: icp.is_active,
        created_at: icp.created_at,
        // Map back to old schema for frontend compatibility
        industries: metadata.industries || (icp.industry ? [icp.industry] : []),
        job_titles: metadata.job_titles || [],
        locations: icp.geography || [],
        technologies: metadata.technologies || [],
        pain_points: Array.isArray(pain_points_parsed) ? pain_points_parsed : [],
        company_size_min: companySizeMatch ? parseInt(companySizeMatch[1]) : null,
        company_size_max: companySizeMatch ? parseInt(companySizeMatch[2]) : null,
        qualification_criteria: typeof icp.buying_process === 'string' ? JSON.parse(icp.buying_process) : (icp.buying_process || {}),
        messaging_framework: metadata.messaging_framework || {}
      };
    });

    // Combine structured ICPs and ICP documents for accurate count
    const allIcps = [
      ...transformedIcps,
      ...(icpDocs ?? []).map((doc: any) => ({
        id: doc.id,
        name: doc.filename,
        workspace_id: workspaceId,
        is_active: true,
        created_at: doc.created_at,
        source: 'document' as const
      }))
    ];

    return NextResponse.json({ icps: allIcps });
  } catch (error) {
    console.error('Unexpected error in ICPs API:', error);
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
      company_size_min,
      company_size_max,
      industries,
      job_titles,
      locations,
      technologies,
      pain_points,
      qualification_criteria,
      messaging_framework
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Map fields to match actual schema
    const result = await pool.query(
      `INSERT INTO knowledge_base_icps (
        workspace_id, title, description, industry, company_size, revenue_range,
        geography, pain_points, buying_process, metadata, tags, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        workspaceId,
        name.trim(),
        body.description || null,
        industries && industries.length > 0 ? industries[0] : null,
        company_size_min && company_size_max ? `${company_size_min}-${company_size_max}` : null,
        body.revenue_range || null,
        toStringArray(locations),
        JSON.stringify(toStringArray(pain_points)),
        qualification_criteria ? JSON.stringify(qualification_criteria) : null,
        JSON.stringify({
          industries: toStringArray(industries),
          job_titles: toStringArray(job_titles),
          technologies: toStringArray(technologies),
          messaging_framework: messaging_framework || {}
        }),
        [],
        true,
        userId
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Failed to create ICP' }, { status: 500 });
    }

    return NextResponse.json({ icp: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in ICPs POST:', error);
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
      company_size_min,
      company_size_max,
      industries,
      job_titles,
      locations,
      technologies,
      pain_points,
      qualification_criteria,
      messaging_framework,
      is_active
    } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ICP ID is required' }, { status: 400 });
    }

    // Build dynamic update query
    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (typeof name === 'string') {
      updates.push(`name = $${paramIndex++}`);
      params.push(name.trim());
    }
    if (company_size_min !== undefined) {
      updates.push(`company_size_min = $${paramIndex++}`);
      params.push(company_size_min);
    }
    if (company_size_max !== undefined) {
      updates.push(`company_size_max = $${paramIndex++}`);
      params.push(company_size_max);
    }
    if (industries !== undefined) {
      updates.push(`industries = $${paramIndex++}`);
      params.push(toStringArray(industries));
    }
    if (job_titles !== undefined) {
      updates.push(`job_titles = $${paramIndex++}`);
      params.push(toStringArray(job_titles));
    }
    if (locations !== undefined) {
      updates.push(`locations = $${paramIndex++}`);
      params.push(toStringArray(locations));
    }
    if (technologies !== undefined) {
      updates.push(`technologies = $${paramIndex++}`);
      params.push(toStringArray(technologies));
    }
    if (pain_points !== undefined) {
      updates.push(`pain_points = $${paramIndex++}`);
      params.push(toStringArray(pain_points));
    }
    if (qualification_criteria !== undefined) {
      updates.push(`qualification_criteria = $${paramIndex++}`);
      params.push(JSON.stringify(toRecord(qualification_criteria)));
    }
    if (messaging_framework !== undefined) {
      updates.push(`messaging_framework = $${paramIndex++}`);
      params.push(JSON.stringify(toRecord(messaging_framework)));
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(Boolean(is_active));
    }

    params.push(id);
    params.push(workspaceId);

    const result = await pool.query(
      `UPDATE knowledge_base_icps
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND workspace_id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'ICP not found' }, { status: 404 });
    }

    return NextResponse.json({ icp: result.rows[0] });
  } catch (error) {
    console.error('Unexpected error in ICPs PUT:', error);
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
      return NextResponse.json({ error: 'ICP ID is required' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE knowledge_base_icps
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'ICP not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'ICP deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in ICPs DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
