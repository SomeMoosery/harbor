export const userTypeValues = ['BUSINESS', 'PERSONAL'] as const;
export type UserType = typeof userTypeValues[number];
