export interface CreateAskRequest {
    title: string;
    description: string;
    requirements: Record<string, unknown>; // TODO stronger type
    minBudget: number;
    maxBudget: number;
    budgetFlexibilityAmount?: number;
  }