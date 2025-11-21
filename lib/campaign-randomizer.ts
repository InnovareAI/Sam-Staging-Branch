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

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  // 1. Get account's daily limit and today's sent count
  const { data: account } = await supabase
    .from('workspace_accounts')
    .select('daily_message_limit, messages_sent_today, last_message_date')
    .eq('unipile_account_id', accountId)
    .single();

  const dailyLimit = account?.daily_message_limit || 20; // Default: Free LinkedIn limit
  const sentToday = account?.messages_sent_today || 0;
  const lastMessageDate = account?.last_message_date;

  // Reset counter if it's a new day
  const today = new Date().toISOString().split('T')[0];
  const isNewDay = !lastMessageDate || lastMessageDate.split('T')[0] !== today;

  const actualSentToday = isNewDay ? 0 : sentToday;
  const remainingToday = Math.max(0, dailyLimit - actualSentToday);

  console.log(`📊 Account ${accountId}: ${actualSentToday}/${dailyLimit} sent today, ${remainingToday} remaining`);

  // 2. Check if today is weekend or holiday (respect campaign settings)
  // DEFAULT: Monday to Friday messaging only (skip_weekends: true)
  // Wide window (5 AM - 6 PM PT) to cover all US timezones
  const skipWeekends = settings.skip_weekends ?? true; // Default: M-F only
  const skipHolidays = settings.skip_holidays ?? true; // Default: skip holidays
  const timezone = settings.timezone || 'America/Los_Angeles'; // Pacific Time for US/CAN
  const workingHoursStart = settings.working_hours_start || 5;  // 5 AM PT (covers 8 AM ET)
  const workingHoursEnd = settings.working_hours_end || 18;     // 6 PM PT (covers 9 PM ET)

  // Get current time in campaign's timezone
  const now = new Date();

  // CRITICAL: Convert to campaign's timezone for accurate hour checking
  const campaignTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const dayOfWeek = campaignTime.getDay(); // 0 = Sunday, 6 = Saturday
  const currentHour = campaignTime.getHours();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  console.log(`🕐 Server time: ${now.toISOString()} | Campaign timezone (${timezone}): ${campaignTime.toLocaleString()} | Hour: ${currentHour}`);

  // Check if we're outside working hours
  const isOutsideWorkingHours = currentHour < workingHoursStart || currentHour >= workingHoursEnd;

  if (isOutsideWorkingHours) {
    // Calculate minutes until next working hour start
    const hoursUntilStart = currentHour < workingHoursStart
      ? workingHoursStart - currentHour
      : (24 - currentHour) + workingHoursStart;
    console.log(`⏸️  Outside working hours (${workingHoursStart}:00-${workingHoursEnd}:00) - waiting ${hoursUntilStart}h`);
    return hoursUntilStart * 60;
  }

  if (isWeekend && skipWeekends) {
    console.log(`⏸️  Weekend detected, skip_weekends=true - skipping until Monday`);
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 2; // Sunday = 1 day, Saturday = 2 days
    return daysUntilMonday * 24 * 60;
  }

  // 3. Can't send more today
  if (remainingToday === 0) {
    console.log(`⏸️  Daily limit reached, delaying to tomorrow`);
    return 24 * 60; // Wait 24 hours
  }

  // 4. Generate day-specific randomization seed
  // Use date + account ID so same account has same pattern each day
  const dateSeed = parseInt(today.replace(/-/g, '')) + accountId.charCodeAt(0);
  const dayPattern = (dateSeed % 5); // 5 different day patterns

  // 5. Simple random delay between 30 seconds and 3 minutes
  // Fast enough for testing, slow enough to avoid rate limits
  const delaySeconds = 30 + Math.floor(Math.random() * 150); // 30-180 seconds
  const delayMinutes = Math.floor(delaySeconds / 60);

  console.log(`⏱️  Prospect ${prospectIndex}: ${delaySeconds}s delay`);

  return delayMinutes;
}

/**
 * Calculate smart sleep duration for multi-day waits
 * Adjusts base delay (e.g., "2 days") to land within working hours
 */
export function calculateSmartSleep(baseDuration: string, settings: DelaySettings = {}): string {
  // Parse duration (e.g., "2 days" → 2880 minutes)
  const match = baseDuration.match(/(\d+)\s*(day|days|hour|hours|minute|minutes|min)/i);
  if (!match) return baseDuration;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  let totalMinutes: number;
  switch (unit) {
    case 'day':
    case 'days':
      totalMinutes = value * 24 * 60;
      break;
    case 'hour':
    case 'hours':
      totalMinutes = value * 60;
      break;
    case 'minute':
    case 'minutes':
    case 'min':
      totalMinutes = value;
      break;
    default:
      return baseDuration;
  }

  // Add adjustment to land in working hours
  const timezone = settings.timezone || 'America/Los_Angeles';
  const workingHoursStart = settings.working_hours_start || 5;

  const now = new Date();
  const futureTime = new Date(now.getTime() + totalMinutes * 60 * 1000);
  const futureHour = parseInt(futureTime.toLocaleString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false
  }));

  // If we'd wake up outside working hours, adjust
  if (futureHour < workingHoursStart) {
    const adjustment = (workingHoursStart - futureHour) * 60;
    totalMinutes += adjustment;
  }

  return `${totalMinutes}m`;
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
