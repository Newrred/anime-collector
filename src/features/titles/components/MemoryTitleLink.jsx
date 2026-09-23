import { Capacitor } from "@capacitor/core";
import { buildMemoryTitleHubHref } from "../domain/titleNavigation.js";

export default function MemoryTitleLink({ bundle, base, label, className = "" }) {
  const href = buildMemoryTitleHubHref({ bundle, base, native: Capacitor.isNativePlatform() });
  if (!href) return null;
  return <a className={`btn btn--subtle ${className}`} href={href} data-astro-reload>{label}</a>;
}
