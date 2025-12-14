export const agentTypeValues = ['BUYER', 'SELLER', 'DUAL'] as const;
export type AgentType = typeof agentTypeValues[number];
