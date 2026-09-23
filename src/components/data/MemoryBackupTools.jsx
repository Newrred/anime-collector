import { exportCatalogTitleBackup, validateCatalogTitleBackup, restoreCatalogTitleBackup } from "../../repositories/catalogTitleBackup.js";
import { useRef, useState } from "react";
import { getPlatformMemoryRuntime } from "../../features/memory/runtime/platformMemoryRuntime.js";
import { prepareMemoryRestore } from "../../features/memory/application/memoryBackup.js";

export default function MemoryBackupTools({ locale = "ko" }) {
  const actionLock = useRef(false);
  const ko = locale === "ko";
  const [candidate, setCandidate] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (action) => {
    if (actionLock.current) return; actionLock.current = true; setBusy(true); setMessage("");
    try { await action(await getPlatformMemoryRuntime()); }
    catch (error) {
      setMessage(error?.code === "BACKUP_REQUIRES_EMPTY_ARCHIVE"
        ? (ko ? "기억·보드가 없는 로컬 보관함에서만 복원할 수 있어요. 기존 기록은 변경하지 않았습니다." : "Restore requires an empty local archive. Existing records were not changed.")
        : error?.code === "BACKUP_GUEST_ONLY" ? (ko ? "계정에 연결되지 않은 로컬 보관함에서 복원해 주세요." : "Restore into a signed-out local archive.")
        : (ko ? "파일을 처리하지 못했어요. 파일과 저장소 상태를 확인해 주세요." : "Could not process the file. Check the file and storage state."));
    } finally { actionLock.current = false; setBusy(false); }
  };
  return <section className="surface-card manual-tools ui-panel-stack">
    <h2>{ko ? "기억·보드 백업" : "Memory and Board backup"}</h2>
    <p>{ko ? "기억의 감상·작품 연결·시스템 디자인·공식 표지 참조와 보드를 저장합니다. 개인 이미지 파일, 작품 저장·시청 상태, 기존 서재·티어는 포함하지 않습니다." : "Includes reflections, title links, system designs, official cover references and Boards. Excludes personal image files, saved-title/watch states, legacy Library and Tier."}</p>
    <button className="btn" disabled={busy} onClick={() => run(async (runtime) => {
      const snapshot = await runtime.exportMemoryBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot)], {type: "application/json"}));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `moemoa-memories-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(ko ? "백업 파일을 만들었어요. 이미지 파일은 별도로 보관해 주세요." : "Backup created. Keep your image files separately.");
    })}>{ko ? "기억·보드 파일 저장" : "Download Memory and Board backup"}</button>
    <details><summary>{ko ? "외부 ID 없는 저장 작품 백업" : "Saved titles without an external ID"}</summary>
      <p>{ko ? "기존 서재 백업에서 빠지는 자체 카탈로그 작품과 시청 상태·평점을 별도 보관합니다. 이 유형의 저장 작품이 없는 기기에만 복원합니다." : "Separately saves catalog-only titles and their status/rating. Restore only where no catalog-only titles are saved."}</p>
      <button className="btn btn--subtle" disabled={busy} onClick={() => run(async () => {
        const snapshot = await exportCatalogTitleBackup();
        const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot)], {type: "application/json"}));
        const a = document.createElement("a"); a.href = url; a.download = "moemoa-catalog-titles.json"; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage(ko ? "작품 백업 파일을 만들었어요." : "Title backup created.");
      })}>{ko ? "작품 상태 파일 저장" : "Download saved-title states"}</button>
    </details>
    <details><summary>{ko ? "백업 파일 복원" : "Restore backup file"}</summary>
      <p>{ko ? "기억·보드가 없는 비회원 로컬 보관함에 복원합니다. 이미지 파일은 복원되지 않으며, 공식 표지와 시스템 디자인은 다시 표시할 수 있습니다." : "Restore into an empty signed-out archive. Personal image files are not restored; official covers and system designs can be displayed again."}</p>
      <label>{ko ? "백업 파일 선택" : "Choose backup file"}<input type="file" accept=".json,application/json" disabled={busy} onChange={(event) => {
        const file = event.target.files?.[0]; event.target.value = ""; setCandidate(null);
        if (!file) return;
        run(async (runtime) => {
          if (file.size > 20 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
          const snapshot = JSON.parse(await file.text());
          const owner = await runtime.initialize();
          if (snapshot.format === "moemoa-catalog-saved-titles") validateCatalogTitleBackup(snapshot);
          else prepareMemoryRestore(snapshot, owner.id);
          setCandidate(snapshot);
        });
      }} /></label>
      {candidate ? <div><p>{candidate.format === "moemoa-catalog-saved-titles" ? `${candidate.titles.length} ${ko ? "작품" : "titles"}` : ko ? `기억 ${candidate.data.memory_cards.length}개 · 보드 ${candidate.data.memory_boards.length}개를 복원합니다.` : `Restore ${candidate.data.memory_cards.length} Memories and ${candidate.data.memory_boards.length} Boards.`}</p>
        <button className="btn" disabled={busy} onClick={() => run(async (runtime) => { if (candidate.format === "moemoa-catalog-saved-titles") await restoreCatalogTitleBackup(candidate); else await runtime.restoreMemoryBackup(candidate); setCandidate(null); setMessage(ko ? "선택한 파일을 복원했어요." : "Selected backup restored."); })}>{ko ? "내용 확인 후 복원" : "Confirm restore"}</button>
        <button className="btn btn--subtle" disabled={busy} onClick={() => { setCandidate(null); setMessage(""); }}>{ko ? "취소" : "Cancel"}</button>
      </div> : null}
    </details>
    <p role="status">{message}</p>
  </section>;
}
