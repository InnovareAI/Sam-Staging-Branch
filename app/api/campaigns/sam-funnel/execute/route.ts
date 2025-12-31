import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import {
  SAM_FUNNEL_TEMPLATES,
  getSamFunnelTemplateById,
  calculateWeekdaySchedule,
  populateSamFunnelTemplate,
  SECOND_CTA_TEST_VARIATIONS
} from '@/lib/sam-funnel-templates';

export async function POST(request: NextRequest) {
  try {
    // Firebase authentication
    const { userId, workspaceId } = await verifyAuth(request);

    const body = await request.json();
    const {
      campaign_id,
      template_id,
      prospects,
      start_date,
      personalization_data = {},
      client_messaging = null
    } = body;

    if (!campaign_id || !template_id || !prospects || prospects.length === 0) {
      return NextResponse.json({
        error: 'Missing required fields: campaign_id, template_id, prospects'
      }, { status: 400 });
    }

    // Get Sam Funnel template
    const template = getSamFunnelTemplateById(template_id);
    if (!template) {
      return NextResponse.json({
        error: `Sam Funnel template not found: ${template_id}`
      }, { status: 404 });
    }

    // Validate workspace access to the campaign
    const campaignResult = await pool.query(
      'SELECT workspace_id FROM campaigns WHERE id = $1',
      [campaign_id]
    );

    if (campaignResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Campaign not found or access denied'
      }, { status: 404 });
    }

    const campaignWorkspaceId = campaignResult.rows[0].workspace_id;

    // Verify user has access to this campaign's workspace
    if (campaignWorkspaceId !== workspaceId) {
      return NextResponse.json({
        error: 'Campaign not found or access denied'
      }, { status: 404 });
    }

    // Calculate weekday schedule
    const campaignStartDate = start_date ? new Date(start_date) : new Date();
    const messageSchedule = calculateWeekdaySchedule(campaignStartDate);

    // Create Sam Funnel execution record
    const executionResult = await pool.query(
      `INSERT INTO sam_funnel_executions
        (campaign_id, template_id, workspace_id, execution_type, status, prospects_total,
         start_date, estimated_completion_date, schedule, personalization_data, client_messaging, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        campaign_id,
        template_id,
        workspaceId,
        'sam_funnel',
        'pending',
        prospects.length,
        campaignStartDate.toISOString(),
        addWeekdays(campaignStartDate, 25).toISOString(), // 4 weeks
        JSON.stringify(messageSchedule),
        JSON.stringify(personalization_data),
        client_messaging ? JSON.stringify(client_messaging) : null,
        userId
      ]
    );

    if (executionResult.rows.length === 0) {
      console.error('Failed to create Sam Funnel execution');
      return NextResponse.json({
        error: 'Failed to create execution record'
      }, { status: 500 });
    }

    const execution = executionResult.rows[0];

    // Process prospects and create scheduled messages
    const scheduledMessages = [];
    const prospectUpdates = [];

    for (const prospect of prospects) {
      // A/B test assignment for 2nd CTA
      const ctaVariation = assignCTAVariation();

      // Create messages for each step
      for (const step of template.steps) {
        const scheduledDate = calculateStepScheduleDate(campaignStartDate, step.day_offset);

        // Populate message template with prospect data
        const personalizedMessage = populateSamFunnelTemplate(
          step.message_template,
          {
            ...prospect,
            ...personalization_data,
            ...(step.step_number === 5 ? { cta_variation: ctaVariation.message_template } : {})
          }
        );

        const messageData = {
          execution_id: execution.id,
          campaign_id,
          prospect_id: prospect.id,
          step_number: step.step_number,
          step_type: step.step_type,
          scheduled_date: scheduledDate.toISOString(),
          message_template: personalizedMessage,
          subject: step.subject ? populateSamFunnelTemplate(step.subject, { ...prospect, ...personalization_data }) : null,
          mandatory_element: step.mandatory_element,
          cta_variation: step.step_number === 5 ? ctaVariation.id : null,
          conditions: step.conditions,
          status: 'scheduled',
          week_number: step.week,
          weekday: step.weekday
        };

        scheduledMessages.push(messageData);
      }

      // Update prospect status
      prospectUpdates.push({
        id: prospect.id,
        status: 'sam_funnel_scheduled',
        sam_funnel_execution_id: execution.id,
        assigned_cta_variation: ctaVariation.id
      });
    }

    // Insert scheduled messages
    for (const msg of scheduledMessages) {
      await pool.query(
        `INSERT INTO sam_funnel_messages
          (execution_id, campaign_id, prospect_id, step_number, step_type, scheduled_date,
           message_template, subject, mandatory_element, cta_variation, conditions, status, week_number, weekday)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          msg.execution_id, msg.campaign_id, msg.prospect_id, msg.step_number, msg.step_type,
          msg.scheduled_date, msg.message_template, msg.subject, msg.mandatory_element,
          msg.cta_variation, JSON.stringify(msg.conditions), msg.status, msg.week_number, msg.weekday
        ]
      );
    }

    // Update prospects
    for (const prospectUpdate of prospectUpdates) {
      await pool.query(
        `UPDATE campaign_prospects
         SET status = $1, sam_funnel_execution_id = $2, assigned_cta_variation = $3
         WHERE id = $4`,
        [prospectUpdate.status, prospectUpdate.sam_funnel_execution_id, prospectUpdate.assigned_cta_variation, prospectUpdate.id]
      );
    }

    // Start execution (trigger N8N workflow)
    await triggerN8NSamFunnel(execution, template, scheduledMessages);

    return NextResponse.json({
      success: true,
      execution_id: execution.id,
      template_name: template.name,
      prospects_scheduled: prospects.length,
      total_messages: scheduledMessages.length,
      start_date: campaignStartDate.toISOString(),
      estimated_completion: addWeekdays(campaignStartDate, 25).toISOString(),
      schedule_breakdown: {
        week_1: scheduledMessages.filter(m => m.week_number === 1).length,
        week_2: scheduledMessages.filter(m => m.week_number === 2).length,
        week_3: scheduledMessages.filter(m => m.week_number === 3).length,
        week_4: scheduledMessages.filter(m => m.week_number === 4).length
      },
      cta_test_distribution: getCTATestDistribution(prospects.length)
    });

  } catch (error) {
    // Handle AuthError
    if (error && typeof error === 'object' && 'code' in error && 'statusCode' in error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Sam Funnel execution error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Helper function to add weekdays only
function addWeekdays(startDate: Date, weekdaysToAdd: number): Date {
  let currentDate = new Date(startDate);
  let addedWeekdays = 0;

  while (addedWeekdays < weekdaysToAdd) {
    currentDate.setDate(currentDate.getDate() + 1);
    // Check if it's a weekday (Monday = 1, Friday = 5)
    if (currentDate.getDay() >= 1 && currentDate.getDay() <= 5) {
      addedWeekdays++;
    }
  }

  return currentDate;
}

// Helper function to calculate specific step schedule date
function calculateStepScheduleDate(startDate: Date, dayOffset: number): Date {
  return addWeekdays(startDate, dayOffset - 1); // dayOffset is 1-based
}

// Helper function to assign A/B test variation for 2nd CTA
function assignCTAVariation() {
  const random = Math.random();
  let cumulativeAllocation = 0;

  for (const variation of SECOND_CTA_TEST_VARIATIONS) {
    cumulativeAllocation += variation.traffic_allocation;
    if (random <= cumulativeAllocation) {
      return variation;
    }
  }

  // Fallback to first variation
  return SECOND_CTA_TEST_VARIATIONS[0];
}

// Helper function to get CTA test distribution
function getCTATestDistribution(totalProspects: number) {
  return SECOND_CTA_TEST_VARIATIONS.map(variation => ({
    variation_id: variation.id,
    variation_name: variation.name,
    allocated_prospects: Math.round(totalProspects * variation.traffic_allocation),
    percentage: Math.round(variation.traffic_allocation * 100)
  }));
}

// Helper function to trigger N8N Sam Funnel workflow
async function triggerN8NSamFunnel(execution: any, template: any, messages: any[]) {
  try {
    const n8nEndpoint = process.env.N8N_SAM_FUNNEL_ENDPOINT || 'https://workflows.innovareai.com/webhook/sam-funnel-execution';

    const payload = {
      execution_id: execution.id,
      campaign_id: execution.campaign_id,
      template_id: template.id,
      template_type: template.type,
      workspace_id: execution.workspace_id,
      prospects_total: execution.prospects_total,
      start_date: execution.start_date,
      messages: messages.map(msg => ({
        id: msg.id,
        prospect_id: msg.prospect_id,
        step_number: msg.step_number,
        scheduled_date: msg.scheduled_date,
        message_template: msg.message_template,
        mandatory_element: msg.mandatory_element,
        cta_variation: msg.cta_variation
      })),
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/sam-funnel/status-update`
    };

    const response = await fetch(n8nEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.N8N_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`N8N trigger failed: ${response.status} ${response.statusText}`);
    }

    console.log('N8N Sam Funnel workflow triggered successfully');
  } catch (error) {
    console.error('Failed to trigger N8N Sam Funnel workflow:', error);
    // Don't fail the main execution - N8N trigger is supplementary
  }
}
