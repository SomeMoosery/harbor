/**
 * Harbor environment types
 */
export type Environment = 'local' | 'staging' | 'production';

/**
 * Get the current Harbor environment
 *
 * Priority:
 * 1. HARBOR_ENV environment variable
 * 2. NODE_ENV === 'development' → 'local'
 * 3. NODE_ENV === 'production' → 'production'
 * 4. Default to 'local'
 */
export function getEnvironment(): Environment {
  const harborEnv = process.env.HARBOR_ENV as Environment | undefined;
  const nodeEnv = process.env.NODE_ENV;

  if (harborEnv === 'local' || harborEnv === 'staging' || harborEnv === 'production') {
    return harborEnv;
  }

  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return 'local';
  }

  if (nodeEnv === 'production') {
    return 'production';
  }

  return 'local';
}

/**
 * Check if running in local environment
 */
export function isLocal(): boolean {
  return getEnvironment() === 'local';
}

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Check if running in staging environment
 */
export function isStaging(): boolean {
  return getEnvironment() === 'staging';
}
