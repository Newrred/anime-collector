import { navigate } from "astro:transitions/client";
import { Capacitor } from "@capacitor/core";
import { runAppNavigation } from "../domain/appNavigation.js";

export function navigateWithinApp(href, { replace = false, base = import.meta.env.BASE_URL || "/" } = {}) {
  return runAppNavigation({ href, currentHref: location.href, base, replace, native: Capacitor.isNativePlatform(),
    requestLeave: target => window.dispatchEvent(new CustomEvent("moemoa:before-navigate", { cancelable: true, detail: { href: target } })),
    clientNavigate: navigate, assign: target => location.assign(target), replaceLocation: target => location.replace(target) });
}
