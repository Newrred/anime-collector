/**
 * @typedef {Object} MemoryRepository
 * @property {(ownerId: string, operationId: string) => Promise<Object|null>} getOperation
 * @property {(ownerId: string) => Promise<number>} countCompleteCards
 * @property {(reservation: Object) => Promise<void>} reserveCreate
 * @property {(completion: Object) => Promise<void>} completeCreate
 * @property {(reservation: Object) => Promise<void>} reserveReplace
 * @property {(completion: Object) => Promise<void>} commitReplace
 * @property {(completion: Object) => Promise<void>} completeReplace
 * @property {(input: {ownerId: string, cardId: string, changes: Object, now: string}) => Promise<Object>} updateCardMetadata
 * @property {(failure: Object) => Promise<void>} failOperation
 * @property {(sourceKey: string) => Promise<Object|null>} findAnimeRefBySourceKey
 */

/**
 * @typedef {Object} TitleResolverPort
 * @property {(query: string) => Promise<{results: Object[], remoteStatus: string}>} search
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
