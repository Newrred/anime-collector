const SAFE_TICKET_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const JPEG_DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_PREVIEW_DATA_URL_LENGTH = 3_000_000;

const finiteInteger = (value) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};

export function sanitizeNativeTicket(value) {
  if (!value || typeof value !== "object") return null;

  const ticketId = String(value.ticketId || "");
  const mimeType = String(value.mimeType || "").toLowerCase();
  const previewDataUrl = String(value.previewDataUrl || "");
  const byteSize = finiteInteger(value.byteSize);
  const width = finiteInteger(value.width);
  const height = finiteInteger(value.height);
  const createdAtEpochMs = finiteInteger(value.createdAtEpochMs);

  if (!SAFE_TICKET_ID.test(ticketId)) return null;
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) return null;
  if (byteSize == null || width == null || height == null || createdAtEpochMs == null) return null;
  if (width < 1 || height < 1) return null;
  if (previewDataUrl.length > MAX_PREVIEW_DATA_URL_LENGTH || !JPEG_DATA_URL.test(previewDataUrl)) return null;
  if (value.localOnly !== true) return null;

  return {
    ticketId,
    mimeType,
    byteSize,
    width,
    height,
    createdAtEpochMs,
    previewDataUrl,
    localOnly: true,
  };
}

export function createCapacitorImageIntake(plugin) {
  if (!plugin) throw new TypeError("A native ImageIntake plugin is required");

  return {
    available: true,

    async claim() {
      const result = await plugin.claimPendingIntake();
      return {
        ticket: sanitizeNativeTicket(result?.ticket),
        processing: result?.processing === true,
        errorCode: result?.errorCode ? String(result.errorCode) : null,
      };
    },

    async pick() {
      const result = await plugin.pickImage();
      return {
        ticket: sanitizeNativeTicket(result?.ticket),
        cancelled: result?.cancelled === true,
      };
    },

    async discard(ticketId) {
      if (!SAFE_TICKET_ID.test(String(ticketId || ""))) return false;
      const result = await plugin.discardIntake({ ticketId });
      return result?.removed === true;
    },
  };
}
