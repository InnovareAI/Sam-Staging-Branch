#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔍 CAMPAIGN ERROR ANALYSIS\n');
console.log('='.repeat(80));

async function analyzeCampaignErrors() {
  // Get campaigns with failed sends
  const { data: allCampaigns } = await supabase
    .from('campaigns')
    .select('id, campaign_name, linkedin_account_id, workspace_id')
    .not('linkedin_account_id', 'is', null);

  console.log(`\nAnalyzing ${allCampaigns?.length || 0} campaigns...\n`);

  const problemCampaigns = [];

  for (const campaign of allCampaigns || []) {
    // Get queue stats
    const { data: queueItems } = await supabase
      .from('send_queue')
      .select('status, error_message')
      .eq('campaign_id', campaign.id);

    if (!queueItems || queueItems.length === 0) continue;

    const stats = {};
    const errorTypes = {};

    queueItems.forEach(item => {
      stats[item.status] = (stats[item.status] || 0) + 1;

      if (item.status === 'failed' && item.error_message) {
        // Categorize error
        let errorType = 'Unknown';

        if (item.error_message.includes('already_invited_recently')) {
          errorType = 'Already invited recently';
        } else if (item.error_message.includes('cannot_resend_yet')) {
          errorType = 'Rate limit - cannot resend yet';
        } else if (item.error_message.includes('Cannot POST /api/v1/messages/send')) {
          errorType = 'Unipile API endpoint error (404)';
        } else if (item.error_message.includes('feature_not_subscribed')) {
          errorType = 'LinkedIn feature not subscribed';
        } else if (item.error_message.includes('invalid_account')) {
          errorType = 'Invalid account type';
        } else if (item.error_message.includes('Invalid parameters')) {
          errorType = 'Invalid user ID';
        } else {
          errorType = item.error_message.substring(0, 60);
        }

        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      }
    });

    const total = queueItems.length;
    const failed = stats['failed'] || 0;
    const errorRate = (failed / total * 100).toFixed(1);

    // Include campaigns with >10 failures or >20% error rate
    if (failed > 10 || parseFloat(errorRate) > 20) {
      problemCampaigns.push({
        id: campaign.id,
        name: campaign.campaign_name || 'Unnamed Campaign',
        linkedin_account_id: campaign.linkedin_account_id,
        workspace_id: campaign.workspace_id,
        total,
        failed,
        errorRate: parseFloat(errorRate),
        stats,
        errorTypes
      });
    }
  }

  // Sort by error rate
  problemCampaigns.sort((a, b) => b.errorRate - a.errorRate);

  console.log(`Found ${problemCampaigns.length} campaigns with significant errors\n`);
  console.log('='.repeat(80));

  for (const campaign of problemCampaigns) {
    console.log(`\n📊 ${campaign.name}`);
    console.log(`   Campaign ID: ${campaign.id}`);
    console.log(`   LinkedIn Account: ${campaign.linkedin_account_id}`);
    console.log(`   Error Rate: ${campaign.errorRate}% (${campaign.failed}/${campaign.total})`);

    // Status breakdown
    console.log(`\n   Status Breakdown:`);
    Object.entries(campaign.stats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        const pct = (count / campaign.total * 100).toFixed(1);
        const icon = status === 'failed' ? '❌' : status === 'sent' ? '✅' : '⏳';
        console.log(`     ${icon} ${status}: ${count} (${pct}%)`);
      });

    // Error types
    if (Object.keys(campaign.errorTypes).length > 0) {
      console.log(`\n   Error Types:`);
      Object.entries(campaign.errorTypes)
        .sort((a, b) => b[1] - a[1])
        .forEach(([errorType, count]) => {
          console.log(`     • ${errorType}: ${count}x`);
        });
    }

    console.log('');
    console.log('-'.repeat(80));
  }

  return problemCampaigns;
}

async function getAccountDetails(problemCampaigns) {
  console.log('\n\n👤 LINKEDIN ACCOUNT DETAILS\n');
  console.log('='.repeat(80));

  // Get unique account IDs
  const accountIds = [...new Set(problemCampaigns.map(c => c.linkedin_account_id))];

  for (const accountId of accountIds) {
    const { data: account } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (account) {
      console.log(`\n📧 ${account.display_name || account.email}`);
      console.log(`   Account ID: ${account.id}`);
      console.log(`   Provider: ${account.provider}`);
      console.log(`   Status: ${account.status || 'unknown'}`);
      console.log(`   Unipile Account ID: ${account.unipile_account_id || 'N/A'}`);

      // Find campaigns using this account
      const accountCampaigns = problemCampaigns.filter(c => c.linkedin_account_id === accountId);
      console.log(`   Campaigns with errors: ${accountCampaigns.length}`);

      accountCampaigns.forEach(c => {
        console.log(`     - ${c.name} (${c.errorRate}% error rate)`);
      });
    } else {
      console.log(`\n⚠️  Account ${accountId} not found in user_unipile_accounts`);
    }
  }
}

async function generateRecommendations(problemCampaigns) {
  console.log('\n\n💡 RECOMMENDATIONS\n');
  console.log('='.repeat(80));

  // Categorize errors
  const recommendations = new Map();

  problemCampaigns.forEach(campaign => {
    Object.entries(campaign.errorTypes).forEach(([errorType, count]) => {
      if (errorType.includes('Already invited recently')) {
        recommendations.set('already_invited', {
          severity: 'LOW',
          issue: 'Already invited recently',
          description: 'LinkedIn is preventing re-invitations to users who were recently invited.',
          action: 'This is NORMAL behavior. LinkedIn enforces a cooldown period. No action needed.',
          affectedCampaigns: (recommendations.get('already_invited')?.affectedCampaigns || 0) + 1
        });
      } else if (errorType.includes('Rate limit')) {
        recommendations.set('rate_limit', {
          severity: 'LOW',
          issue: 'Rate limiting',
          description: 'LinkedIn or Unipile is rate limiting the account.',
          action: 'System should auto-retry after cooldown. Monitor if errors persist.',
          affectedCampaigns: (recommendations.get('rate_limit')?.affectedCampaigns || 0) + 1
        });
      } else if (errorType.includes('Unipile API endpoint error')) {
        recommendations.set('unipile_404', {
          severity: 'HIGH',
          issue: 'Unipile API endpoint error (404)',
          description: 'The Unipile API endpoint is returning 404 errors.',
          action: 'URGENT: Verify Unipile DSN and API endpoint. Check if Unipile API has changed.',
          affectedCampaigns: (recommendations.get('unipile_404')?.affectedCampaigns || 0) + 1
        });
      } else if (errorType.includes('feature_not_subscribed')) {
        recommendations.set('feature_not_subscribed', {
          severity: 'MEDIUM',
          issue: 'LinkedIn feature not subscribed',
          description: 'The LinkedIn account doesn\'t have access to required features (e.g., InMail).',
          action: 'User needs to upgrade LinkedIn account or stop using premium features.',
          affectedCampaigns: (recommendations.get('feature_not_subscribed')?.affectedCampaigns || 0) + 1
        });
      } else if (errorType.includes('Invalid account type')) {
        recommendations.set('invalid_account', {
          severity: 'HIGH',
          issue: 'Invalid account type',
          description: 'Campaign is trying to use wrong account type (e.g., email for LinkedIn).',
          action: 'URGENT: Fix campaign configuration. Ensure LinkedIn campaigns use LinkedIn accounts.',
          affectedCampaigns: (recommendations.get('invalid_account')?.affectedCampaigns || 0) + 1
        });
      } else if (errorType.includes('Invalid user ID')) {
        recommendations.set('invalid_user_id', {
          severity: 'MEDIUM',
          issue: 'Invalid LinkedIn user ID',
          description: 'Prospect has invalid or non-existent LinkedIn profile ID.',
          action: 'Clean up prospect data. Validate LinkedIn URLs before adding to campaigns.',
          affectedCampaigns: (recommendations.get('invalid_user_id')?.affectedCampaigns || 0) + 1
        });
      }
    });
  });

  // Display recommendations by severity
  const severityOrder = { HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedRecommendations = Array.from(recommendations.values())
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  sortedRecommendations.forEach(rec => {
    const severityIcon = rec.severity === 'HIGH' ? '🔴' : rec.severity === 'MEDIUM' ? '🟡' : '🟢';
    console.log(`\n${severityIcon} ${rec.severity}: ${rec.issue}`);
    console.log(`   ${rec.description}`);
    console.log(`   Action: ${rec.action}`);
    console.log(`   Campaigns affected: ${rec.affectedCampaigns}`);
  });
}

async function main() {
  try {
    const problemCampaigns = await analyzeCampaignErrors();
    await getAccountDetails(problemCampaigns);
    await generateRecommendations(problemCampaigns);

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Analysis complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
