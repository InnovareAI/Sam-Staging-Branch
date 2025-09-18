import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      source_campaign_id,
      new_name,
      new_description,
      clone_prospects = true,
      clone_templates = true,
      clone_settings = true
    } = await req.json();

    if (!source_campaign_id || !new_name) {
      return NextResponse.json({ 
        error: 'Source campaign ID and new campaign name are required' 
      }, { status: 400 });
    }

    // Get source campaign details
    const { data: sourceCampaign, error: sourceError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', source_campaign_id)
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    if (sourceError || !sourceCampaign) {
      return NextResponse.json({ 
        error: 'Source campaign not found or access denied' 
      }, { status: 404 });
    }

    // Create cloned campaign
    const clonedCampaignData = {
      workspace_id: sourceCampaign.workspace_id,
      name: new_name,
      description: new_description || `Clone of ${sourceCampaign.name}`,
      campaign_type: sourceCampaign.campaign_type,
      target_icp: clone_settings ? sourceCampaign.target_icp : {},
      message_templates: clone_templates ? sourceCampaign.message_templates : {},
      settings: clone_settings ? sourceCampaign.settings : {},
      status: 'draft',
      created_by: user.id
    };

    const { data: newCampaignId, error: createError } = await supabase
      .rpc('create_campaign', {
        p_workspace_id: clonedCampaignData.workspace_id,
        p_name: clonedCampaignData.name,
        p_description: clonedCampaignData.description,
        p_campaign_type: clonedCampaignData.campaign_type,
        p_target_icp: clonedCampaignData.target_icp,
        p_ab_test_variant: sourceCampaign.ab_test_variant,
        p_message_templates: clonedCampaignData.message_templates
      });

    if (createError) {
      console.error('Failed to create cloned campaign:', createError);
      return NextResponse.json({ 
        error: 'Failed to create cloned campaign',
        details: createError.message 
      }, { status: 500 });
    }

    // Clone prospects if requested
    let clonedProspectsCount = 0;
    if (clone_prospects) {
      try {
        const { data: sourceProspects, error: prospectsError } = await supabase
          .from('campaign_prospects')
          .select('prospect_id, status, notes')
          .eq('campaign_id', source_campaign_id);

        if (!prospectsError && sourceProspects && sourceProspects.length > 0) {
          const prospectIds = sourceProspects.map(p => p.prospect_id);
          
          const { data: addResults, error: addError } = await supabase
            .rpc('add_prospects_to_campaign', {
              p_campaign_id: newCampaignId,
              p_prospect_ids: prospectIds
            });

          if (!addError) {
            clonedProspectsCount = prospectIds.length;
          }
        }
      } catch (error) {
        console.error('Error cloning prospects:', error);
        // Don't fail the entire operation if prospect cloning fails
      }
    }

    // Get the created campaign with details
    const { data: clonedCampaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', newCampaignId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch cloned campaign:', fetchError);
      return NextResponse.json({ 
        error: 'Campaign cloned but failed to fetch details',
        campaign_id: newCampaignId 
      }, { status: 201 });
    }

    return NextResponse.json({ 
      message: 'Campaign cloned successfully',
      cloned_campaign: clonedCampaign,
      source_campaign: {
        id: sourceCampaign.id,
        name: sourceCampaign.name
      },
      clone_summary: {
        prospects_cloned: clonedProspectsCount,
        templates_cloned: clone_templates,
        settings_cloned: clone_settings
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Campaign cloning error:', error);
    return NextResponse.json(
      { error: 'Failed to clone campaign', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      message: 'Campaign Cloning API',
      endpoints: {
        clone: 'POST /api/campaigns/clone',
        required_fields: [
          'source_campaign_id (string)',
          'new_name (string)'
        ],
        optional_fields: [
          'new_description (string)',
          'clone_prospects (boolean) - default: true',
          'clone_templates (boolean) - default: true', 
          'clone_settings (boolean) - default: true'
        ]
      },
      features: [
        'Clone campaign structure and settings',
        'Optionally clone prospects to new campaign',
        'Optionally clone message templates',
        'Optionally clone campaign settings',
        'Workspace isolation and access control'
      ]
    });

  } catch (error: any) {
    console.error('Campaign cloning GET error:', error);
    return NextResponse.json(
      { error: 'Request failed', details: error.message },
      { status: 500 }
    );
  }
}