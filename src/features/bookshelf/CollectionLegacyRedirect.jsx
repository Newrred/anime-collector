import { useEffect } from "react";
import { useUiPreferences } from "../../hooks/useUiPreferences.js";
import { collectionLegacyHref } from "./collectionLegacyRoute.js";

export default function CollectionLegacyRedirect({ kind, base }) {
  const { locale } = useUiPreferences();
  const href = collectionLegacyHref({ kind, base, search: globalThis.location?.search, hash: globalThis.location?.hash });
  useEffect(() => { location.replace(href); }, [href]);
  return <main className="page-shell"><p role="status">{locale === "ko" ? "컬렉션을 열고 있습니다…" : "Opening your collection…"}</p><a href={href}>{locale === "ko" ? "컬렉션 열기" : "Open collection"}</a></main>;
}
