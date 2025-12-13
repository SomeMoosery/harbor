export interface CreateBidRequest {
    askId: string,
    proposedPrice: number,
    estimatedDuration: number, // milliseconds
    proposal: string // something the buyer LLM can decide on
}