import { pool } from '@/lib/db';
import { reachInboxService } from '../reachinbox';

export class ReachInboxSyncService {
    /**
     * Main sync entry point: Poll ReachInbox for activity and update Supabase
     */
    async syncAllWorkspaces() {
        console.log('📧 Starting ReachInbox global sync (Stats Only)...');

        // Get all campaigns with reachinbox_campaign_id
        const { data: campaigns, error } = await supabase
            .from('campaigns')
            .select('id, workspace_id, reachinbox_campaign_id, name')
            .not('reachinbox_campaign_id', 'is', null);

        if (error) {
            console.error('❌ Error fetching ReachInbox campaigns:', error);
            return;
        }

        console.log(`📊 Found ${campaigns?.length || 0} ReachInbox campaigns to sync stats`);

        for (const campaign of campaigns || []) {
            await this.syncCampaignStats(campaign);
        }
    }

    /**
     * Sync aggregate stats for a specific campaign from ReachInbox
     */
    async syncCampaignStats(campaign: { id: string, workspace_id: string, reachinbox_campaign_id: string, name: string }) {
        try {
            console.log(`\n🔍 Syncing ReachInbox stats: ${campaign.name} (${campaign.reachinbox_campaign_id})`);

            // Update Campaign Stats in Supabase
            const stats = await reachInboxService.getCampaignStats(campaign.reachinbox_campaign_id);
            if (stats) {
                await supabase
                    .from('campaigns')
                    .update({
                        total_emails_sent: stats.sent || 0,
                        total_emails_opened: stats.opens || 0,
                        total_emails_replied: stats.replies || 0,
                        total_emails_bounced: stats.bounces || 0,
                        total_link_clicked: stats.clicks || 0,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', campaign.id);

                console.log(`   ✅ Stats updated: ${stats.sent} sent, ${stats.replies} replies`);
            }
        } catch (error) {
            console.error(`❌ Error syncing stats for campaign ${campaign.id}:`, error);
        }
    }
}

export const reachInboxSyncService = new ReachInboxSyncService();
