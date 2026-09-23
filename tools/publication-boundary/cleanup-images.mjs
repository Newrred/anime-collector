import { cleanupPublicImages } from "../../src/server/publicImages/handler.js";
import { createSupabaseImageBackend } from "../../src/server/publicImages/supabaseImageBackend.js";
if (!process.argv.includes("--apply")) throw new Error("Explicit --apply is required; use only the approved environment.");
const result = await cleanupPublicImages(createSupabaseImageBackend());
console.log(JSON.stringify(result));
if (result.failed) process.exitCode = 1;
