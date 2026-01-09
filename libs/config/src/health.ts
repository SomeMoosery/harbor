import type { ServiceName } from './ports.js';
import { getServiceUrl } from './ports.js';

export interface WaitForServiceOptions {
  /**
   * Maximum number of retry attempts
   * @default 30
   */
  maxRetries?: number;

  /**
   * Initial delay between retries in milliseconds
   * @default 1000
   */
  initialDelay?: number;

  /**
   * Maximum delay between retries in milliseconds
   * @default 5000
   */
  maxDelay?: number;

  /**
   * Timeout for each health check request in milliseconds
   * @default 2000
   */
  timeout?: number;
}

interface HealthCheckResponse {
  status?: string;
  ready?: boolean;
}

/**
 * Wait for a service to be healthy by polling its /health endpoint
 * Uses exponential backoff with jitter for retries
 */
export async function waitForServiceHealth(
  service: ServiceName,
  options: WaitForServiceOptions = {}
): Promise<void> {
  const {
    maxRetries = 30,
    initialDelay = 1000,
    maxDelay = 5000,
    timeout = 2000,
  } = options;

  const serviceUrl = getServiceUrl(service);
  const healthUrl = `${serviceUrl}/health`;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(healthUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        try {
          const data = await response.json() as HealthCheckResponse;
          if (data.status === 'ok' || data.ready === true) {
            return; // Service is healthy!
          }
          // Service responded with JSON but not healthy yet
          lastError = new Error(`Service ${service} health check returned unhealthy status`);
        } catch (parseError) {
          // Response is ok but not valid JSON
          lastError = new Error(`Service ${service} health endpoint returned non-JSON response`);
        }
      } else {
        // Service responded but not healthy yet
        lastError = new Error(`Service ${service} returned status ${response.status}`);
      }
    } catch (error) {
      // Connection refused, timeout, or other network error
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    // Don't sleep after the last attempt
    if (attempt < maxRetries) {
      // Exponential backoff with jitter: delay * 2^(attempt-1) + random jitter
      const exponentialDelay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
      const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
      const delay = exponentialDelay + jitter;

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(
    `Service ${service} failed to become healthy after ${maxRetries} attempts. Last error: ${lastError?.message}`
  );
}

/**
 * Wait for multiple services to be healthy in parallel
 */
export async function waitForServices(
  services: ServiceName[],
  options?: WaitForServiceOptions
): Promise<void> {
  await Promise.all(
    services.map(service => waitForServiceHealth(service, options))
  );
}
