import { useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { publicShareLink } from "../domain/publicShareLink.js";

export default function PublicLinkCopy({ kind, id, locale, base = "/" }) {
  const ko = locale === "ko", pending = useRef(false);
  const [state, setState] = useState("");
  const url = publicShareLink({ kind, id, base, origin: globalThis.location?.origin || "https://www.moemoa.xyz", native: Capacitor.isNativePlatform() });
  async function copy() {
    if (pending.current) return;
    pending.current = true; setState("busy");
    try { await navigator.clipboard.writeText(url); setState("copied"); }
    catch { setState("failed"); }
    finally { pending.current = false; }
  }
  return <div className="memory-public-link">
    <button type="button" className="btn btn--subtle" disabled={state === "busy"} onClick={copy}>{ko ? "공개 주소 복사" : "Copy public link"}</button>
    {state === "copied" && <p role="status">{ko ? "공개 주소를 복사했습니다." : "Public link copied."}</p>}
    {state === "failed" && <><p role="alert">{ko ? "자동 복사를 허용하지 않아 주소를 직접 선택해 복사해 주세요." : "Copy was unavailable. Select and copy the address below."}</p><input aria-label={ko ? "공개 주소" : "Public address"} readOnly value={url} onFocus={(event) => event.target.select()} style={{ width: "100%", minWidth: 0, minHeight: 44, padding: "8px", font: "inherit", color: "inherit", background: "transparent", border: "1px solid currentColor", borderRadius: 8 }} /></>}
  </div>;
}
