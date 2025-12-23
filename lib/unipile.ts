/**
 * Centralized Unipile API request utility with safety features
 * Handles:
 * - Exponential backoff for 429 (Rate Limited)
 * - Detection of "Commercial Use Limit"
 * - Consistent error formatting
 */

import { logger } from './logging';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

interface UnipileRequestOptions extends RequestInit {
    maxRetries?: number;
    initialDelay?: number;
}

/**
 * Enhanced Unipile request with automatic retries and safety checks
 */
export async function unipileRequest(
    endpoint: string,
    options: UnipileRequestOptions = {}
) {
    const { maxRetries = 3, initialDelay = 1000, ...fetchOptions } = options;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await fetch(`${UNIPILE_BASE_URL}${endpoint}`, {
                ...fetchOptions,
                headers: {
                    'X-API-KEY': UNIPILE_API_KEY,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...fetchOptions.headers,
                },
            });

            // Handle Success
            if (response.ok) {
                return await response.json();
            }

            // Handle Rate Limiting (429)
            if (response.status === 429 && attempt < maxRetries - 1) {
                attempt++;
                const delayMs = initialDelay * Math.pow(2, attempt);
                logger.warn(`⚠️ Unipile Rate Limit (429). Retrying in ${delayMs}ms... (Attempt ${attempt}/${maxRetries})`, {
                    metadata: { endpoint, status: 429 }
                });
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }

            // Handle Authentication (401/403)
            if (response.status === 401 || response.status === 403) {
                const error = await response.json().catch(() => ({ message: 'Authentication failed' }));
                logger.error(`❌ Unipile Auth Error (${response.status})`, new Error(error.message), {
                    metadata: { endpoint, status: response.status }
                });
                throw new Error(`Unipile Authentication Error: ${error.message || 'Check API keys'}`);
            }

            // Handle other errors
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { message: errorText };
            }

            // CHECK FOR COMMERCIAL USE LIMIT
            const errorMessage = errorData.message || errorData.error || errorText;
            if (errorMessage.toLowerCase().includes('commercial use limit')) {
                logger.error('⚠️ LinkedIn Commercial Use Limit detected!', new Error(errorMessage), {
                    metadata: { endpoint, status: response.status }
                });
                throw new Error('LINKEDIN_COMMERCIAL_LIMIT');
            }

            throw new Error(errorMessage || `Unipile API error: ${response.status}`);

        } catch (error: any) {
            if (error.message === 'LINKEDIN_COMMERCIAL_LIMIT') throw error;

            if (attempt >= maxRetries - 1) {
                logger.error(`❌ Unipile request failed after ${maxRetries} attempts`, error, {
                    metadata: { endpoint }
                });
                throw error;
            }

            // Network errors or other unexpected issues
            attempt++;
            const delayMs = initialDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    throw new Error('Unipile request failed after maximum retries');
}
