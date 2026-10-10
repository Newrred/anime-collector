import { useMemoryReturnNavigation } from "../../../hooks/useMemoryReturnNavigation.js";
import { Fragment, createContext, useContext, useMemo } from "react";
import TopNavDataMenu from "../../../components/TopNavDataMenu.jsx";
import { getMessageGroup } from "../../../domain/messages.js";
import { useUiPreferences } from "../../../hooks/useUiPreferences.js";

import { useMemoryOwnerBoundary } from "../../../hooks/useMemoryOwnerBoundary.js";

const MemoryRouteUiContext = createContext(null);

export function useMemoryRouteUi() {
  const value = useContext(MemoryRouteUiContext);
  if (!value) throw new Error("Memory route content must be rendered inside MemoryRouteShell.");
  return value;
}

function MemoryRouteFrame({ base = "/", currentRoute = "", children, owner }) {
  const { theme, locale, setTheme, setLocale } = useUiPreferences();
  useMemoryReturnNavigation(base);
  const copy = getMessageGroup(locale, "memoryRoutes");
  const contextValue = useMemo(() => ({ locale, copy, ownerKey: owner.ownerKey }), [locale, copy, owner.ownerKey]);

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
        {owner.ready ? <Fragment key={owner.ownerKey}>{children}</Fragment> : <p role={owner.failed ? "alert" : "status"}>
          {owner.failed ? (locale === "ko" ? "계정을 확인하지 못했습니다. 상단 계정 메뉴에서 다시 시도해 주세요." : "Account could not be verified. Retry from the account menu.")
            : (locale === "ko" ? "보관함을 확인하고 있어요." : "Checking your archive.")}
        </p>}
      </div>
    </MemoryRouteUiContext.Provider>
  );
}

function OwnerBoundRouteShell(props) {
  const owner = useMemoryOwnerBoundary();
  return <MemoryRouteFrame {...props} owner={owner} />;
}

const UNBOUND_OWNER = Object.freeze({ ready: true, failed: false, ownerKey: "service" });

export default function MemoryRouteShell({ accountBoundary = true, ...props }) {
  // Service administration has its own authenticated RPC boundary and must not
  // require personal archive initialization. Existing memory routes keep it.
  return accountBoundary
    ? <OwnerBoundRouteShell {...props} />
    : <MemoryRouteFrame {...props} owner={UNBOUND_OWNER} />;
}
