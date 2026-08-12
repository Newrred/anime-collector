const SAFE_TICKET_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const SAFE_ASSET_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const SAFE_OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SAFE_LOCAL_REF = /^asset:([A-Za-z0-9][A-Za-z0-9_-]{0,63})$/;
const SHA_256 = /^[a-f0-9]{64}$/;
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

export function sanitizeLocalMediaResult(value) {
  if (!value || typeof value !== "object" || value.localOnly !== true) return null;
  const localRef = String(value.localRef || "");
  const checksumSha256 = String(value.checksumSha256 || "").toLowerCase();
  const mimeType = String(value.mimeType || "").toLowerCase();
  const byteSize = finiteInteger(value.byteSize);
  const width = finiteInteger(value.width);
  const height = finiteInteger(value.height);
  if (!SAFE_LOCAL_REF.test(localRef) || !SHA_256.test(checksumSha256)) return null;
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) return null;
  if (byteSize == null || byteSize < 1 || width == null || width < 1 || height == null || height < 1) {
    return null;
  }
  return { localRef, checksumSha256, mimeType, byteSize, width, height };
}

const sanitizePreviewDataUrl = (value) => {
  const previewDataUrl = String(value || "");
  if (previewDataUrl.length > MAX_PREVIEW_DATA_URL_LENGTH || !JPEG_DATA_URL.test(previewDataUrl)) {
    return null;
  }
  return previewDataUrl;
};

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

    async promoteTicket({ ticketId, assetId, operationId }) {
      const safeTicketId = String(ticketId || "");
      const safeAssetId = String(assetId || "");
      const safeOperationId = String(operationId || "");
      if (
        !SAFE_TICKET_ID.test(safeTicketId) ||
        !SAFE_ASSET_ID.test(safeAssetId) ||
        !SAFE_OPERATION_ID.test(safeOperationId)
      ) {
        throw Object.assign(new Error("Invalid private media promotion request"), {
          code: "INVALID_MEDIA_PROMOTION",
        });
      }
      const result = sanitizeLocalMediaResult(await plugin.promoteIntake({
        ticketId: safeTicketId,
        assetId: safeAssetId,
        operationId: safeOperationId,
      }));
      if (!result) {
        throw Object.assign(new Error("Invalid private media promotion result"), {
          code: "MEDIA_RESULT_INVALID",
        });
      }
      return result;
    },

    async getPreview(localRef) {
      const safeLocalRef = String(localRef || "");
      if (!SAFE_LOCAL_REF.test(safeLocalRef)) return null;
      const result = await plugin.getAssetPreview({ localRef: safeLocalRef });
      return sanitizePreviewDataUrl(result?.previewDataUrl);
    },

    async deleteAsset(value) {
      const localRef = typeof value === "string" ? value : value?.localRef;
      const safeLocalRef = String(localRef || "");
      if (!SAFE_LOCAL_REF.test(safeLocalRef)) return false;
      const result = await plugin.deleteAsset({ localRef: safeLocalRef });
      return result?.deleted === true;
    },
  };
}
