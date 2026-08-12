import { Capacitor, registerPlugin } from "@capacitor/core";
import { createCapacitorImageIntake } from "./capacitorImageIntake.js";

const unavailableAdapter = Object.freeze({
  available: false,
  claim: async () => ({ ticket: null, processing: false, errorCode: null }),
  pick: async () => ({ ticket: null, cancelled: true }),
  discard: async () => false,
});

export function createPlatformImageIntake() {
  if (!Capacitor.isNativePlatform()) return unavailableAdapter;
  return createCapacitorImageIntake(registerPlugin("ImageIntake"));
}
