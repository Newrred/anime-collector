import { toPlatformAppHref } from "./search/memoryCardNavigation.js";
import { isSoftAppRoute } from "./appRoutes.js";

export function runAppNavigation({ href, currentHref, base = "/", native = false, replace = false, requestLeave,
  clientNavigate, assign, replaceLocation }) {
  let to, current;
  try { current = new URL(currentHref); to = new URL(href, current); } catch { return; }
  if (!["http:", "https:"].includes(to.protocol) || to.href === current.href || !requestLeave(to.href)) return;
  if (!native && to.origin === current.origin && isSoftAppRoute(to.pathname, base)) {
    return clientNavigate(to.href, { history: replace ? "replace" : "push" });
  }
  const target = toPlatformAppHref(to.href, { native, origin: current.origin });
  return replace ? replaceLocation(target) : assign(target);
}
