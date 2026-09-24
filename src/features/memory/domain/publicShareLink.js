import { isPublicationId } from "./publicationView.js";

// Construct from the public identifier, never from the current page's query or tokens.
export function publicShareLink({ kind, id, base = "/", origin, native = false }) {
  if (!["home", "board"].includes(kind) || !isPublicationId(id)) throw new Error("INVALID_PUBLIC_LINK");
  const target = new URL(native ? "https://www.moemoa.xyz" : origin);
  if (!["http:", "https:"].includes(target.protocol)) throw new Error("INVALID_PUBLIC_LINK");
  const segment = String(base).replace(/^\/+|\/+$/g, "");
  const prefix = native || !segment ? "/" : `/${segment}/`;
  return `${target.origin}${prefix}public/${kind}/?id=${encodeURIComponent(id)}`;
}
