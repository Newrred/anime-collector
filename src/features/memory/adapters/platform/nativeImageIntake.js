import { Capacitor, registerPlugin } from "@capacitor/core";
import { createCapacitorImageIntake } from "./capacitorImageIntake.js";

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
  if (!Capacitor.isNativePlatform()) return unavailableAdapter;
  return createCapacitorImageIntake(registerPlugin("ImageIntake"));
}
