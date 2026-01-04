/**
 * HTTP client for Harbor API
 */

import type {
  User,
  Agent,
  Ask,
  Bid,
  CreateAskRequest,
  ApiKeyValidationRequest,
  ApiKeyValidationResponse,
  AcceptBidRequest,
  AcceptBidResponse,
} from '../types/harbor.js';
import { logger } from '../utils/logger.js';
import { ApiError, AuthenticationError, NotFoundError } from '../utils/errors.js';

export class HarborClient {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    logger.debug(`${method} ${url}`, { body });

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': this.apiKey, // Use API key as agent ID for now
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = (await response.json()) as T;

      if (!response.ok) {
        logger.error(`API error: ${response.status}`, data as unknown);

        if (response.status === 401 || response.status === 403) {
          throw new AuthenticationError(
            (data as any).message || 'Authentication failed',
            data as unknown
          );
        }

        if (response.status === 404) {
          throw new NotFoundError(
            (data as any).message || 'Resource not found',
            data as unknown
          );
        }

        throw new ApiError(
          (data as any).message || `API request failed: ${response.status}`,
          response.status,
          data as unknown
        );
      }

      logger.debug(`${method} ${url} - Success`, { data });
      return data;
    } catch (error) {
      // Re-throw our custom errors
      if (
        error instanceof AuthenticationError ||
        error instanceof NotFoundError ||
        error instanceof ApiError
      ) {
        throw error;
      }

      logger.error(`Network error: ${method} ${url}`, error);
      throw new ApiError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        error
      );
    }
  }

  async validateApiKey(apiKey: string): Promise<ApiKeyValidationResponse> {
    return this.request<ApiKeyValidationResponse>('POST', '/api-keys/validate', {
      apiKey,
    } as ApiKeyValidationRequest);
  }

  async getUser(userId: string): Promise<User> {
    return this.request<User>('GET', `/users/${userId}`);
  }

  async getAgentsForUser(userId: string): Promise<Agent[]> {
    return this.request<Agent[]>('GET', `/users/${userId}/agents`);
  }

  async createAsk(request: CreateAskRequest): Promise<Ask> {
    // Transform MCP's simple format to backend's detailed format
    const backendRequest = {
      title: request.description.substring(0, 100), // Use first 100 chars of description as title
      description: request.description,
      requirements: {}, // Empty requirements for now
      minBudget: request.budget,
      maxBudget: request.budget,
      bidWindowHours: request.bidWindowHours,
    };
    return this.request<Ask>('POST', '/asks', backendRequest);
  }

  async getAsk(askId: string): Promise<Ask> {
    return this.request<Ask>('GET', `/asks/${askId}`);
  }

  async getBidsForAsk(askId: string): Promise<Bid[]> {
    return this.request<Bid[]>('GET', `/asks/${askId}/bids`);
  }

  async acceptBid(bidId: string): Promise<AcceptBidResponse> {
    return this.request<AcceptBidResponse>('POST', '/bids/accept', {
      bidId,
    } as AcceptBidRequest);
  }
}
