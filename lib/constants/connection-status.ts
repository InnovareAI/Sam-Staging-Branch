/**
 * Valid connection status values for user_unipile_accounts
 *
 * - 'connected': Legacy status, still in use for some accounts
 * - 'active': Current standard status for functioning accounts
 *
 * Both values indicate the account is properly configured and can be used.
 */
export const VALID_CONNECTION_STATUSES = ['connected', 'active'] as const;

export type ValidConnectionStatus = typeof VALID_CONNECTION_STATUSES[number];

/**
 * Check if a connection status is valid for use
 */
export function isValidConnectionStatus(status: string | null | undefined): boolean {
  return status !== null && status !== undefined && VALID_CONNECTION_STATUSES.includes(status as any);
}
