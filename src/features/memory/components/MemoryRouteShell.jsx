import { createContext, useContext, useMemo } from "react";
import TopNavDataMenu from "../../../components/TopNavDataMenu.jsx";
import { getMessageGroup } from "../../../domain/messages.js";
import { useUiPreferences } from "../../../hooks/useUiPreferences.js";

const MemoryRouteUiContext = createContext(null);

export function useMemoryRouteUi() {
  const value = useContext(MemoryRouteUiContext);
  if (!value) throw new Error("Memory route content must be rendered inside MemoryRouteShell.");
  return value;
}

export default function MemoryRouteShell({ base = "/", currentRoute = "", children }) {
  const { theme, locale, setTheme, setLocale } = useUiPreferences();
  const copy = getMessageGroup(locale, "memoryRoutes");
  const contextValue = useMemo(() => ({ locale, copy }), [locale, copy]);

  return (
    <MemoryRouteUiContext.Provider value={contextValue}>
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
    </MemoryRouteUiContext.Provider>
  );
}
