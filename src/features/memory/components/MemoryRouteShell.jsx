import TopNavDataMenu from "../../../components/TopNavDataMenu.jsx";
import { useUiPreferences } from "../../../hooks/useUiPreferences.js";

export default function MemoryRouteShell({ base = "/", currentRoute = "", children }) {
  const { theme, locale, setTheme, setLocale } = useUiPreferences();

  return (
    <div className="memory-route-shell">
      <TopNavDataMenu
        base={base}
        panelId={`${currentRoute || "memory"}-data-menu-panel`}
        currentRoute={currentRoute}
        locale={locale}
        theme={theme}
        onToggleLocale={(nextLocale) => setLocale(nextLocale || (locale === "ko" ? "en" : "ko"))}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      />
      {children}
    </div>
  );
}
