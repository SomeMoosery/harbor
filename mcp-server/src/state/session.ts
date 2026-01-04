/**
 * In-memory session state management
 */

export interface SessionState {
  apiKey: string | null;
  userId: string | null;
  agentId: string | null;
  activeAskId: string | null;
}

class SessionManager {
  private state: SessionState = {
    apiKey: null,
    userId: null,
    agentId: null,
    activeAskId: null,
  };

  initialize(apiKey: string, userId: string, agentId: string): void {
    this.state = {
      apiKey,
      userId,
      agentId,
      activeAskId: null,
    };
  }

  setActiveAsk(askId: string): void {
    this.state.activeAskId = askId;
  }

  clearActiveAsk(): void {
    this.state.activeAskId = null;
  }

  getState(): Readonly<SessionState> {
    return { ...this.state };
  }

  isAuthenticated(): boolean {
    return this.state.userId !== null && this.state.agentId !== null;
  }

  clear(): void {
    this.state = {
      apiKey: null,
      userId: null,
      agentId: null,
      activeAskId: null,
    };
  }
}

export const session = new SessionManager();
