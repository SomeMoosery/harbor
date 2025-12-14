import { AgentType } from '../model/agentType.js';

export interface CreateAgentRequest {
  name: string;
  capabilities: Record<string, unknown>;
  type: AgentType;
}
