import { eq, and, isNull } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { getDb, bids, type BidRow } from '../store/index.js';
import { Bid } from '../../public/model/bid.js';
import { BidStatus, bidStatusToString, stringToBidStatus } from '../../public/model/bidStatus.js';
import { BidRecord } from '../records/bidRecord.js';

export class BidResource {
  constructor(
    private readonly db: ReturnType<typeof getDb>,
    private readonly logger: Logger
  ) {}

  async create(data: {
    askId: string;
    agentId: string;
    proposedPrice: number;
    estimatedDuration: number;
    proposal: string;
  }): Promise<Bid> {
    this.logger.info({ data }, 'Creating bid');

    const [bidRow] = await this.db
      .insert(bids)
      .values({
        ...data,
        status: 'PENDING',
      })
      .returning();

    if (!bidRow) {
      throw new Error('Failed to create bid');
    }

    const record = this.rowToRecord(bidRow);
    return this.recordToBid(record);
  }

  async findById(id: string): Promise<Bid> {
    const [bidRow] = await this.db
      .select()
      .from(bids)
      .where(eq(bids.id, id));

    if (!bidRow) {
      throw new NotFoundError('Bid', id);
    }

    const record = this.rowToRecord(bidRow);
    return this.recordToBid(record);
  }

  async findByAskId(askId: string): Promise<Bid[]> {
    const result = await this.db
      .select()
      .from(bids)
      .where(and(eq(bids.askId, askId), isNull(bids.deletedAt)));

    return result.map((row) => {
      const record = this.rowToRecord(row);
      return this.recordToBid(record);
    });
  }

  async findByAgentId(agentId: string): Promise<Bid[]> {
    const result = await this.db
      .select()
      .from(bids)
      .where(and(eq(bids.agentId, agentId), isNull(bids.deletedAt)));

    return result.map((row) => {
      const record = this.rowToRecord(row);
      return this.recordToBid(record);
    });
  }

  async updateStatus(id: string, status: BidStatus): Promise<Bid> {
    const statusString = bidStatusToString(status);
    const [bidRow] = await this.db
      .update(bids)
      .set({ status: statusString, updatedAt: new Date() })
      .where(eq(bids.id, id))
      .returning();

    if (!bidRow) {
      throw new NotFoundError('Bid', id);
    }

    const record = this.rowToRecord(bidRow);
    return this.recordToBid(record);
  }

  async rejectOtherBids(askId: string, _acceptedBidId: string): Promise<void> {
    await this.db
      .update(bids)
      .set({ status: 'REJECTED', updatedAt: new Date() })
      .where(
        and(
          eq(bids.askId, askId),
          eq(bids.status, 'PENDING'),
          isNull(bids.deletedAt)
        )
      );
  }

  private rowToRecord(row: BidRow): BidRecord {
    return {
      id: row.id,
      askId: row.askId,
      agentId: row.agentId,
      proposedPrice: row.proposedPrice ?? 0,
      estimatedDuration: row.estimatedDuration ?? 0,
      proposal: row.proposal,
      status: stringToBidStatus(row.status),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt ?? null,
    };
  }

  private recordToBid(record: BidRecord): Bid {
    return {
      id: record.id,
      askId: record.askId,
      agentId: record.agentId,
      proposedPrice: record.proposedPrice,
      estimatedDuration: record.estimatedDuration,
      proposal: record.proposal,
      status: record.status,
    };
  }

}
