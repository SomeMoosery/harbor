export enum BidStatus {
  PENDING,
  ACCEPTED,
  REJECTED,
}

/**
 * Converts a BidStatus enum value to its string name (e.g., BidStatus.PENDING -> "PENDING")
 * Uses TypeScript's built-in reverse mapping for numeric enums
 */
export function bidStatusToString(status: BidStatus): 'PENDING' | 'ACCEPTED' | 'REJECTED' {
  return BidStatus[status] as 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

/**
 * Converts a string to BidStatus enum value (e.g., "PENDING" -> BidStatus.PENDING)
 */
export function stringToBidStatus(status: string): BidStatus {
  switch (status) {
    case 'PENDING':
      return BidStatus.PENDING;
    case 'ACCEPTED':
      return BidStatus.ACCEPTED;
    case 'REJECTED':
      return BidStatus.REJECTED;
    default:
      return BidStatus.PENDING;
  }
}