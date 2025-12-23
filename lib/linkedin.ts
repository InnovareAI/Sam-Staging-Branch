import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logging';

/**
 * Saves LinkedIn search results to the database for quota tracking and history
 */
export async function saveSearchResults(supabase: SupabaseClient, data: {
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
}) {
    try {
        const { error } = await supabase
            .from('linkedin_searches')
            .insert({
                user_id: data.user_id,
                workspace_id: data.workspace_id,
                unipile_account_id: data.unipile_account_id,
                search_query: data.search_query,
                search_params: data.search_params,
                api_type: data.api_type,
                category: data.category,
                results_count: data.results_count,
                prospects: data.prospects,
                next_cursor: data.cursor,
                searched_at: new Date().toISOString()
            });

        if (error) {
            logger.error('❌ Failed to save LinkedIn search results', new Error(error.message));
        } else {
            logger.info(`✅ Saved search results for account ${data.unipile_account_id} (${data.results_count} results)`);
        }
    } catch (error: any) {
        logger.error('❌ Error in saveSearchResults', error);
    }
}

/**
 * Checks the daily search quota for a LinkedIn account
 */
export async function checkSearchQuota(supabase: SupabaseClient, unipileAccountId: string) {
    const { data, error } = await supabase.rpc('check_linkedin_search_quota', {
        p_account_id: unipileAccountId
    });

    if (error) {
        logger.error('❌ Error checking search quota', new Error(error.message));
        return null;
    }

    return data[0] || null;
}
