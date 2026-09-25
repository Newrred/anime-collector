import { Capacitor, registerPlugin } from "@capacitor/core";
import { createCapacitorImageIntake } from "./capacitorImageIntake.js";
import { createWebImageIntake } from "./webImageIntake.js";

const unavailableAdapter = Object.freeze({
  available: false,
  claim: async () => ({ ticket: null, processing: false, errorCode: null }),
  pick: async () => ({ ticket: null, cancelled: true }),
  discard: async () => false,
  promoteTicket: async () => {
    throw Object.assign(new Error("Private media is only available in the Android app"), {
      code: "NATIVE_MEDIA_UNAVAILABLE",
    });
  },
  getPreview: async () => null,
  deleteAsset: async () => false,
});

export function createPlatformImageIntake() {
  if (!Capacitor.isNativePlatform()) return import.meta.env.PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1 === '1'
    ? createWebImageIntake() : unavailableAdapter;
  return createCapacitorImageIntake(registerPlugin("ImageIntake"));
}
