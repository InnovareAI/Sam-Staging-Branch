/**
 * Prospect Validation API
 * Validates prospects for campaign eligibility
 * Checks: required fields, previous contacts, duplicates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import {
  validateProspect,
  validateProspects,
  checkPreviousContact,
  type ProspectToValidate
} from '@/lib/prospect-validator';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prospects, check_previous_contact = true } = await request.json();

    if (!Array.isArray(prospects) || prospects.length === 0) {
      return NextResponse.json({
        error: 'Prospects array is required'
      }, { status: 400 });
    }

    // Validate each prospect
    const results = [];

    for (const prospect of prospects) {
      const validation = validateProspect(prospect);

      let previousContactInfo = {
        hasPreviousContact: false,
        previousStatus: undefined,
        previousCampaign: undefined,
        reason: undefined
      };

      // Check for previous contact if requested and prospect is valid
      if (check_previous_contact && validation.isValid) {
        previousContactInfo = await checkPreviousContact(
          supabase,
          prospect.contact_linkedin_url || prospect.linkedin_url,
          prospect.contact_email || prospect.email
        );

        // If previously contacted, mark as blocked
        if (previousContactInfo.hasPreviousContact) {
          validation.errors.push(previousContactInfo.reason || 'Previously contacted');
          validation.isValid = false;
          validation.severity = 'error';
        }
      }

      results.push({
        prospect_id: prospect.id,
        validation,
        previous_contact: previousContactInfo,
        can_add_to_campaign: validation.isValid && !previousContactInfo.hasPreviousContact
      });
    }

    // Summary
    const summary = {
      total: prospects.length,
      valid: results.filter(r => r.can_add_to_campaign).length,
      invalid: results.filter(r => !r.can_add_to_campaign).length,
      with_warnings: results.filter(r => r.validation.warnings.length > 0 && r.can_add_to_campaign).length,
      with_previous_contact: results.filter(r => r.previous_contact.hasPreviousContact).length
    };

    return NextResponse.json({
      success: true,
      results,
      summary
    });

  } catch (error) {
    console.error('Prospect validation error:', error);
    return NextResponse.json({
      error: 'Validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Validate existing campaign prospects
 * GET /api/prospects/validate?campaign_id=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaign_id');

    if (!campaignId) {
      return NextResponse.json({
        error: 'campaign_id parameter is required'
      }, { status: 400 });
    }

    // Get prospects for campaign
    const { data: prospects, error } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId);

    if (error) {
      return NextResponse.json({
        error: 'Failed to fetch prospects',
        details: error.message
      }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        summary: { total: 0, valid: 0, invalid: 0, with_warnings: 0 }
      });
    }

    // Validate each
    const results = [];

    for (const prospect of prospects) {
      const validation = validateProspect({
        id: prospect.id,
        contact_email: prospect.email,
        contact_linkedin_url: prospect.linkedin_url,
        contact_name: `${prospect.first_name} ${prospect.last_name}`,
        company_name: prospect.company_name,
        contact_title: prospect.title
      });

      const previousContactInfo = await checkPreviousContact(
        supabase,
        prospect.linkedin_url,
        prospect.email
      );

      // Update validation status in database
      const updateData: any = {
        validation_status: validation.isValid && !previousContactInfo.hasPreviousContact ? 'valid' : 'error',
        validation_errors: validation.errors,
        validation_warnings: validation.warnings,
        has_previous_contact: previousContactInfo.hasPreviousContact,
        previous_contact_status: previousContactInfo.previousStatus,
        validated_at: new Date().toISOString()
      };

      await supabase
        .from('campaign_prospects')
        .update(updateData)
        .eq('id', prospect.id);

      results.push({
        prospect_id: prospect.id,
        prospect_name: `${prospect.first_name} ${prospect.last_name}`,
        validation,
        previous_contact: previousContactInfo,
        can_add_to_campaign: validation.isValid && !previousContactInfo.hasPreviousContact
      });
    }

    const summary = {
      total: prospects.length,
      valid: results.filter(r => r.can_add_to_campaign).length,
      invalid: results.filter(r => !r.can_add_to_campaign).length,
      with_warnings: results.filter(r => r.validation.warnings.length > 0 && r.can_add_to_campaign).length
    };

    return NextResponse.json({
      success: true,
      results,
      summary
    });

  } catch (error) {
    console.error('Campaign prospects validation error:', error);
    return NextResponse.json({
      error: 'Validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
