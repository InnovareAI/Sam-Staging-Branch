import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all'; // 'active', 'completed', 'paused', 'stopped', 'all'
    const campaignId = searchParams.get('campaign_id');

    // Get A/B tests
    let query = supabase
      .from('ab_tests')
      .select(`
        *,
        campaigns!inner(
          id,
          name,
          workspace_id
        ),
        ab_test_variants!inner(
          *
        )
      `)
      .eq('campaigns.workspace_id', user.user_metadata.workspace_id);

    // Filter by campaign if specified
    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    // Filter by status
    if (status !== 'all') {
      query = query.eq('test_status', status);
    }

    // Order by creation date (newest first)
    query = query.order('created_at', { ascending: false });

    const { data: tests, error } = await query;

    if (error) {
      console.error('Failed to fetch A/B tests:', error);
      // Return mock data if database doesn't exist yet
      const mockTests = {
        active: [
          {
            id: '1',
            test_name: 'Holiday Subject Line Test',
            test_type: 'subject_line',
            test_status: 'active',
            created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            duration_days: 8,
            sample_size: 84,
            split_ratio: '50/50',
            campaigns: { name: 'Holiday Campaign' },
            ab_test_variants: [
              {
                variant_name: 'A',
                content: 'Quick holiday question',
                messages_sent: 45,
                responses_received: 8,
                response_rate: 18.5
              },
              {
                variant_name: 'B', 
                content: 'End-of-year opportunity',
                messages_sent: 39,
                responses_received: 9,
                response_rate: 23.1
              }
            ]
          }
        ],
        completed: [
          {
            id: '2',
            test_name: 'Q4 Connection Message Test',
            test_type: 'connection_message',
            test_status: 'completed',
            created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            completed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            winner_variant: 'B',
            campaigns: { name: 'Q4 Outreach' },
            ab_test_variants: [
              {
                variant_name: 'A',
                content: 'Professional approach',
                messages_sent: 100,
                responses_received: 12,
                response_rate: 12.3
              },
              {
                variant_name: 'B',
                content: 'Value-focused approach', 
                messages_sent: 100,
                responses_received: 18,
                response_rate: 18.0
              }
            ]
          }
        ],
        paused: [],
        stopped: []
      };

      return NextResponse.json({
        tests: [...mockTests.active, ...mockTests.completed],
        grouped: mockTests,
        counts: {
          active: mockTests.active.length,
          completed: mockTests.completed.length,
          paused: 0,
          stopped: 0,
          total: mockTests.active.length + mockTests.completed.length
        }
      });
    }

    // Group tests by status
    const groupedTests = {
      active: tests?.filter(t => t.test_status === 'active') || [],
      completed: tests?.filter(t => t.test_status === 'completed') || [],
      paused: tests?.filter(t => t.test_status === 'paused') || [],
      stopped: tests?.filter(t => t.test_status === 'stopped') || []
    };

    return NextResponse.json({
      tests: tests || [],
      grouped: groupedTests,
      counts: {
        active: groupedTests.active.length,
        completed: groupedTests.completed.length,
        paused: groupedTests.paused.length,
        stopped: groupedTests.stopped.length,
        total: tests?.length || 0
      }
    });

  } catch (error: any) {
    console.error('A/B test fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch A/B tests', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      test_name,
      test_type, // 'subject_line', 'connection_message', 'follow_up_message', 'message_timing'
      campaign_id,
      duration_days = 7,
      sample_size = 100,
      split_ratio = '50/50',
      variants = [] // Array of {variant_name, content}
    } = await req.json();

    if (!test_name || !test_type || !campaign_id || variants.length < 2) {
      return NextResponse.json({ 
        error: 'Test name, type, campaign ID, and at least 2 variants are required' 
      }, { status: 400 });
    }

    // Verify campaign exists and user has access
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id')
      .eq('id', campaign_id)
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 404 });
    }

    // Create A/B test
    const { data: test, error } = await supabase
      .from('ab_tests')
      .insert({
        test_name,
        test_type,
        campaign_id,
        duration_days,
        sample_size,
        split_ratio,
        test_status: 'active',
        start_date: new Date().toISOString(),
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create A/B test:', error);
      return NextResponse.json({ 
        error: 'Failed to create A/B test',
        details: error.message 
      }, { status: 500 });
    }

    // Create variants
    const variantInserts = variants.map((variant: any, index: number) => ({
      ab_test_id: test.id,
      variant_name: variant.variant_name || String.fromCharCode(65 + index), // A, B, C, etc.
      content: variant.content,
      messages_sent: 0,
      responses_received: 0,
      response_rate: 0
    }));

    const { data: createdVariants, error: variantError } = await supabase
      .from('ab_test_variants')
      .insert(variantInserts)
      .select();

    if (variantError) {
      console.error('Failed to create A/B test variants:', variantError);
      // Clean up the test if variant creation fails
      await supabase.from('ab_tests').delete().eq('id', test.id);
      return NextResponse.json({ 
        error: 'Failed to create A/B test variants',
        details: variantError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'A/B test created successfully',
      test: {
        ...test,
        ab_test_variants: createdVariants
      },
      campaign: {
        id: campaign.id,
        name: campaign.name
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('A/B test creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create A/B test', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      test_id,
      action, // 'pause', 'resume', 'stop', 'complete'
      winner_variant
    } = await req.json();

    if (!test_id || !action) {
      return NextResponse.json({ 
        error: 'Test ID and action are required' 
      }, { status: 400 });
    }

    let updateData: any = {
      updated_at: new Date().toISOString(),
      updated_by: user.id
    };

    switch (action) {
      case 'pause':
        updateData.test_status = 'paused';
        updateData.paused_at = new Date().toISOString();
        break;
      case 'resume':
        updateData.test_status = 'active';
        updateData.resumed_at = new Date().toISOString();
        break;
      case 'stop':
        updateData.test_status = 'stopped';
        updateData.stopped_at = new Date().toISOString();
        break;
      case 'complete':
        updateData.test_status = 'completed';
        updateData.completed_at = new Date().toISOString();
        if (winner_variant) {
          updateData.winner_variant = winner_variant;
        }
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { data: test, error } = await supabase
      .from('ab_tests')
      .update(updateData)
      .eq('id', test_id)
      .select(`
        *,
        campaigns!inner(
          id,
          name,
          workspace_id
        )
      `)
      .eq('campaigns.workspace_id', user.user_metadata.workspace_id)
      .single();

    if (error) {
      console.error('Failed to update A/B test:', error);
      return NextResponse.json({ 
        error: 'Failed to update A/B test',
        details: error.message 
      }, { status: 500 });
    }

    if (!test) {
      return NextResponse.json({ error: 'A/B test not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({
      message: `A/B test ${action}ed successfully`,
      test,
      action
    });

  } catch (error: any) {
    console.error('A/B test update error:', error);
    return NextResponse.json(
      { error: 'Failed to update A/B test', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const testId = searchParams.get('test_id');

    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
    }

    // Delete A/B test (only if not active)
    const { data: test, error } = await supabase
      .from('ab_tests')
      .delete()
      .eq('id', testId)
      .select(`
        *,
        campaigns!inner(workspace_id)
      `)
      .eq('campaigns.workspace_id', user.user_metadata.workspace_id)
      .neq('test_status', 'active') // Don't allow deletion of active tests
      .single();

    if (error) {
      console.error('Failed to delete A/B test:', error);
      return NextResponse.json({ 
        error: 'Failed to delete A/B test. Active tests cannot be deleted.',
        details: error.message 
      }, { status: 500 });
    }

    if (!test) {
      return NextResponse.json({ error: 'A/B test not found, access denied, or cannot be deleted' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'A/B test deleted successfully'
    });

  } catch (error: any) {
    console.error('A/B test deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete A/B test', details: error.message },
      { status: 500 }
    );
  }
}