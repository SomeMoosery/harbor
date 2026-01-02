import type { Logger } from '@harbor/logger';
import type { Sql } from 'postgres';
import { NotFoundError } from '@harbor/errors';
import { Bid } from '../../public/model/bid.js';
import { BidStatus } from '../../public/model/bidStatus.js';
import { BidRecord } from '../records/bidRecord.js';
import { Temporal } from 'temporal-polyfill';

interface BidRow {
  id: string;
  ask_id: string;
  agent_id: string;
  proposed_price: number;
  estimated_duration: number;
  proposal: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class BidResource {
  constructor(
    private readonly sql: Sql,
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

    const [bidRow] = await this.sql<BidRow[]>`
      INSERT INTO bids (
        ask_id, agent_id, proposed_price, estimated_duration, proposal, status
      )
      VALUES (
        ${data.askId},
        ${data.agentId},
        ${data.proposedPrice},
        ${data.estimatedDuration},
        ${data.proposal},
        'PENDING'
      )
      RETURNING *
    `;

    if (!bidRow) {
      throw new Error('Failed to create bid');
    }

    const record = this.rowToRecord(bidRow);
    return this.recordToBid(record);
  }

  async findById(id: string): Promise<Bid> {
    const [bidRow] = await this.sql<BidRow[]>`
      SELECT * FROM bids
      WHERE id = ${id}
    `;

    if (!bidRow) {
      throw new NotFoundError('Bid', id);
    }

    const record = this.rowToRecord(bidRow);
    return this.recordToBid(record);
  }

  async findByAskId(askId: string): Promise<Bid[]> {
    const result = await this.sql<BidRow[]>`
      SELECT * FROM bids
      WHERE ask_id = ${askId}
        AND deleted_at IS NULL
    `;

    return result.map((row) => {
      const record = this.rowToRecord(row);
      return this.recordToBid(record);
    });
  }

  async findByAgentId(agentId: string): Promise<Bid[]> {
    const result = await this.sql<BidRow[]>`
      SELECT * FROM bids
      WHERE agent_id = ${agentId}
        AND deleted_at IS NULL
    `;

    return result.map((row) => {
      const record = this.rowToRecord(row);
      return this.recordToBid(record);
    });
  }

  async updateStatus(id: string, status: BidStatus): Promise<Bid> {
    const [bidRow] = await this.sql<BidRow[]>`
      UPDATE bids
      SET status = ${status},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!bidRow) {
      throw new NotFoundError('Bid', id);
    }

    const record = this.rowToRecord(bidRow);
    return this.recordToBid(record);
  }

  async rejectOtherBids(askId: string, _acceptedBidId: string): Promise<void> {
    // TODO There should be a more transactional method that picks the winning bid and then rejects the others, again, TRANSACTIONALLY
    await this.sql`
      UPDATE bids
      SET status = 'REJECTED',
          updated_at = NOW()
      WHERE ask_id = ${askId}
        AND status = 'PENDING'
        AND deleted_at IS NULL
    `;
  }

  private rowToRecord(row: BidRow): BidRecord {
    return {
      id: row.id,
      askId: row.ask_id,
      agentId: row.agent_id,
      proposedPrice: row.proposed_price ?? 0,
      estimatedDuration: row.estimated_duration ?? 0,
      proposal: row.proposal,
      status: row.status as BidStatus,
      createdAt: Temporal.Instant.fromEpochMilliseconds(row.created_at.getTime()).toZonedDateTimeISO('UTC'),
      updatedAt: Temporal.Instant.fromEpochMilliseconds(row.updated_at.getTime()).toZonedDateTimeISO('UTC'),
      deletedAt: row.deleted_at
        ? Temporal.Instant.fromEpochMilliseconds(row.deleted_at.getTime()).toZonedDateTimeISO('UTC')
        : undefined,
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
