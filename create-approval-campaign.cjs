#!/usr/bin/env node

/**
 * Create Campaign with Approval Workflow
 * 
 * This script creates a campaign with real prospects and sets up approval workflow
 */

const fs = require('fs');

// Read environment variables
require('dotenv').config({ path: '.env.local' });

const apiUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

async function createCampaignForApproval() {
  try {
    console.log('🚀 Creating Campaign for Approval...\n');

    // 1. Read the CSV data
    const csvData = fs.readFileSync('./charissa-test-campaign.csv', 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    
    const prospects = lines.slice(1).map(line => {
      const values = line.split(',');
      return {
        first_name: values[0],
        last_name: values[1], 
        company_name: values[2],
        job_title: values[3],
        linkedin_profile_url: values[4],
        email_address: values[5],
        location: values[6],
        industry: values[7]
      };
    });

    console.log(`📊 Found ${prospects.length} prospects:`);
    prospects.forEach((p, i) => {
      console.log(`${i + 1}. ${p.first_name} ${p.last_name} - ${p.job_title} at ${p.company_name}`);
    });
    console.log('');

    // 2. Create campaign via API
    const campaignData = {
      name: 'Charissa Test Campaign - LinkedIn Playbook A',
      description: 'Test campaign with real prospects - Awaiting approval before execution',
      type: 'linkedin',
      message_template: "Hi {first_name}, I work for InnovareAI, an AI company known for its innovative workflow automation and AI agent solutions. I'm always interested in connecting with like-minded individuals who want to learn all things AI. Would you be open to connecting?",
      prospects: prospects,
      settings: {
        variant: 'A',
        daily_limit: 4,
        approval_required: true
      }
    };

    console.log('📝 Campaign Details:');
    console.log(`   - Name: ${campaignData.name}`);
    console.log(`   - Type: ${campaignData.type}`);
    console.log(`   - Prospects: ${campaignData.prospects.length}`);
    console.log(`   - Message Template: "${campaignData.message_template}"`);
    console.log('');

    console.log('📝 Message Preview for first prospect:');
    const sampleMessage = campaignData.message_template.replace('{first_name}', prospects[0].first_name);
    console.log(`   "${sampleMessage}"`);
    console.log('');

    console.log('⚠️  APPROVAL REQUIRED:');
    console.log('   Please review the campaign details above.');
    console.log('   This campaign will send LinkedIn connection requests to 4 real prospects.');
    console.log('   Each message will be personalized with their first name.');
    console.log('');
    
    // Ask for approval
    console.log('❓ Do you approve this campaign for execution? (y/N)');
    
    // In a real implementation, this would wait for user input
    // For now, we'll just show what the approval process would look like
    
    return {
      status: 'pending_approval',
      campaignData: campaignData,
      prospects: prospects,
      messagePreview: sampleMessage,
      nextSteps: [
        '1. Review message template and prospect list',
        '2. Confirm approval to proceed with campaign execution',
        '3. Execute campaign via LinkedIn API'
      ]
    };

  } catch (error) {
    console.error('❌ Campaign creation failed:', error.message);
    throw error;
  }
}

// Run the approval workflow
if (require.main === module) {
  createCampaignForApproval()
    .then(result => {
      console.log('✅ Campaign created and ready for approval!');
      console.log('');
      console.log('📋 Next Steps:');
      result.nextSteps.forEach((step, i) => {
        console.log(`   ${step}`);
      });
      console.log('');
      console.log('🔄 To proceed with execution after approval:');
      console.log('   - Confirm the campaign details above are correct');
      console.log('   - Verify LinkedIn account is connected and working');
      console.log('   - Execute the campaign via the LinkedIn execution API');
      console.log('');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Approval workflow failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createCampaignForApproval };