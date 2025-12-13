export enum AskStatus {
  OPEN,
  IN_PROGRESS,
  COMPLETED,
  CANCELLED,
}

/**
 * Converts an AskStatus enum value to its string name (e.g., AskStatus.OPEN -> "OPEN")
 * Uses TypeScript's built-in reverse mapping for numeric enums
 */
export function askStatusToString(status: AskStatus): 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' {
  return AskStatus[status] as 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

/**
 * Converts a string to AskStatus enum value (e.g., "OPEN" -> AskStatus.OPEN)
 */
export function stringToAskStatus(status: string): AskStatus {
  switch (status) {
    case 'OPEN':
      return AskStatus.OPEN;
    case 'IN_PROGRESS':
      return AskStatus.IN_PROGRESS;
    case 'COMPLETED':
      return AskStatus.COMPLETED;
    case 'CANCELLED':
      return AskStatus.CANCELLED;
    default:
      return AskStatus.OPEN;
  }
}