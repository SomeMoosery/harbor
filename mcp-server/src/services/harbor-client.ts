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
  private agentId?: string;

  constructor(private baseUrl: string) {}

  setAgentId(agentId: string): void {
    this.agentId = agentId;
  }

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
          ...(this.agentId && { 'X-Agent-Id': this.agentId }),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      // Try to parse response body as JSON, fall back to text if that fails
      let data: T | undefined;
      let errorText: string | undefined;

      try {
        data = (await response.json()) as T;
      } catch (parseError) {
        // Response is not JSON (possibly HTML error page)
        const text = await response.text();
        errorText = text.substring(0, 200); // Limit error text length
        logger.error(`Failed to parse JSON response from ${method} ${url}`, {
          status: response.status,
          contentType: response.headers.get('content-type'),
          preview: errorText,
        });
      }

      if (!response.ok) {
        const errorMessage = data && typeof data === 'object' && 'message' in data
          ? (data as any).message
          : errorText || `API request failed: ${response.status}`;

        logger.error(`API error: ${response.status}`, { data, errorText });

        if (response.status === 401 || response.status === 403) {
          throw new AuthenticationError(
            errorMessage || 'Authentication failed',
            data as unknown || { errorText }
          );
        }

        if (response.status === 404) {
          throw new NotFoundError(
            errorMessage || 'Resource not found',
            data as unknown || { errorText }
          );
        }

        throw new ApiError(
          errorMessage,
          response.status,
          data as unknown || { errorText }
        );
      }

      if (!data) {
        throw new ApiError(
          `Received non-JSON response from ${method} ${url}`,
          response.status,
          { errorText }
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
