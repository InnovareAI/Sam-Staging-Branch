/**
 * SAM AI ICP Configurations API
 * Manages the 20 B2B market niche ICP configurations
 * Updated Dec 31, 2025: Migrated to verifyAuth and pool.query
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

// Get all available ICP configurations
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const market_niche = searchParams.get('market_niche');
    const industry = searchParams.get('industry');
    const search = searchParams.get('search');

    let queryText = `
      SELECT 
        id, name, display_name, description, market_niche, industry_vertical,
        target_profile, decision_makers, pain_points, buying_process,
        messaging_strategy, success_metrics, tags, complexity_level,
        created_at, updated_at
      FROM icp_configurations
      WHERE is_template = true AND is_active = true
    `;
    const queryParams: any[] = [];

    if (market_niche) {
      queryParams.push(market_niche);
      queryText += ` AND market_niche = $${queryParams.length}`;
    }

    if (industry) {
      queryParams.push(industry);
      queryText += ` AND industry_vertical = $${queryParams.length}`;
    }

    if (search) {
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm);
      const searchIdx = queryParams.length;
      queryParams.push(search);
      const tagIdx = queryParams.length;

      queryText += ` AND (
        display_name ILIKE $${searchIdx} OR 
        description ILIKE $${searchIdx} OR 
        industry_vertical ILIKE $${searchIdx} OR 
        $${tagIdx} = ANY(tags)
      )`;
    }

    queryText += ` ORDER BY display_name`;

    const res = await pool.query(queryText, queryParams);
    const icpConfigurations = res.rows;

    // Format the data for easier consumption
    const formattedConfigurations = icpConfigurations?.map(config => ({
      id: config.id,
      name: config.name,
      title: config.display_name,
      description: config.description,
      market_niche: config.market_niche,
      industry_vertical: config.industry_vertical,
      tags: config.tags,
      complexity_level: config.complexity_level,
      created_at: config.created_at,
      updated_at: config.updated_at,
      // Structured data from JSONB fields
      structured_data: {
        target_profile: config.target_profile,
        decision_makers: config.decision_makers,
        pain_points: config.pain_points,
        buying_process: config.buying_process,
        messaging_strategy: config.messaging_strategy,
        success_metrics: config.success_metrics
      }
    }));

    return NextResponse.json({
      success: true,
      count: formattedConfigurations?.length || 0,
      configurations: formattedConfigurations
    });

  } catch (error) {
    console.error('ICP configurations API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ICP configurations' },
      { status: 500 }
    );
  }
}

// Get available market niches summary and specific configurations
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'get_market_niches') {
      const res = await pool.query(
        `SELECT market_niche, display_name, tags, industry_vertical 
         FROM icp_configurations 
         WHERE is_template = true AND is_active = true 
         ORDER BY display_name`
      );
      const niches = res.rows;

      const formattedNiches = niches?.map(niche => ({
        value: niche.market_niche,
        label: niche.display_name,
        industry: niche.industry_vertical,
        tags: niche.tags
      }));

      return NextResponse.json({
        success: true,
        market_niches: formattedNiches
      });
    }

    if (action === 'get_configuration_by_niche') {
      const { market_niche } = body;

      if (!market_niche) {
        return NextResponse.json({ error: 'Market niche required' }, { status: 400 });
      }

      const res = await pool.query(
        `SELECT * FROM icp_configurations 
         WHERE market_niche = $1 AND is_template = true AND is_active = true 
         LIMIT 1`,
        [market_niche]
      );
      const configs = res.rows;

      if (!configs || configs.length === 0) {
        return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
      }

      const config = configs[0];

      return NextResponse.json({
        success: true,
        configuration: {
          id: config.id,
          name: config.name,
          title: config.display_name,
          description: config.description,
          market_niche: config.market_niche,
          industry_vertical: config.industry_vertical,
          tags: config.tags,
          complexity_level: config.complexity_level,
          structured_data: {
            target_profile: config.target_profile,
            decision_makers: config.decision_makers,
            pain_points: config.pain_points,
            buying_process: config.buying_process,
            messaging_strategy: config.messaging_strategy,
            success_metrics: config.success_metrics
          }
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('ICP configurations POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

