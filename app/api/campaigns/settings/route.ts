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
    const scope = searchParams.get('scope') || 'workspace'; // 'workspace', 'user', 'campaign'
    const campaignId = searchParams.get('campaign_id');

    // Get campaign settings
    let query = supabase
      .from('campaign_settings')
      .select('*')
      .eq('workspace_id', user.user_metadata.workspace_id);

    // Filter by scope
    if (scope === 'user') {
      query = query.eq('user_id', user.id).is('campaign_id', null);
    } else if (scope === 'campaign' && campaignId) {
      query = query.eq('campaign_id', campaignId);
    } else {
      // workspace level settings
      query = query.is('user_id', null).is('campaign_id', null);
    }

    const { data: settings, error } = await query.maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Failed to fetch campaign settings:', error);
      // Return default settings if database doesn't exist yet
      const defaultSettings = {
        // Default Message Settings
        connection_request_delay: '1-3 hours',
        follow_up_delay: '2-3 days',
        max_messages_per_day: 20,
        
        // Timing Optimization
        preferred_send_times: ['9-11 AM', '1-3 PM'],
        active_days: ['Monday-Friday'],
        timezone: 'ET (Eastern Time)',
        
        // Personalization
        auto_insert_company_name: true,
        use_job_title: true,
        include_industry_insights: false,
        reference_mutual_connections: false,
        
        // Safety & Compliance
        daily_connection_limit: 100,
        respect_do_not_contact: true,
        auto_pause_high_rejection: true,
        require_message_approval: false,
        
        // Metadata
        scope: scope,
        campaign_id: campaignId,
        workspace_id: user.user_metadata.workspace_id,
        user_id: scope === 'user' ? user.id : null
      };

      return NextResponse.json({
        settings: defaultSettings,
        is_default: true
      });
    }

    return NextResponse.json({
      settings: settings || null,
      is_default: false
    });

  } catch (error: any) {
    console.error('Campaign settings fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign settings', details: error.message },
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
      scope = 'workspace', // 'workspace', 'user', 'campaign'
      campaign_id,
      
      // Default Message Settings
      connection_request_delay = '1-3 hours',
      follow_up_delay = '2-3 days',
      max_messages_per_day = 20,
      
      // Timing Optimization
      preferred_send_times = ['9-11 AM', '1-3 PM'],
      active_days = ['Monday-Friday'],
      timezone = 'ET (Eastern Time)',
      
      // Personalization
      auto_insert_company_name = true,
      use_job_title = true,
      include_industry_insights = false,
      reference_mutual_connections = false,
      
      // Safety & Compliance
      daily_connection_limit = 100,
      respect_do_not_contact = true,
      auto_pause_high_rejection = true,
      require_message_approval = false
    } = await req.json();

    if (scope === 'campaign' && !campaign_id) {
      return NextResponse.json({ 
        error: 'Campaign ID is required for campaign-specific settings' 
      }, { status: 400 });
    }

    // Verify campaign exists if provided
    if (campaign_id) {
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, workspace_id')
        .eq('id', campaign_id)
        .eq('workspace_id', user.user_metadata.workspace_id)
        .single();

      if (campaignError || !campaign) {
        return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 404 });
      }
    }

    // Create or update settings
    const settingsData = {
      workspace_id: user.user_metadata.workspace_id,
      user_id: scope === 'user' ? user.id : null,
      campaign_id: scope === 'campaign' ? campaign_id : null,
      
      // Default Message Settings
      connection_request_delay,
      follow_up_delay,
      max_messages_per_day,
      
      // Timing Optimization
      preferred_send_times,
      active_days,
      timezone,
      
      // Personalization
      auto_insert_company_name,
      use_job_title,
      include_industry_insights,
      reference_mutual_connections,
      
      // Safety & Compliance
      daily_connection_limit,
      respect_do_not_contact,
      auto_pause_high_rejection,
      require_message_approval,
      
      // Metadata
      scope,
      created_by: user.id,
      updated_by: user.id
    };

    const { data: settings, error } = await supabase
      .from('campaign_settings')
      .upsert(settingsData, {
        onConflict: 'workspace_id,user_id,campaign_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save campaign settings:', error);
      return NextResponse.json({ 
        error: 'Failed to save campaign settings',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Campaign settings saved successfully',
      settings
    }, { status: 201 });

  } catch (error: any) {
    console.error('Campaign settings creation error:', error);
    return NextResponse.json(
      { error: 'Failed to save campaign settings', details: error.message },
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
      settings_id,
      ...updateData
    } = await req.json();

    if (!settings_id) {
      return NextResponse.json({ 
        error: 'Settings ID is required for updates' 
      }, { status: 400 });
    }

    // Update settings
    const { data: settings, error } = await supabase
      .from('campaign_settings')
      .update({
        ...updateData,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', settings_id)
      .eq('workspace_id', user.user_metadata.workspace_id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update campaign settings:', error);
      return NextResponse.json({ 
        error: 'Failed to update campaign settings',
        details: error.message 
      }, { status: 500 });
    }

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Campaign settings updated successfully',
      settings
    });

  } catch (error: any) {
    console.error('Campaign settings update error:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign settings', details: error.message },
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
    const settingsId = searchParams.get('settings_id');

    if (!settingsId) {
      return NextResponse.json({ error: 'Settings ID is required' }, { status: 400 });
    }

    // Delete settings (this will revert to parent scope or defaults)
    const { data: settings, error } = await supabase
      .from('campaign_settings')
      .delete()
      .eq('id', settingsId)
      .eq('workspace_id', user.user_metadata.workspace_id)
      .select()
      .single();

    if (error) {
      console.error('Failed to delete campaign settings:', error);
      return NextResponse.json({ 
        error: 'Failed to delete campaign settings',
        details: error.message 
      }, { status: 500 });
    }

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Campaign settings deleted successfully (reverted to defaults)'
    });

  } catch (error: any) {
    console.error('Campaign settings deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete campaign settings', details: error.message },
      { status: 500 }
    );
  }
}