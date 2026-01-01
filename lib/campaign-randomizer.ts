/**
 * Human-Like Campaign Randomization
 *
 * Generates realistic sending patterns that vary by day:
 * - Sometimes 0-2 messages/hour (slow days)
 * - Sometimes 3-5 messages/hour (busy days)
 * - Sometimes mixed (burst then pause)
 * - Respects daily CR limits per account
 * - Each day has different pattern seeded by date
 */

import { pool } from '@/lib/db';

export interface DelaySettings {
  timezone?: string;
  working_hours_start?: number;
  working_hours_end?: number;
  skip_weekends?: boolean;
  skip_holidays?: boolean;
}

/**
 * Calculate smart delay with human-like randomization
 * - Respects working hours (5 AM - 6 PM PT by default)
 * - Skips weekends (M-F only by default)
 * - Respects daily message limits per account
 * - Adds randomization patterns (5 different day patterns)
 */
export async function calculateSmartDelay({
  accountId,
  prospectIndex,
  totalProspects,
  settings = {}
}: {
  accountId: string;
  prospectIndex: number;
  totalProspects: number;
  settings?: DelaySettings;
}): Promise<number> {
  // SIMPLIFIED: Just return 2 minutes between prospects
  // TODO: Add back randomization, working hours, daily limits later

  console.log(`⏱️  Prospect ${prospectIndex + 1}/${totalProspects}: 2min delay`);

  return 120; // 120 seconds = 2 minutes between each prospect
}

/**
 * Calculate smart sleep duration for multi-day waits
 * SIMPLIFIED: Just returns the duration as-is for testing
 */
export function calculateSmartSleep(baseDuration: string, settings: DelaySettings = {}): string {
  // SIMPLIFIED: No working hours adjustment for now
  // TODO: Add back working hours logic later

  return baseDuration;
}

/**
 * Update account's daily message counter after sending
 */
export async function incrementAccountMessageCount(accountId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const { data: account } = await supabase
    .from('workspace_accounts')
    .select('messages_sent_today, last_message_date')
    .eq('unipile_account_id', accountId)
    .single();

  const lastMessageDate = account?.last_message_date?.split('T')[0];
  const isNewDay = lastMessageDate !== today;

  await supabase
    .from('workspace_accounts')
    .update({
      messages_sent_today: isNewDay ? 1 : (account?.messages_sent_today || 0) + 1,
      last_message_date: new Date().toISOString()
    })
    .eq('unipile_account_id', accountId);
}

/**
 * Personalize message with prospect data
 */
export function personalizeMessage(template: string, prospect: any): string {
  return template
    .replace(/\{\{first_name\}\}/g, prospect.first_name || '')
    .replace(/\{\{last_name\}\}/g, prospect.last_name || '')
    .replace(/\{\{company_name\}\}/g, prospect.company_name || '')
    .replace(/\{\{title\}\}/g, prospect.title || '');
}
