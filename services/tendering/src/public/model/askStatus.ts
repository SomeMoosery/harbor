export const askStatusValues = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type AskStatus = typeof askStatusValues[number];