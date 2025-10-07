/**
 * Retry Utility with Exponential Backoff
 *
 * Retries failed operations with exponential backoff to handle transient failures
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  timeoutMs?: number; // timeout for each attempt
  onRetry?: (attempt: number, error: Error) => void;
}

export class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    timeoutMs = 30000,
    onRetry
  } = options;

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Execute function with timeout
      const result = await executeWithTimeout(fn, timeoutMs);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry non-retryable errors
      if (error instanceof NonRetryableError) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        throw new Error(
          `Failed after ${maxRetries} attempts: ${lastError.message}`
        );
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt),
        maxDelay
      );

      console.warn(
        `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms. Error: ${lastError.message}`
      );

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Execute function with timeout
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new RetryableError(`Operation timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout and retry
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return retryWithBackoff(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      retryOptions.timeoutMs || 30000
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Check if we should retry based on status code
      if (!response.ok) {
        // 5xx errors are retryable (server errors)
        if (response.status >= 500) {
          throw new RetryableError(
            `Server error ${response.status}: ${response.statusText}`
          );
        }

        // 429 (rate limit) is retryable
        if (response.status === 429) {
          throw new RetryableError('Rate limited');
        }

        // 4xx errors are not retryable (client errors)
        if (response.status >= 400 && response.status < 500) {
          throw new NonRetryableError(
            `Client error ${response.status}: ${response.statusText}`
          );
        }

        throw new RetryableError(
          `Request failed ${response.status}: ${response.statusText}`
        );
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new RetryableError('Request timeout');
      }

      throw error;
    }
  }, retryOptions);
}
