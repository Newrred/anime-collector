export const TICKET_CLEANUP_STORAGE_KEY = "moemoa:pending-ticket-cleanup:v1";

const SAFE_TICKET_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const MAX_PENDING_TICKETS = 32;

const defaultStorage = () => {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
};

export function createDeferredTicketCleanup({ storage = defaultStorage() } = {}) {
  const read = () => {
    if (!storage) return [];
    try {
      const parsed = JSON.parse(storage.getItem(TICKET_CLEANUP_STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return [...new Set(parsed.map(String).filter((id) => SAFE_TICKET_ID.test(id)))]
        .slice(0, MAX_PENDING_TICKETS);
    } catch {
      return [];
    }
  };

  const write = (ticketIds) => {
    if (!storage) return false;
    try {
      if (ticketIds.length === 0) storage.removeItem(TICKET_CLEANUP_STORAGE_KEY);
      else storage.setItem(TICKET_CLEANUP_STORAGE_KEY, JSON.stringify(ticketIds));
      return true;
    } catch {
      return false;
    }
  };

  return Object.freeze({
    defer(ticketId) {
      const safeId = String(ticketId || "");
      if (!SAFE_TICKET_ID.test(safeId)) return false;
      const pending = read().filter((id) => id !== safeId);
      pending.push(safeId);
      return write(pending.slice(-MAX_PENDING_TICKETS));
    },

    forget(ticketId) {
      const safeId = String(ticketId || "");
      if (!SAFE_TICKET_ID.test(safeId)) return false;
      return write(read().filter((id) => id !== safeId));
    },

    async flush(discard) {
      const retained = [];
      let removed = 0;
      for (const ticketId of read()) {
        try {
          if (await discard(ticketId) === true) removed += 1;
          else retained.push(ticketId);
        } catch {
          retained.push(ticketId);
        }
      }
      write(retained);
      return { removed, pending: retained.length };
    },
  });
}
