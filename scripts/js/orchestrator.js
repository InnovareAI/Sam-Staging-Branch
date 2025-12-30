import 'dotenv/config';
import pg from 'pg';
import { PubSub } from '@google-cloud/pubsub';
import moment from 'moment-timezone';

const { Pool } = pg;
const pubsub = new PubSub({
    projectId: process.env.GOOGLE_CLOUD_PROJECT
});

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME || 'sam_prod',
    password: process.env.DB_PASSWORD || 'sam_root_pass_2025',
    port: parseInt(process.env.DB_PORT || '5432'),
});

const TOPIC_NAME = 'sam-campaign-tasks';
const topic = pubsub.topic(TOPIC_NAME);

// Ported Scheduling Configuration
const BUSINESS_HOURS = { start: 8, end: 18 };
const DEFAULT_TIMEZONE = 'UTC';
const MIN_SPACING_MINUTES = 20;

const HOLIDAYS_BY_COUNTRY = {
    US: ['2025-01-01', '2025-01-20', '2025-02-17', '2025-05-26', '2025-07-04', '2025-09-01', '2025-11-27', '2025-12-25', '2026-01-01'],
    CA: ['2025-01-01', '2025-02-17', '2025-04-18', '2025-05-19', '2025-07-01', '2025-09-01', '2025-10-13', '2025-12-25', '2025-12-26', '2026-01-01'],
    GB: ['2025-01-01', '2025-04-18', '2025-04-21', '2025-05-05', '2025-05-26', '2025-08-25', '2025-12-25', '2025-12-26', '2026-01-01'],
    // ... adding main ones for now, can expand if needed
};

const FRIDAY_SATURDAY_WEEKEND_COUNTRIES = ['AE', 'SA', 'KW', 'QA', 'BH', 'OM', 'JO', 'EG'];

async function query(text, params) {
    return await pool.query(text, params);
}

function canSendMessage(settings) {
    const timezone = settings.timezone || DEFAULT_TIMEZONE;
    const startHour = settings.working_hours_start ?? BUSINESS_HOURS.start;
    const endHour = settings.working_hours_end ?? BUSINESS_HOURS.end;
    const skipWeekends = settings.skip_weekends ?? true;
    const skipHolidays = settings.skip_holidays ?? true;
    const countryCode = settings.country_code || 'US';

    const localTime = moment().tz(timezone);
    const day = localTime.day(); // 0=Sun, 6=Sat
    const currentHour = localTime.hour();
    const dateStr = localTime.format('YYYY-MM-DD');

    console.log(`  [Scheduling] Campaign: "${settings.name}" (${settings.id})`);
    console.log(`  [Scheduling] Timezone: ${timezone}, Local Time: ${localTime.format('llll')}`);
    console.log(`  [Scheduling] Hour: ${currentHour}, Range: ${startHour}-${endHour}, Day: ${day}, Country: ${countryCode}`);

    // 1. Check Weekend
    if (skipWeekends) {
        if (FRIDAY_SATURDAY_WEEKEND_COUNTRIES.includes(countryCode)) {
            if (day === 5 || day === 6) {
                console.log(`  [Scheduling] Outcome: BLOCKED (ME Weekend Fri-Sat)`);
                return false;
            }
        } else {
            if (day === 0 || day === 6) {
                console.log(`  [Scheduling] Outcome: BLOCKED (Standard Weekend Sat-Sun)`);
                return false;
            }
        }
    }

    // 2. Check Holidays
    if (skipHolidays) {
        const holidays = HOLIDAYS_BY_COUNTRY[countryCode] || [];
        if (holidays.includes(dateStr)) {
            console.log(`  [Scheduling] Outcome: BLOCKED (Public Holiday in ${countryCode})`);
            return false;
        }
    }

    // 3. Check Business Hours
    if (currentHour < startHour || currentHour >= endHour) {
        console.log(`  [Scheduling] Outcome: BLOCKED (Outside working hours: ${startHour}:00-${endHour}:00)`);
        return false;
    }

    console.log(`  [Scheduling] Outcome: ALLOWED`);
    return true;
}

async function orchestrate() {
    console.log(`[${new Date().toISOString()}] 🔍 Orchestrator Loop Started...`);

    try {
        const now = new Date().toISOString();

        // 1. Fetch campaigns that are 'active' or 'scheduled'
        const { rows: campaigns } = await query(`
      SELECT id, name, linkedin_account_id, timezone, working_hours_start, working_hours_end, skip_weekends, skip_holidays, country_code
      FROM campaigns
      WHERE status IN ('active', 'scheduled')
      AND auto_execute = true
      LIMIT 100
    `);

        console.log(`📊 Found ${campaigns.length} campaigns to evaluate.`);

        for (const campaign of campaigns) {
            if (!canSendMessage(campaign)) {
                continue;
            }

            // 2. Fetch due prospects for this campaign
            const { rows: dueProspects } = await query(`
        SELECT q.*, p.first_name, p.last_name, p.linkedin_url
        FROM send_queue q
        JOIN campaign_prospects p ON q.prospect_id = p.id
        WHERE q.campaign_id = $1
        AND q.status = 'pending'
        AND q.scheduled_for <= $2
        ORDER BY q.scheduled_for ASC
        LIMIT 10
      `, [campaign.id, now]);

            if (dueProspects.length === 0) {
                console.log(`  [Queue] Campaign "${campaign.name}": No prospects due.`);
                continue;
            }

            console.log(`  🎯 Found ${dueProspects.length} due prospects for campaign: ${campaign.name}`);

            for (const queueItem of dueProspects) {
                // 3. Spacing Check (per account)
                const { rows: recentlySent } = await query(`
          SELECT id FROM send_queue
          WHERE campaign_id IN (SELECT id FROM campaigns WHERE linkedin_account_id = $1)
          AND status = 'sent'
          AND sent_at >= NOW() - INTERVAL '${MIN_SPACING_MINUTES} minutes'
          LIMIT 1
        `, [campaign.linkedin_account_id]);

                if (recentlySent.length > 0) {
                    console.log(`  ⏳ Spacing limit hit for account: ${campaign.linkedin_account_id}. Skipping remaining items for this run.`);
                    break; // Stop processing this campaign’s account for this loop iteration
                }

                // 4. Atomic Lock
                const { rows: locked } = await query(`
          UPDATE send_queue
          SET status = 'processing', updated_at = NOW()
          WHERE id = $1 AND status = 'pending'
          RETURNING id
        `, [queueItem.id]);

                if (locked.length === 0) continue;

                // 5. Publish to Pub/Sub
                const task = {
                    queue_id: queueItem.id,
                    campaign_id: campaign.id,
                    prospect_id: queueItem.prospect_id,
                    linkedin_account_id: campaign.linkedin_account_id,
                    message: queueItem.message,
                    linkedin_user_id: queueItem.linkedin_user_id,
                    message_type: queueItem.message_type || 'connection_request'
                };

                try {
                    const messageId = await topic.publishMessage({ json: task });
                    console.log(`  🚀 Dispatched task ${queueItem.id} to Pub/Sub (Msg ID: ${messageId})`);
                } catch (publishError) {
                    console.error(`  ❌ Failed to publish task ${queueItem.id}:`, publishError);
                    // Revert status to pending on failure
                    await query(`UPDATE send_queue SET status = 'pending' WHERE id = $1`, [queueItem.id]);
                }
            }
        }

    } catch (err) {
        console.error('❌ Orchestrator Error:', err);
    }

    // Set next run
    setTimeout(orchestrate, 60000); // Run every minute
}

orchestrate();
