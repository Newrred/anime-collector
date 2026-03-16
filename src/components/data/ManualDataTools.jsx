import { useRef, useState } from "react";
import { dedupeByAnilistId, normalizeImportList } from "../../domain/animeState.js";
import { getMessageGroup } from "../../domain/messages.js";
import {
  downloadSnapshotJson,
  encodeSyncSnapshot,
  exportSyncSnapshot,
  normalizeSyncSnapshot,
} from "../../domain/snapshotCodec.js";
import {
  mergeTierTopicBundles,
  normalizeTierTopicBundle,
} from "../../domain/tierTopics.js";
import { markManualBackupExported } from "../../repositories/backupRepo.js";
import {
  mergeCharacterPins,
  replaceCharacterPins,
} from "../../repositories/characterPinRepo.js";
import {
  readLibraryListPreferred,
  writeLibraryList,
} from "../../repositories/libraryRepo.js";
import { markLocalDirty } from "../../repositories/syncRepo.js";
import {
  readTierBoardBundle,
  writeTierBoardBundle,
} from "../../repositories/tierRepo.js";
import {
  mergeWatchLogs,
  replaceWatchLogs,
} from "../../repositories/watchLogRepo.js";
import { writeJson } from "../../storage/localJsonStore.js";
import { STORAGE_KEYS } from "../../storage/keys.js";
import {
  IconClipboard,
  IconFile,
  IconMobile,
  IconUpload,
  IconDownload,
} from "../ui/AppIcons.jsx";

function SegTabButton({ active, onClick, children, className = "", ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`data-menu-seg-btn${active ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      aria-pressed={active}
      {...props}
    >
      <span className="data-menu-seg-label">{children}</span>
    </button>
  );
}

function ActionLabel({ icon, children }) {
  return (
    <span className="data-menu-action-label">
      {icon}
      <span>{children}</span>
    </span>
  );
}

export default function ManualDataTools({ locale = "ko", onChanged }) {
  const copy = getMessageGroup(locale, "dataCenter");
  const fileRef = useRef(null);
  const [tab, setTab] = useState("export");
  const [importMode, setImportMode] = useState("merge");
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");

  async function finishWithMessage(nextMessage) {
    markManualBackupExported(new Date().toISOString());
    setMessage(nextMessage);
    if (typeof onChanged === "function") {
      await onChanged();
    }
  }

  async function exportBackupFile() {
    const payload = await exportSyncSnapshot();
    const date = new Date().toISOString().slice(0, 10);
    downloadSnapshotJson(payload, `ani-site-backup-${date}.json`);
    await finishWithMessage(copy.backupDownloaded);
  }

  async function exportBackupMobile() {
    const payload = await exportSyncSnapshot();
    const text = JSON.stringify(encodeSyncSnapshot(payload));
    const date = new Date().toISOString().slice(0, 10);
    const filename = `ani-site-backup-${date}.json`;

    try {
      const file = new File([text], filename, { type: "application/json" });
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: copy.shareFileTitle, files: [file] });
        await finishWithMessage(copy.sharedFile);
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        setMessage(copy.shareCancelled);
        return;
      }
    }

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: copy.shareTextTitle, text });
        await finishWithMessage(copy.sharedText);
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        setMessage(copy.shareCancelled);
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      await finishWithMessage(copy.copiedJson);
    } catch {
      setMessage(copy.shareFailed);
    }
  }

  async function importBackupFromJson(json, mode = "merge") {
    const snapshot = Array.isArray(json)
      ? { list: normalizeImportList(json) }
      : normalizeSyncSnapshot(json);
    const incomingList = snapshot?.list;
    if (!Array.isArray(incomingList)) {
      throw new Error(copy.missingList);
    }

    const isOverwrite = mode === "overwrite";
    if (isOverwrite) {
      const ok = window.confirm(copy.overwriteConfirm);
      if (!ok) return false;
      writeLibraryList(incomingList);
    } else {
      const currentList = await readLibraryListPreferred([]).catch(() => []);
      writeLibraryList(dedupeByAnilistId([...currentList, ...incomingList]));
    }

    const incomingTierBundle = Array.isArray(json) ? null : snapshot?.tierTopics;
    const incomingTier = Array.isArray(json) ? null : snapshot?.tier;
    if (incomingTierBundle || incomingTier) {
      const nextBundle = isOverwrite
        ? normalizeTierTopicBundle(incomingTierBundle || incomingTier, null)
        : mergeTierTopicBundles(readTierBoardBundle(null), incomingTierBundle || incomingTier);
      writeTierBoardBundle(nextBundle);
    }

    const incomingLogs = Array.isArray(json) ? null : snapshot?.watchLogs;
    if (Array.isArray(incomingLogs)) {
      if (isOverwrite) {
        await replaceWatchLogs(incomingLogs);
      } else {
        await mergeWatchLogs(incomingLogs);
      }
    } else if (isOverwrite) {
      await replaceWatchLogs([]);
    }

    const incomingPins = Array.isArray(json) ? null : snapshot?.characterPins;
    if (Array.isArray(incomingPins)) {
      if (isOverwrite) {
        await replaceCharacterPins(incomingPins);
      } else {
        await mergeCharacterPins(incomingPins);
      }
    } else if (isOverwrite) {
      await replaceCharacterPins([]);
    }

    let preferenceChanged = false;
    const incomingPrefs = Array.isArray(json) ? null : snapshot?.preferences;
    if (incomingPrefs && typeof incomingPrefs === "object") {
      if (Object.prototype.hasOwnProperty.call(incomingPrefs, "cardsPerRowBase")) {
        const cardsPerRowBase = Number(incomingPrefs.cardsPerRowBase);
        if (Number.isFinite(cardsPerRowBase)) {
          writeJson(STORAGE_KEYS.cardsPerRowBase, cardsPerRowBase);
          preferenceChanged = true;
        }
      }
      if (Object.prototype.hasOwnProperty.call(incomingPrefs, "cardView")) {
        const cardView = String(incomingPrefs.cardView || "").trim();
        if (cardView === "meta" || cardView === "poster") {
          writeJson(STORAGE_KEYS.cardView, cardView);
          preferenceChanged = true;
        }
      }
    }
    if (preferenceChanged) markLocalDirty();

    setImportText("");
    setMessage(isOverwrite ? copy.importDoneOverwrite : copy.importDoneMerge);
    if (typeof onChanged === "function") {
      await onChanged();
    }
    return true;
  }

  async function importBackupFile(file, mode = "merge") {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await importBackupFromJson(json, mode);
    } catch (error) {
      console.error(error);
      setMessage(`${copy.importFailed}: ${error?.message || copy.unknownError}`);
      throw error;
    }
  }

  async function importBackupText(rawText, mode = "merge") {
    const raw = String(rawText || "").trim();
    if (!raw) {
      setMessage(copy.emptyPaste);
      return;
    }

    try {
      const json = JSON.parse(raw);
      await importBackupFromJson(json, mode);
    } catch (error) {
      console.error(error);
      setMessage(`${copy.pasteImportFailed}: ${error?.message || copy.unknownError}`);
      throw error;
    }
  }

  return (
    <section id="manual-tools" className="surface-card manual-tools">
      <div className="pageHeader manual-tools__header">
        <h2 className="sectionTitle">{copy.manualToolsTitle}</h2>
        <p className="sectionLead">{copy.manualToolsLead}</p>
      </div>

      <div className="data-menu-tabs seg-toggle-2" data-active-index={tab === "export" ? "0" : "1"}>
        <SegTabButton active={tab === "export"} onClick={() => setTab("export")}>
          <IconDownload />
          {copy.export}
        </SegTabButton>
        <SegTabButton active={tab === "import"} onClick={() => setTab("import")}>
          <IconUpload />
          {copy.import}
        </SegTabButton>
      </div>

      {tab === "export" ? (
        <div className="data-menu-body manual-tools__body">
          <p className="small manual-tools__summary">{copy.manualToolsSummary}</p>
          <button type="button" className="btn" onClick={exportBackupFile}>
            <ActionLabel icon={<IconFile />}>{copy.saveBackupFile}</ActionLabel>
          </button>
          <button type="button" className="btn" onClick={exportBackupMobile}>
            <ActionLabel icon={<IconMobile />}>{copy.mobileShare}</ActionLabel>
          </button>
        </div>
      ) : (
        <div className="data-menu-body manual-tools__body">
          <p className="small manual-tools__summary">{copy.manualToolsImportSummary}</p>
          <div
            className="data-menu-import-mode seg-toggle-2"
            data-active-index={importMode === "merge" ? "0" : "1"}
          >
            <SegTabButton active={importMode === "merge"} onClick={() => setImportMode("merge")}>
              {copy.mergeImport}
            </SegTabButton>
            <SegTabButton active={importMode === "overwrite"} onClick={() => setImportMode("overwrite")}>
              {copy.overwriteImport}
            </SegTabButton>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => fileRef.current?.click()}
          >
            <ActionLabel icon={<IconFile />}>{copy.pickBackupFile}</ActionLabel>
          </button>
          <textarea
            className="textarea data-menu-import-text"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={copy.importPlaceholder}
          />
          <button
            type="button"
            className="btn"
            onClick={() => {
              importBackupText(importText, importMode).catch(() => {});
            }}
          >
            <ActionLabel icon={<IconClipboard />}>{copy.importFromPaste}</ActionLabel>
          </button>
        </div>
      )}

      {message ? <div className="small page-feedback manual-tools__feedback">{message}</div> : null}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="data-menu-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            event.target.value = "";
            return;
          }
          importBackupFile(file, importMode)
            .catch(() => {})
            .finally(() => {
              event.target.value = "";
            });
        }}
      />
    </section>
  );
}
