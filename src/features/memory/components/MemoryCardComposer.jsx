import SystemDesignPreview from "./SystemDesignPreview.jsx";
import MemoryTitleSelector from "./MemoryTitleSelector.jsx";
import { useMemoryCardComposer } from "./useMemoryCardComposer.js";
import MemoryRouteShell from "./MemoryRouteShell.jsx";
import "./memory-card-composer.css";

const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

export default function MemoryCardComposer({ base = "/" }) {
  const {
    runtime,
    ticket,
    designSpec,
    status,
    message,
    title,
    titleResults,
    selectedTitleChoice,
    titleSearchStatus,
    remoteTitleStatus,
    note,
    rightsConfirmed,
    busy,
    canSave,
    displayTitle,
    chooseImage,
    useSystemDesign,
    changeTitle,
    searchTitles,
    selectTitle,
    clearSelectedTitle,
    removeImage,
    saveCard,
    changeNote,
    changeRightsConfirmed,
  } = useMemoryCardComposer({ base });

  return (
    <MemoryRouteShell base={base} currentRoute="memory-new">
    <div className="memory-composer page-shell page-shell--narrow">
      <section className="surface-card memory-composer__intro">
        <div className="pageHeader">
          <p className="memory-composer__eyebrow">한 장면에서 시작하는 개인 기록</p>
          <h1 className="pageTitle">나만의 애니 메모리 카드</h1>
          <p className="pageLead">
            기억하고 싶은 장면과 짧은 감상을 한 장의 카드로 정리해 보세요.
          </p>
        </div>
        <div className="memory-composer__privacy">
          <strong>내 기기에만 비공개로 저장</strong>
          <span>서버 업로드 없이 앱 전용 공간에 보관하며 원본 경로는 웹 화면에 전달되지 않아요.</span>
        </div>
      </section>

      <form className="surface-card memory-composer__form" onSubmit={saveCard}>
        <section className="memory-composer__image-section" aria-labelledby="memory-image-heading">
          <div className="memory-composer__section-head">
            <div>
              <h2 id="memory-image-heading">기억할 장면</h2>
              <p>시스템 사진 선택기나 다른 앱의 공유 메뉴에서 한 장을 가져올 수 있어요.</p>
            </div>
            {ticket && (
              <span className="status-badge">
                {ticket.width}×{ticket.height} · {formatBytes(ticket.byteSize)}
              </span>
            )}
          </div>

          {designSpec ? (
            <SystemDesignPreview
              className="memory-composer__preview memory-composer__system-preview"
              spec={designSpec}
              title={displayTitle}
            />
          ) : ticket ? (
            <div className="memory-composer__preview-wrap">
              <img
                className="memory-composer__preview"
                src={ticket.previewDataUrl}
                alt={displayTitle ? `${displayTitle} 메모리 카드 미리보기` : "선택한 이미지 미리보기"}
              />
            </div>
          ) : (
            <div className="memory-composer__empty-image">
              <span aria-hidden="true">＋</span>
              <p>
                {status === "browser"
                  ? "이미지 가져오기는 현재 Android 앱에서만 사용할 수 있어요."
                  : busy
                    ? "이미지를 안전하게 준비하고 있어요…"
                    : "아직 선택한 이미지가 없어요."}
              </p>
            </div>
          )}

          {message && <p className="memory-composer__error" role="alert">{message}</p>}

          <div className="action-row memory-composer__image-actions">
            <button
              type="button"
              className="btn"
              onClick={chooseImage}
              disabled={!runtime?.imageIntake.available || busy}
            >
              {ticket ? "다른 이미지 선택" : "이미지 선택"}
            </button>
            {ticket && (
              <button type="button" className="btn btn--subtle" onClick={removeImage} disabled={busy}>
                이미지 제거
              </button>
            )}
            <button
              type="button"
              className="btn btn--subtle"
              onClick={useSystemDesign}
              disabled={!runtime || busy}
            >
              시스템 디자인 사용
            </button>
          </div>
        </section>

        <div className="memory-composer__fields">
          <MemoryTitleSelector
            title={title}
            runtimeReady={Boolean(runtime)}
            titleResults={titleResults}
            selectedTitleChoice={selectedTitleChoice}
            titleSearchStatus={titleSearchStatus}
            remoteTitleStatus={remoteTitleStatus}
            onTitleChange={changeTitle}
            onSearch={searchTitles}
            onSelectTitle={selectTitle}
            onClearSelected={clearSelectedTitle}
          />

          <label className="memory-composer__field">
            <span>짧은 감상</span>
            <textarea
              className="textarea"
              value={note}
              maxLength={500}
              rows={5}
              onChange={changeNote}
              placeholder="이 장면을 남기고 싶은 이유를 적어보세요."
            />
            <small>{note.length}/500</small>
          </label>

          {ticket ? (
            <label className="memory-composer__rights">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={changeRightsConfirmed}
              />
              <span>이 이미지를 개인 기록에 사용할 권리와 책임이 나에게 있음을 확인합니다.</span>
            </label>
          ) : designSpec ? (
            <p className="memory-composer__rights">
              시스템 디자인은 이미지 파일 대신 재현 가능한 디자인 정보만 저장합니다.
            </p>
          ) : null}
        </div>

        <div className="memory-composer__save-gate">
          <button type="submit" className="btn" disabled={!canSave}>
            {status === "saving" ? "카드 저장 중…" : "카드 저장"}
          </button>
          <p>저장하면 이 기기의 비공개 Archive에서 바로 다시 볼 수 있어요.</p>
        </div>
      </form>
    </div>
    </MemoryRouteShell>
  );
}
