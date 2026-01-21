/**
 * User type determines the primary role of the account
 * HUMAN - Can create and manage agents
 * AGENT - Simplified experience, can create wallets
 * UNKNOWN - Initial state before onboarding completion
 */
export const userTypeValues = ['HUMAN', 'AGENT', 'UNKNOWN'] as const;
export type UserType = (typeof userTypeValues)[number];

/**
 * Sub-type provides more specific categorization
 * For HUMAN users: BUSINESS or PERSONAL
 * For AGENT users: AUTONOMOUS (currently the only option)
 */
export const subTypeValues = ['BUSINESS', 'PERSONAL', 'AUTONOMOUS'] as const;
export type SubType = (typeof subTypeValues)[number];
