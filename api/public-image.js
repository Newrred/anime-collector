import { createPublicImageHandler } from "../src/server/publicImages/handler.js";
import { createSupabaseImageBackend } from "../src/server/publicImages/supabaseImageBackend.js";

export default createPublicImageHandler({
  enabled: process.env.MOEMOA_PUBLIC_IMAGE_API_ENABLED === "true",
  createBackend: () => createSupabaseImageBackend(),
  allowedOrigins: (process.env.MOEMOA_PUBLIC_IMAGE_ALLOWED_ORIGINS || "").split(",").map(x=>x.trim()).filter(Boolean),
});
