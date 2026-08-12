/**
 * @typedef {Object} MemoryRepository
 * @property {(ownerId: string, operationId: string) => Promise<Object|null>} getOperation
 * @property {(ownerId: string) => Promise<number>} countCompleteCards
 * @property {(reservation: Object) => Promise<void>} reserveCreate
 * @property {(completion: Object) => Promise<void>} completeCreate
 * @property {(failure: Object) => Promise<void>} failOperation
 */

/**
 * @typedef {Object} LocalMediaPort
 * @property {(input: {ticketId: string, assetId: string, operationId: string}) => Promise<Object>} promoteTicket
 */

/**
 * @typedef {Object} TelemetryPort
 * @property {(name: string, properties: Record<string, string|number|boolean>) => void} track
 */

export {};
