import { jest } from '@jest/globals';
import type { Logger } from '@harbor/logger';

/**
 * Create a mock logger for testing
 */
export function createMockLogger(): Logger {
  return {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
  } as unknown as Logger;
}
