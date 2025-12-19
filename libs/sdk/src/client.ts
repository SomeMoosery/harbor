import WebSocket from 'ws';
import type {
  HarborConfig,
  HarborEvent,
  EventListener,
  CreateAskParams,
  CreateBidParams,
  AcceptBidParams,
  SubmitDeliveryParams,
} from './types.js';

/**
 * Harbor SDK Client
 * Provides event-driven API for interacting with Harbor marketplace
 */
export class HarborClient {
  private config: Required<HarborConfig>;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private shouldReconnect = true;

  constructor(config: HarborConfig) {
    this.config = {
      apiKey: config.apiKey,
      agentId: config.agentId,
      gatewayUrl: config.gatewayUrl || 'http://localhost:3000',
      gatewayWsUrl: config.gatewayWsUrl || 'ws://localhost:3005',
    };
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.gatewayWsUrl);

        this.ws.on('open', () => {
          // Authenticate with API key and agent ID
          this.ws?.send(
            JSON.stringify({
              type: 'auth',
              apiKey: this.config.apiKey,
              agentId: this.config.agentId,
            })
          );
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
          try {
            const message = JSON.parse(data.toString());

            if (message.type === 'authenticated') {
              this.reconnectAttempts = 0;
              this.isConnecting = false;
              this.emit('connected', { agentId: this.config.agentId });
              resolve();
            } else if (message.type === 'error') {
              this.isConnecting = false;
              this.emit('error', { message: message.message });
              reject(new Error(message.message));
            } else {
              // Emit the event to listeners
              this.emit(message.type, message.data);
            }
          } catch (error) {
            this.emit('error', {
              message: error instanceof Error ? error.message : 'Failed to parse message',
            });
          }
        });

        this.ws.on('close', (code, reason) => {
          this.isConnecting = false;
          this.emit('disconnected', {
            code,
            reason: reason.toString(),
          });

          // Attempt to reconnect if not explicitly disconnected
          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
              this.connect().catch((err) => {
                this.emit('error', {
                  message: `Reconnect failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
                });
              });
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        });

        this.ws.on('error', (error) => {
          this.isConnecting = false;
          this.emit('error', {
            message: error.message,
          });
          reject(error);
        });
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.ws?.close();
    this.ws = null;
  }

  /**
   * Register an event listener
   */
  on<T extends HarborEvent['type']>(
    event: T,
    listener: EventListener<Extract<HarborEvent, { type: T }>>
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(listener as EventListener);
  }

  /**
   * Remove an event listener
   */
  off<T extends HarborEvent['type']>(
    event: T,
    listener: EventListener<Extract<HarborEvent, { type: T }>>
  ): void {
    this.listeners.get(event)?.delete(listener as EventListener);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Create an ask
   */
  async createAsk(params: CreateAskParams): Promise<any> {
    const response = await fetch(`${this.config.gatewayUrl}/api/asks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(error.message || 'Failed to create ask');
    }

    return response.json();
  }

  /**
   * Create a bid
   */
  async createBid(params: CreateBidParams): Promise<any> {
    const response = await fetch(`${this.config.gatewayUrl}/api/bids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(error.message || 'Failed to create bid');
    }

    return response.json();
  }

  /**
   * Accept a bid
   */
  async acceptBid(params: AcceptBidParams): Promise<any> {
    const response = await fetch(`${this.config.gatewayUrl}/api/bids/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(error.message || 'Failed to accept bid');
    }

    return response.json();
  }

  /**
   * Submit delivery
   */
  async submitDelivery(params: SubmitDeliveryParams): Promise<any> {
    const response = await fetch(`${this.config.gatewayUrl}/api/delivery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(error.message || 'Failed to submit delivery');
    }

    return response.json();
  }
}
