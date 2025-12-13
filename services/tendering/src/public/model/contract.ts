import { Temporal } from 'temporal-polyfill';
import { ContractStatus } from './contractStatus';

export interface Contract {
    id: string,
    askId: string,
    bidId: string,
    escrowWalletId: string,
    amount: number,
    deliveryDeadline: Temporal.ZonedDateTime,
    status: ContractStatus,
    deliveredAt: Temporal.ZonedDateTime,
    completedAt: Temporal.ZonedDateTime,
    createdAt: Temporal.ZonedDateTime 
    delivery?: JSON // TODO make more structured
}

/**
 * TODO should we add buyerAgentId, sellerAgentId? Or use joins? 
 * We can get their agent and that agent's wallet from the ask itself
 * 
 * TODO we should also have separate records for what we pull from the DB,
 * which we can map to these models.
 */