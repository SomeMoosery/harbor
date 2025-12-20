import { AskStatus } from "./askStatus";

export interface Ask {
  id: string;
  title: string;
  description: string;
  requirements: Record<string, unknown>;
  minBudget: number;
  maxBudget: number;
  budgetFlexibilityAmount?: number;
  createdBy: string;
  status: AskStatus;
  deliveryData?: Record<string, unknown>; // From in-memory cache, not database
}