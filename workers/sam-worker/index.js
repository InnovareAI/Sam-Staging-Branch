import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import fetch from 'node-fetch';
import moment from 'moment-timezone';

const { Pool } = pg;
const app = express();
app.use(bodyParser.json());

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

async function query(text, params) {
    return await pool.query(text, params);
}

async function unipileRequest(endpoint, options = {}) {
    const response = await fetch(`https://${UNIPILE_DSN}${endpoint}`, {
        ...options,
        headers: {
            'X-API-KEY': UNIPILE_API_KEY,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    const body = await response.text();
    if (!response.ok) {
        throw new Error(`Unipile Error [${response.status}]: ${body}`);
    }
    try {
        return JSON.parse(body);
    } catch {
        return body;
    }
}

async function resolveToProviderId(linkedinUserIdOrUrl, accountId) {
    if (linkedinUserIdOrUrl.startsWith('ACo') || linkedinUserIdOrUrl.startsWith('ACw')) {
        return linkedinUserIdOrUrl;
    }
    // Extract slug - very simplified for the worker
    const match = linkedinUserIdOrUrl.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
    const vanity = match ? match[1] : linkedinUserIdOrUrl;

    const profile = await unipileRequest(`/api/v1/users/${encodeURIComponent(vanity)}?account_id=${accountId}`);
    return profile.provider_id;
}

app.post('/', async (req, res) => {
    if (!req.body.message) {
        return res.status(400).send('No message received');
    }

    const message = Buffer.from(req.body.message.data, 'base64').toString('utf-8');
    let task;
    try {
        task = JSON.parse(message);
        console.log(`[Worker] Received task: ${task.queue_id}`);
    } catch (e) {
        return res.status(400).send('Invalid task format');
    }

    try {
        const { queue_id, campaign_id, prospect_id, linkedin_account_id, message: text, linkedin_user_id, message_type } = task;

        // 1. Resolve Provider ID
        let providerId = linkedin_user_id;
        try {
            if (!providerId.startsWith('ACo') && !providerId.startsWith('ACw')) {
                providerId = await resolveToProviderId(providerId, linkedin_account_id);
            }
        } catch (err) {
            console.error(`[Worker] Resolution failed for ${queue_id}:`, err.message);
            await query(`UPDATE send_queue SET status = 'failed', error_message = $1 WHERE id = $2`, [`Resolution failed: ${err.message}`, queue_id]);
            return res.status(200).send('Task failed (resolution)'); // Ack to Pub/Sub
        }

        // 2. Anti-detection delay (10-20s)
        const delay = 10000 + Math.random() * 10000;
        console.log(`[Worker] Anti-detection delay: ${Math.round(delay / 1000)}s`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // 3. Send via Unipile
        if (message_type === 'connection_request') {
            await unipileRequest('/api/v1/users/invite', {
                method: 'POST',
                body: JSON.stringify({
                    account_id: linkedin_account_id,
                    provider_id: providerId,
                    message: text
                })
            });
        } else {
            // Default to direct message/chat
            // Note: This would involve chat_id resolution for real messenger campaigns
            console.log(`[Worker] Non-CR message type [${message_type}] not fully implemented yet.`);
            throw new Error(`Message type ${message_type} not supported in prototype`);
        }

        // 4. Update Database
        await query(`
      UPDATE send_queue 
      SET status = 'sent', sent_at = NOW(), updated_at = NOW() 
      WHERE id = $1
    `, [queue_id]);

        await query(`
      UPDATE campaign_prospects 
      SET status = $1, updated_at = NOW() 
      WHERE id = $2
    `, [message_type === 'connection_request' ? 'connection_requested' : 'sent', prospect_id]);

        console.log(`[Worker] Task ${queue_id} successfully processed.`);
        res.status(200).send('OK');

    } catch (err) {
        console.error(`[Worker] task ${task?.queue_id} failed:`, err.message);
        if (task?.queue_id) {
            await query(`UPDATE send_queue SET status = 'failed', error_message = $1 WHERE id = $2`, [err.message, task.queue_id]);
        }
        res.status(200).send('Task failed'); // Still ack to Pub/Sub to stop retries, we handle failures in DB
    }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`[Worker] Service listening on port ${port}`);
});
