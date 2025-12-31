import { pool } from './auth'; // Import pool directly
import { logger } from './logging';

/**
 * Saves LinkedIn search results to the database for quota tracking and history
 */
export async function saveSearchResults(
    // Remove supabase client arg
    data: {
        user_id: string;
        workspace_id: string;
        unipile_account_id: string;
        search_query: string;
        search_params: any;
        api_type: string;
        category: string;
        results_count: number;
        prospects: any[];
        cursor?: string;
    }
) {
    try {
        await pool.query(
            `INSERT INTO linkedin_searches 
            (user_id, workspace_id, unipile_account_id, search_query, search_params, 
             api_type, category, results_count, prospects, next_cursor, searched_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                data.user_id,
                data.workspace_id,
                data.unipile_account_id,
                data.search_query,
                data.search_params,
                data.api_type,
                data.category,
                data.results_count,
                JSON.stringify(data.prospects),
                data.cursor,
                new Date().toISOString()
            ]
        );

        logger.info(`✅ Saved search results for account ${data.unipile_account_id} (${data.results_count} results)`);
    } catch (error: any) {
        logger.error('❌ Error in saveSearchResults', error);
    }
}

/**
 * Checks the daily search quota for a LinkedIn account
 */
export async function checkSearchQuota(unipileAccountId: string) {
    try {
        // Call the RPC function via SQL
        const result = await pool.query(
            'SELECT * FROM check_linkedin_search_quota($1)',
            [unipileAccountId]
        );
        return result.rows[0] || null;
    } catch (error: any) {
        logger.error('❌ Error checking search quota', error);
        return null;
    }
}
