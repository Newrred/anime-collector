export function collectionLegacyHref({ kind, search = "", hash = "", base = "/" }) {
  const path = base.startsWith("/") && !base.startsWith("//") && !/[\\?#\u0000-\u0020]/.test(base) ? base : "/";
  const target = new URLSearchParams();
  if (kind === "home") {
    target.set("panel", hash === "#following" ? "following" : hash === "#safety" ? "safety" : "sharing");
  } else {
    const ids = new URLSearchParams(search).getAll("id");
    if (ids.length === 1 && ids[0] && ids[0].length <= 80) target.set("section", `MEMORY_BOARD:${ids[0]}`);
    else target.set("panel", "boards");
  }
  return `${path}?${target}`;
}
