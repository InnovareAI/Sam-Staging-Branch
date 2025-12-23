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
    timeout?: number;
}

/**
 * Enhanced Unipile request with automatic retries and safety checks
 */
export async function unipileRequest(
    endpoint: string,
    options: UnipileRequestOptions = {}
) {
    const { maxRetries = 3, initialDelay = 1000, timeout = 30000, ...fetchOptions } = options;
    let attempt = 0;

    while (attempt < maxRetries) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(`${UNIPILE_BASE_URL}${endpoint}`, {
                ...fetchOptions,
                signal: controller.signal,
                headers: {
                    'X-API-KEY': UNIPILE_API_KEY,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...fetchOptions.headers,
                },
            });

            clearTimeout(timeoutId);

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
            clearTimeout(timeoutId);

            if (error.message === 'LINKEDIN_COMMERCIAL_LIMIT') throw error;

            if (error.name === 'AbortError') {
                logger.warn(`⏱️ Unipile request timed out after ${timeout}ms (Attempt ${attempt + 1}/${maxRetries})`, {
                    metadata: { endpoint }
                });
            }

            if (attempt >= maxRetries - 1) {
                logger.error(`❌ Unipile request failed after ${maxRetries} attempts`, error, {
                    metadata: { endpoint }
                });
                throw error;
            }

            // Network errors or other unexpected issues
            attempt++;
            const delayMs = initialDelay * Math.pow(2, attempt);
            logger.warn(`⚠️ Unipile network error on attempt ${attempt}. Retrying in ${delayMs}ms...`, {
                metadata: { endpoint, error: error.message }
            });
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    throw new Error('Unipile request failed after maximum retries');
}
