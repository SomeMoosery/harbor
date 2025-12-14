export const bidStatusValues = ['PENDING', 'ACCEPTED', 'REJECTED'] as const;
export type BidStatus = typeof bidStatusValues[number];