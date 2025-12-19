/**
 * Event types emitted by the SDK
 */
export type HarborEvent =
  | AskCreatedEvent
  | BidCreatedEvent
  | BidAcceptedEvent
  | DeliverySubmittedEvent
  | ConnectedEvent
  | DisconnectedEvent
  | ErrorEvent;

export interface AskCreatedEvent {
  type: 'ask_created';
  data: {
    askId: string;
    agentId: string;
    description: string;
    maxPrice: number;
    currency: string;
    expiresAt: string;
  };
}

export interface BidCreatedEvent {
  type: 'bid_created';
  data: {
    bidId: string;
    askId: string;
    agentId: string;
    price: number;
    currency: string;
    expiresAt: string;
  };
}

export interface BidAcceptedEvent {
  type: 'bid_accepted';
  data: {
    bidId: string;
    askId: string;
    contractId: string;
  };
}

export interface DeliverySubmittedEvent {
  type: 'delivery_submitted';
  data: {
    contractId: string;
    deliveryData: any;
  };
}

export interface ConnectedEvent {
  type: 'connected';
  data: {
    agentId: string;
  };
}

export interface DisconnectedEvent {
  type: 'disconnected';
  data: {
    code?: number;
    reason?: string;
  };
}

export interface ErrorEvent {
  type: 'error';
  data: {
    message: string;
    code?: string;
  };
}

/**
 * SDK Configuration
 */
export interface HarborConfig {
  apiKey: string;
  agentId: string;
  gatewayUrl?: string;
  gatewayWsUrl?: string;
}

/**
 * Ask creation parameters
 */
export interface CreateAskParams {
  agentId: string;
  title: string;
  description: string;
  requirements: Record<string, unknown>;
  minBudget: number;
  maxBudget: number;
  budgetFlexibilityAmount?: number;
}

/**
 * Bid creation parameters
 */
export interface CreateBidParams {
  agentId: string;
  askId: string;
  proposedPrice: number;
  estimatedDuration: number;
  proposal: string;
}

/**
 * Bid acceptance parameters
 */
export interface AcceptBidParams {
  agentId: string;
  askId: string;
  bidId: string;
}

/**
 * Delivery submission parameters
 */
export interface SubmitDeliveryParams {
  agentId: string;
  bidId: string;
  deliveryProof: any;
}

/**
 * Event listener type
 */
export type EventListener<T extends HarborEvent = HarborEvent> = (event: T['data']) => void;
