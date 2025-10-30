/**
 * Cadence Conversion Utility
 * Converts user-friendly cadence strings to numeric delays for N8N
 */

export interface CadenceTiming {
  // Average delay in days (for N8N Wait nodes)
  delayDays: number;
  // Min/max for randomization (adds natural variation)
  minDays: number;
  maxDays: number;
  // Human-readable format
  label: string;
}

/**
 * Convert cadence string to numeric delays
 * @param cadence - UI cadence value (e.g., "2-3 days", "1 week")
 * @returns Timing object with min/max/average delays
 */
export function convertCadenceToTiming(cadence: string): CadenceTiming {
  const normalized = cadence.toLowerCase().trim();

  // Map of cadence values to timing
  const cadenceMap: Record<string, CadenceTiming> = {
    '1 day': {
      delayDays: 1,
      minDays: 0.8,
      maxDays: 1.2,
      label: '1 day'
    },
    '2-3 days': {
      delayDays: 2.5,
      minDays: 2,
      maxDays: 3,
      label: '2-3 days'
    },
    '3-5 days': {
      delayDays: 4,
      minDays: 3,
      maxDays: 5,
      label: '3-5 days'
    },
    '5-7 days': {
      delayDays: 6,
      minDays: 5,
      maxDays: 7,
      label: '5-7 days'
    },
    '1 week': {
      delayDays: 7,
      minDays: 6,
      maxDays: 8,
      label: '1 week'
    },
    '2 weeks': {
      delayDays: 14,
      minDays: 13,
      maxDays: 15,
      label: '2 weeks'
    }
  };

  const timing = cadenceMap[normalized];

  if (!timing) {
    console.warn(`Unknown cadence: ${cadence}, defaulting to 2-3 days`);
    return cadenceMap['2-3 days'];
  }

  return timing;
}

/**
 * Convert message_delays array to N8N timing object
 * @param messageDelays - Array of cadence strings from UI
 * @returns N8N-compatible timing object
 */
export function buildN8NTiming(messageDelays: string[]): Record<string, number> {
  const timing: Record<string, number> = {};

  messageDelays.forEach((cadence, index) => {
    const { delayDays } = convertCadenceToTiming(cadence);
    const messageKey = `fu${index + 1}_delay_days`;
    timing[messageKey] = delayDays;
  });

  return timing;
}

/**
 * Get randomized delay within cadence range
 * Adds natural variation to avoid LinkedIn bot detection
 * @param cadence - UI cadence value
 * @returns Random delay in days
 */
export function getRandomizedDelay(cadence: string): number {
  const { minDays, maxDays } = convertCadenceToTiming(cadence);
  return minDays + Math.random() * (maxDays - minDays);
}
