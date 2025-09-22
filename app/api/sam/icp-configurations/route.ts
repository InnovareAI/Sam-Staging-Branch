/**
 * SAM AI ICP Configurations API
 * Manages the 20 B2B market niche ICP configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Get all available ICP configurations
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { searchParams } = new URL(request.url);
    const market_niche = searchParams.get('market_niche');
    const industry = searchParams.get('industry');
    const search = searchParams.get('search');

    let query = supabase
      .from('icp_configurations')
      .select(`
        id,
        name,
        display_name,
        description,
        market_niche,
        industry_vertical,
        target_profile,
        decision_makers,
        pain_points,
        buying_process,
        messaging_strategy,
        success_metrics,
        tags,
        complexity_level,
        created_at,
        updated_at
      `)
      .eq('is_template', true)
      .eq('is_active', true)
      .order('display_name');

    // Filter by market niche if provided
    if (market_niche) {
      query = query.eq('market_niche', market_niche);
    }

    // Filter by industry if provided
    if (industry) {
      query = query.eq('industry_vertical', industry);
    }

    // Search functionality
    if (search) {
      query = query.or(`display_name.ilike.%${search}%,description.ilike.%${search}%,industry_vertical.ilike.%${search}%,tags.cs.{${search}}`);
    }

    const { data: icpConfigurations, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const body = await request.json();
    const { action } = body;

    if (action === 'get_market_niches') {
      const { data: niches, error } = await supabase
        .from('icp_configurations')
        .select('market_niche, display_name, tags, industry_vertical')
        .eq('is_template', true)
        .eq('is_active', true)
        .order('display_name');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

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

      const { data: configs, error } = await supabase
        .from('icp_configurations')
        .select('*')
        .eq('market_niche', market_niche)
        .eq('is_template', true)
        .eq('is_active', true)
        .limit(1);

      if (error || !configs || configs.length === 0) {
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

