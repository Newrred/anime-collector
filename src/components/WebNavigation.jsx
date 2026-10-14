import { useEffect, useState } from "react";
import { useUiPreferences } from "../hooks/useUiPreferences.js";
import TopNavDataMenu from "./TopNavDataMenu.jsx";

export default function WebNavigation({ base, currentRoute }) {
  const { locale, theme, setLocale, setTheme } = useUiPreferences();
  const [canInstall, setCanInstall] = useState(false);
  useEffect(() => {
    const ready = () => setCanInstall(typeof window.__promptPwaInstall === "function");
    const installed = () => setCanInstall(false);
    ready(); window.addEventListener("pwa-install-ready", ready); window.addEventListener("appinstalled", installed);
    return () => { window.removeEventListener("pwa-install-ready", ready); window.removeEventListener("appinstalled", installed); };
  }, []);
  return <TopNavDataMenu shared base={base} currentRoute={currentRoute} locale={locale} theme={theme} canInstallPwa={canInstall}
    onToggleLocale={next => setLocale(next || (locale === "ko" ? "en" : "ko"))}
    onToggleTheme={() => setTheme(current => current === "dark" ? "light" : "dark")} />;
}
