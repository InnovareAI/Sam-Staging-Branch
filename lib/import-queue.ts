/**
 * Background Queue for LinkedIn Import Data Persistence
 *
 * Handles asynchronous saving of imported prospects to Supabase
 * while allowing the frontend to display data immediately.
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface QueueItem {
  sessionId: string;
  prospects: any[];
  batchNumber: number;
  retries: number;
}

class ImportQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  /**
   * Add a batch of prospects to the save queue
   */
  async add(sessionId: string, prospects: any[], batchNumber: number): Promise<void> {
    console.log(`📥 Queuing batch ${batchNumber} for session ${sessionId} (${prospects.length} prospects)`);

    this.queue.push({
      sessionId,
      prospects,
      batchNumber,
      retries: 0
    });

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process the queue in background
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    console.log('🔄 Starting queue processing...');

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      try {
        await this.saveBatch(item);
        console.log(`✅ Saved batch ${item.batchNumber} for session ${item.sessionId}`);
      } catch (error) {
        console.error(`❌ Failed to save batch ${item.batchNumber}:`, error);

        // Retry logic
        if (item.retries < this.MAX_RETRIES) {
          console.log(`🔄 Retrying batch ${item.batchNumber} (attempt ${item.retries + 1}/${this.MAX_RETRIES})`);
          item.retries++;
          this.queue.push(item); // Re-add to queue

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        } else {
          console.error(`❌ Max retries reached for batch ${item.batchNumber}. Data may be lost.`);
          // TODO: Alert admin or log to error tracking service
        }
      }
    }

    this.processing = false;
    console.log('✅ Queue processing complete');
  }

  /**
   * Save a single batch to Supabase
   */
  private async saveBatch(item: QueueItem): Promise<void> {
    const { sessionId, prospects } = item;

    // Transform prospects to database format
    const approvalProspects = prospects.map((prospect: any) => {
      const linkedinUrl = prospect.profile_url || prospect.public_profile_url || '';
      const prospectId = linkedinUrl.split('/').filter(Boolean).pop() || uuidv4();

      return {
        id: uuidv4(),
        session_id: sessionId,
        prospect_id: prospectId,
        name: prospect.name || `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim() || 'Unknown',
        title: prospect.headline || prospect.current_positions?.[0]?.role || 'Unknown',
        location: prospect.location || prospect.geo_region,
        profile_image: prospect.profile_picture_url,
        recent_activity: prospect.summary || null,
        company: {
          name: prospect.current_positions?.[0]?.company || 'Unknown',
          industry: null,
          size: null
        },
        contact: {
          linkedin_url: linkedinUrl,
          email: prospect.email || null,
          phone: prospect.phone || null
        },
        connection_degree: prospect.connection_degree || 0,
        enrichment_score: 0,
        source: 'unipile_linkedin_search',
        created_at: new Date().toISOString()
      };
    });

    // Insert prospects
    const { error: insertError } = await supabase
      .from('prospect_approval_data')
      .insert(approvalProspects);

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    // Update session counts
    const { data: currentSession } = await supabase
      .from('prospect_approval_sessions')
      .select('total_prospects, pending_count')
      .eq('id', sessionId)
      .single();

    if (currentSession) {
      const newTotal = (currentSession.total_prospects || 0) + prospects.length;
      const newPending = (currentSession.pending_count || 0) + prospects.length;

      await supabase
        .from('prospect_approval_sessions')
        .update({
          total_prospects: newTotal,
          pending_count: newPending
        })
        .eq('id', sessionId);
    }
  }

  /**
   * Get current queue status
   */
  getStatus(): { queueLength: number; processing: boolean } {
    return {
      queueLength: this.queue.length,
      processing: this.processing
    };
  }

  /**
   * Clear the queue (for testing)
   */
  clear(): void {
    this.queue = [];
    this.processing = false;
  }
}

// Singleton instance
export const importQueue = new ImportQueue();
