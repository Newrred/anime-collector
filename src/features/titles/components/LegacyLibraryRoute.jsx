import { lazy, Suspense, useEffect, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { resolveLegacyLibraryHref } from "../domain/titleNavigation.js";
import { navigateWithinApp } from "../../../lib/appNavigation.js";

const Library = lazy(() => import("../../../components/Library.jsx"));

export default function LegacyLibraryRoute({ base = "/" }) {
  const href = useMemo(() => resolveLegacyLibraryHref({
    base, search: window.location.search, native: Capacitor.isNativePlatform(),
  }), [base]);
  useEffect(() => {
    if (href) navigateWithinApp(href, { replace: true, base });
  }, [href, base]);
  if (href) return null;
  return <Suspense fallback={null}><Library /></Suspense>;
}
