(() => {
  "use strict";

  // V4 cover-and-film proposal. V3 files remain unchanged; all state is page-only.
  const titles = [
    { id: "t1", name: "여름의 궤도", year: "2026", genre: "청춘 · 일상", status: "보는 중", saved: true, poster: 0 },
    { id: "t2", name: "별을 건너는 밤", year: "2025", genre: "모험 · 판타지", status: "완료", saved: true, poster: 1 },
    { id: "t3", name: "초록의 우편함", year: "2025", genre: "일상 · 드라마", status: "완료", saved: true, poster: 2 },
    { id: "t4", name: "다음 역, 우리 집", year: "2026", genre: "일상 · 청춘", status: "", saved: false, poster: 3 },
    { id: "t5", name: "작은 행성의 편지", year: "2024", genre: "모험 · SF", status: "보는 중", saved: true, poster: 4 },
    { id: "t6", name: "비 오는 서점", year: "2025", genre: "일상 · 드라마", status: "완료", saved: true, poster: 5 },
    { id: "t7", name: "새벽을 닮은 너", year: "2026", genre: "청춘 · 로맨스", status: "보는 중", saved: true, poster: 6 },
    { id: "t8", name: "바람이 머문 자리", year: "2026", genre: "모험 · 판타지", status: "볼 예정", saved: true, poster: 7 },
  ];
  const notes = [
    "아무 말 없이 나란히 걷던 여름.", "다시 돌아가고 싶은 오후.", "기차가 지나간 뒤에도 한참 서 있었다.",
    "빛이 바뀌는 순간이 좋았다.", "이 장면의 바람 소리를 기억한다.", "끝나지 않을 것 같던 하루.",
    "밤하늘을 올려다보던 둘.", "마지막 인사가 오래 남았다.", "조용한 엔딩을 다시 봤다.",
    "편지 한 장으로 시작한 이야기.", "창가의 초록이 유난히 선명했다.", "집에 가는 길에 생각났다.",
    "다음 역에서는 조금 더 솔직해지기로.", "멀리 있어도 닿는 마음.", "작은 불빛 하나면 충분했다.",
    "비가 그칠 때까지 읽었다.", "책장을 넘기는 소리가 좋았다.", "처음 본 새벽의 색.",
  ];
  const memoryTitleIds = ["t1", "t1", "t1", "t1", "t1", "t1", "t2", "t2", "t2", "t3", "t3", "t4", "t4", "t5", "t5", "t6", "t6", "t7"];
  const memories = memoryTitleIds.map((titleId, index) => ({ id: `m${index + 1}`, titleId, scene: index % 6, note: notes[index], date: `2026-09-${String(28 - index).padStart(2, "0")}`, sequence: 18 - index }));
  // Existing Board model remains separate, deliberately not repurposed into title shelves.
  const boards = [
    { id: "b1", name: "여름의 잔상", ids: ["m1", "m2", "m3", "m4", "m5", "m6", "m10", "m12"] },
    { id: "b2", name: "밤 산책", ids: ["m2", "m7", "m8", "m9", "m14", "m18"] },
    { id: "b3", name: "초록의 기록", ids: ["m3", "m10", "m11", "m16"] },
  ];
  const watchLogs = {
    t1: [{ date: "2026. 9. 28", event: "다시 봄", note: "첫날의 공기를 다시 느끼고 싶어서." }, { date: "2026. 9. 20", event: "완료", note: "끝을 보고 나니 시작이 다르게 보였다." }, { date: "2026년 여름", event: "보기 시작", note: "정확한 날은 기억나지 않지만, 더운 날이었다." }],
    t2: [{ date: "2026. 9. 18", event: "완료", note: "엔딩 음악까지 전부 들었다." }],
    t3: [{ date: "날짜 미상", event: "완료", note: "편지의 마지막 문장이 생각난다." }],
    t6: [{ date: "2026. 9. 6", event: "완료", note: "비 오는 날 다시 보고 싶다." }],
  };
  let bookshelf = { name: "오래 머무는 장면들", bio: "좋아하는 작품을 꺼내 놓고, 마음에 남은 순간을 다시 봅니다.", theme: "mint", featured: "m1", shelves: [{ id: "s1", name: "오래 남은 작품", titles: ["t1", "t3", "t2"] }, { id: "s2", name: "다시 꺼내 볼 작품", titles: ["t6", "t4", "t5"] }] };
  let draft = null;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const controls = { query: "", filter: "all", sort: "recent", view: "poster" };
  const state = { page: "home", id: "", titleOrigin: { page: "home", id: "" }, titleViews: new Map(), rails: new Map(), routeY: new Map(), routeFocus: new Map(), nextMemory: 19 };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const findTitle = (id) => titles.find((title) => title.id === id);
  const findMemory = (id) => memories.find((memory) => memory.id === id);
  const titleMemories = (id) => memories.filter((memory) => memory.titleId === id).sort((a, b) => b.sequence - a.sequence);
  const collection = () => titles.filter((title) => title.saved || titleMemories(title.id).length);
  const filteredTitles = () => collection().filter((title) => {
    const count = titleMemories(title.id).length;
    if (controls.query && !`${title.name} ${title.genre}`.replace(/\s/g, "").includes(controls.query.trim().replace(/\s/g, ""))) return false;
    if (controls.filter === "saved" && !title.saved) return false;
    if (controls.filter === "memory" && !count) return false;
    if (controls.filter === "watching" && (!title.saved || title.status !== "보는 중")) return false;
    if (controls.filter === "completed" && (!title.saved || title.status !== "완료")) return false;
    return true;
  }).sort((a, b) => controls.sort === "title" ? a.name.localeCompare(b.name, "ko") : (titleMemories(b.id)[0]?.sequence || 0) - (titleMemories(a.id)[0]?.sequence || 0) || a.name.localeCompare(b.name, "ko"));
  function moveShelfTitle(model, shelfId, titleId, direction) {
    const shelf = model.shelves.find((item) => item.id === shelfId);
    if (!shelf) return false;
    const from = shelf.titles.indexOf(titleId), to = from + direction;
    if (from < 0 || to < 0 || to >= shelf.titles.length) return false;
    [shelf.titles[from], shelf.titles[to]] = [shelf.titles[to], shelf.titles[from]];
    return true;
  }
  function toggleShelfTitle(model, shelfId, titleId) {
    const shelf = model.shelves.find((item) => item.id === shelfId);
    if (!shelf || !findTitle(titleId)) return;
    shelf.titles = shelf.titles.includes(titleId) ? shelf.titles.filter((id) => id !== titleId) : [...shelf.titles, titleId];
  }
  function checkModel() {
    const assert = (condition, message) => { if (!condition) throw new Error(`Bookshelf fixture: ${message}`); };
    assert(titles.length === 8 && memories.length === 18, "seed counts");
    assert(titleMemories("t1").length === 6 && !titleMemories("t8").length, "populated and empty titles");
    assert(!findTitle("t4").saved && titleMemories("t4").length === 2, "unsaved title with memories");
    const before = JSON.stringify({ titles, memories, boards, watchLogs });
    const sample = clone(bookshelf);
    toggleShelfTitle(sample, "s1", "t1");
    toggleShelfTitle(sample, "s1", "t8");
    assert(moveShelfTitle(sample, "s1", "t8", -1), "accessible reorder");
    assert(before === JSON.stringify({ titles, memories, boards, watchLogs }), "curation independent from domain records");
    assert(bookshelf.shelves[0].titles[0] === "t1", "draft changes do not commit");
    assert(bookshelf.shelves.flatMap((shelf) => shelf.titles).length === 6, "curated subset rather than full archive");
    const poster = filteredTitles().map((title) => title.id).join();
    controls.view = "album";
    assert(filteredTitles().map((title) => title.id).join() === poster, "views share collection");
    controls.view = "poster";
    assert(boards.every((board) => new Set(board.ids).size === board.ids.length && board.ids.every(findMemory)), "board model preserved");
    const sleeve = railView("row-t1");
    assert(sleeve.expanded && sleeve.loaded === 3, "sleeves begin open with three previews");
    sleeve.left = 282; sleeve.expanded = false; sleeve.expanded = true;
    assert(sleeve.left === 282 && before === JSON.stringify({ titles, memories, boards, watchLogs }), "folding preserves scroll and domain records");
    state.rails.delete("row-t1");
  }
  checkModel();
  if (typeof document === "undefined") return;

  const app = document.getElementById("app"), memoryDialog = document.getElementById("memory-dialog"), composerDialog = document.getElementById("composer-dialog"), toastElement = document.getElementById("toast");
  if (!app || !memoryDialog || !composerDialog || !toastElement) throw new Error("Bookshelf shell is incomplete");
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const routeKey = () => `${state.page}/${state.id}`;
  let toastTimer, memoryContext = null, composerContext = null;
  let railCleanup = () => {};
  const caseBindings = new Map();
  const art = (kind, index, label) => {
    const columns = kind === "poster" ? 4 : 3;
    return `<div class="art ${kind}-art" style="--x:${(index % columns) * 100 / (columns - 1)}%;--y:${Math.floor(index / columns) * 100}%" role="img" aria-label="${esc(label)}"></div>`;
  };
  const button = (text, action, extra = "", attributes = "") => `<button type="button" class="button ${extra}" data-action="${action}" ${attributes}>${text}</button>`;
  const dateLabel = (value) => value.replace(/-/g, ". ");
  const titleMeta = (title) => `${title.saved ? esc(title.status || "저장됨") : "미저장"} · 기억 ${titleMemories(title.id).length}개`;
  const memoryTile = (memory) => {
    const title = findTitle(memory.titleId);
    return `<article class="board-memory"><button type="button" class="memory-tile" data-action="memory" data-id="${memory.id}" aria-label="${esc(title.name)}의 기억, ${esc(memory.note || dateLabel(memory.date))}"><div class="memory-image">${art("scene", memory.scene, `${title.name}의 장면`)}</div><div class="memory-info"><h3>${esc(memory.note || title.name)}</h3><p>${esc(title.name)} · ${dateLabel(memory.date)}</p></div></button></article>`;
  };
  const posterTile = (title) => `<button type="button" class="poster-tile" data-action="title" data-id="${title.id}" id="poster-${title.id}">${art("poster", title.poster, `${title.name} 가상 작품 표지`)}<div class="poster-info"><span class="poster-title">${esc(title.name)}</span><p class="poster-meta">${titleMeta(title)}</p></div></button>`;
  const empty = (heading, body = "", action = "") => `<section class="empty-state"><h2>${heading}</h2>${body ? `<p class="muted">${body}</p>` : ""}${action}</section>`;
  function showToast(message) {
    clearTimeout(toastTimer); toastElement.textContent = message; toastElement.hidden = false; toastElement.classList.add("visible");
    toastTimer = setTimeout(() => { toastElement.classList.remove("visible"); toastElement.hidden = true; }, 3500);
  }
  function titleView(id = state.id) {
    if (!state.titleViews.has(id)) state.titleViews.set(id, { tab: "memories", layout: "film" });
    return state.titleViews.get(id);
  }
  function railView(id) {
    if (!state.rails.has(id)) state.rails.set(id, { left: 0, index: 0, loaded: id.startsWith("row-") ? 3 : Infinity, expanded: true, transitioning: false });
    return state.rails.get(id);
  }
  function captureRails() {
    app.querySelectorAll("[data-rail-id]").forEach((rail) => {
      const view = railView(rail.dataset.railId);
      if (view.expanded && !view.transitioning) view.left = rail.scrollLeft;
    });
  }
  function capturePosition() {
    state.routeY.set(routeKey(), window.scrollY); captureRails();
    const active = document.activeElement;
    if (active && app.contains(active)) {
      if (active.id) state.routeFocus.set(routeKey(), `#${CSS.escape(active.id)}`);
      else if (active.dataset.action && active.dataset.id) state.routeFocus.set(routeKey(), `[data-action="${active.dataset.action}"][data-id="${active.dataset.id}"]`);
    }
  }
  function navigate(page, id = "") {
    if (draft) { showToast("꾸미기를 적용하거나 취소한 뒤 이동해 주세요."); document.getElementById("shelf-apply")?.focus(); return; }
    capturePosition();
    if (page === "title" && state.page !== "title") state.titleOrigin = { page: state.page, id: state.id };
    const hash = `#${page}${id ? `/${id}` : ""}`;
    if (location.hash !== hash) history.pushState(null, "", hash);
    Object.assign(state, { page, id }); render({ restorePage: true });
  }
  function readRoute() {
    const [page, id = ""] = location.hash.slice(1).split("/");
    if (page === "title" && findTitle(id)) return { page, id };
    return ["home", "titles", "memories"].includes(page) ? { page, id: "" } : { page: "home", id: "" };
  }

  function renderBookshelf(model) {
    const featured = findMemory(model.featured) || memories[0], featuredTitle = findTitle(featured.titleId);
    return `<div class="bookshelf-home" data-theme="${model.theme}"><section class="shelf-intro"><div class="shelf-profile"><p class="shelf-kicker">나의 필름책장</p><h1>${esc(model.name || "나의 필름책장")}</h1><p class="shelf-bio">${esc(model.bio || "좋아하는 작품과 장면을 모아 두는 곳.")}</p><div class="shelf-actions">${draft ? '<span class="shelf-preview-label">꾸미는 중 · 미리보기</span>' : button("책장 꾸미기", "shelf-edit", "", 'id="shelf-edit"')}${button("모든 작품 보기 →", "nav", "quiet", 'data-page="titles"')}</div></div><button type="button" class="featured-memory" data-action="memory" data-id="${featured.id}" aria-label="대표 장면 열기: ${esc(featured.note)}"><div class="featured-image">${art("scene", featured.scene, `${featuredTitle.name}의 대표 장면`)}</div><span class="featured-caption"><small>지금 꺼내 둔 장면</small><strong>${esc(featured.note || featuredTitle.name)}</strong><span>${esc(featuredTitle.name)}</span></span></button></section>${model.shelves.map((shelf, index) => `<section class="shelf-section"><header class="shelf-heading"><div><span class="shelf-number">0${index + 1}</span><h2>${esc(shelf.name || "제목 없는 선반")}</h2></div><span class="muted">${shelf.titles.length} 작품</span></header><div class="shelf-display" aria-label="${esc(shelf.name)}">${shelf.titles.length ? shelf.titles.map((id) => { const title = findTitle(id); return `<button type="button" class="shelf-book" data-action="title" data-id="${id}" id="shelf-${shelf.id}-${id}"><span class="book-sleeve">${art("poster", title.poster, `${title.name} 가상 작품 표지`)}</span><span class="book-caption"><strong>${esc(title.name)}</strong><small>${titleMeta(title)}</small></span></button>`; }).join("") : '<p class="shelf-empty muted">이 선반에 꺼내 둘 작품을 골라 주세요.</p>'}</div></section>`).join("")}<section class="shelf-recent"><div class="section-head"><h2>최근 남긴 기억</h2>${button("기억 아카이브 →", "nav", "quiet", 'data-page="memories"')}</div><div class="memory-grid">${[...memories].sort((a, b) => b.sequence - a.sequence).slice(0, 4).map(memoryTile).join("")}</div></section></div>`;
  }
  function renderShelfEditor() {
    return `<aside class="shelf-editor" aria-labelledby="shelf-editor-heading"><div class="editor-heading"><h2 id="shelf-editor-heading">책장 꾸미기</h2><p class="muted">골라 둔 작품만 이곳에 진열해요.</p></div><section class="editor-section"><label class="editor-label" for="shelf-name">책장 이름</label><input class="control" id="shelf-name" maxlength="32" value="${esc(draft.name)}"><label class="editor-label" for="shelf-bio">짧은 소개</label><textarea class="control" id="shelf-bio" maxlength="100" rows="3">${esc(draft.bio)}</textarea></section><section class="editor-section"><h3>책장의 색</h3><div class="theme-options">${[["mint", "민트"], ["amber", "앰버"], ["lilac", "라일락"]].map(([key, label]) => `<button type="button" class="theme-choice" id="theme-${key}" data-action="shelf-theme" data-theme="${key}" aria-pressed="${draft.theme === key}"><span class="theme-swatch" aria-hidden="true"></span>${label}</button>`).join("")}</div></section><section class="editor-section"><label class="editor-label" for="shelf-featured">대표 장면</label><select class="control" id="shelf-featured">${memories.map((memory) => `<option value="${memory.id}" ${draft.featured === memory.id ? "selected" : ""}>${esc(findTitle(memory.titleId).name)} · ${esc(memory.note || dateLabel(memory.date))}</option>`).join("")}</select></section>${draft.shelves.map((shelf, shelfIndex) => `<section class="editor-section"><label class="editor-label" for="shelf-label-${shelf.id}">${shelfIndex + 1}번째 선반</label><input class="control" id="shelf-label-${shelf.id}" data-shelf-label="${shelf.id}" maxlength="24" value="${esc(shelf.name)}"><ol class="curation-list">${shelf.titles.map((id, index) => `<li class="curation-item"><span>${esc(findTitle(id).name)}</span><div class="curation-actions">${button("↑", "shelf-up", "quiet", `data-shelf="${shelf.id}" data-id="${id}" id="up-${shelf.id}-${id}" aria-label="${esc(findTitle(id).name)} 앞으로" ${index === 0 ? "disabled" : ""}`)}${button("↓", "shelf-down", "quiet", `data-shelf="${shelf.id}" data-id="${id}" id="down-${shelf.id}-${id}" aria-label="${esc(findTitle(id).name)} 뒤로" ${index === shelf.titles.length - 1 ? "disabled" : ""}`)}${button("×", "shelf-remove", "quiet", `data-shelf="${shelf.id}" data-id="${id}" aria-label="${esc(findTitle(id).name)} 진열에서 빼기"`)}</div></li>`).join("")}</ol><details class="title-picker"><summary>작품 고르기 <span>${shelf.titles.length}/${titles.length}</span></summary>${titles.map((title) => `<label class="title-pick-item"><input type="checkbox" id="pick-${shelf.id}-${title.id}" data-pick-shelf="${shelf.id}" value="${title.id}" ${shelf.titles.includes(title.id) ? "checked" : ""}><span>${esc(title.name)}</span></label>`).join("")}</details></section>`).join("")}<p class="editor-footnote muted">진열에서 빼도 작품과 기억은 그대로 남아요.</p><div class="editor-actions">${button("취소", "shelf-cancel", "quiet", 'id="shelf-cancel"')}${button("적용", "shelf-apply", "primary", 'id="shelf-apply"')}</div></aside>`;
  }
  function renderHome() {
    return draft ? `<div class="shelf-edit-banner" role="status">꾸미기 미리보기 · 적용 전에는 바뀌지 않아요.</div><div class="shelf-edit-layout">${renderShelfEditor()}<div id="shelf-live-preview">${renderBookshelf(draft)}</div></div>` : renderBookshelf(bookshelf);
  }
  function updateShelfPreview() { const preview = document.getElementById("shelf-live-preview"); if (preview && draft) preview.innerHTML = renderBookshelf(draft); }
  function cancelShelfEdit() { draft = null; render({ focusId: "shelf-edit" }); showToast("꾸미기를 취소했어요."); }
  function rerenderEditor(focusId, reopenShelf = "") {
    const openShelves = [...app.querySelectorAll(".title-picker[open]")].map((detail) => detail.querySelector("input")?.dataset.pickShelf);
    const y = window.scrollY, editorTop = app.querySelector(".shelf-editor")?.scrollTop || 0;
    render({ focusId });
    [...app.querySelectorAll(".title-picker")].forEach((detail) => { if ([...openShelves, reopenShelf].includes(detail.querySelector("input")?.dataset.pickShelf)) detail.open = true; });
    const editor = app.querySelector(".shelf-editor");
    if (editor) editor.scrollTop = editorTop;
    requestAnimationFrame(() => {
      if (editor?.isConnected) editor.scrollTop = editorTop;
      window.scrollTo({ top: y, behavior: "instant" });
    });
  }

  function railFrames(title, items, railId) {
    const view = railView(railId), shown = items.slice(0, view.loaded);
    return shown.map((memory, index) => `<button type="button" class="film-frame" id="${railId}-${memory.id}" data-action="memory" data-id="${memory.id}" data-frame="${index}" aria-label="${esc(title.name)}, ${index + 1}번째 기억, ${esc(memory.note || dateLabel(memory.date))}"><div class="frame-image">${art("scene", memory.scene, `${title.name}의 장면`)}</div><span class="frame-caption"><span class="frame-number">${String(index + 1).padStart(2, "0")}</span><span class="frame-note">${esc(memory.note || title.name)}</span><small class="frame-date">${dateLabel(memory.date)}</small></span></button>`).join("") + (shown.length < items.length ? `<button type="button" class="film-load-more" data-action="rail-more" data-rail="${railId}" data-title="${title.id}" id="more-${railId}"><span>+${items.length - shown.length}</span><strong>다음 장면 펼치기</strong></button>` : "");
  }
  function railControls(title, railId) {
    return `<div class="rail-controls" data-controls-for="${railId}">${button("←", "rail-prev", "", `data-rail="${railId}" aria-label="${esc(title.name)} 이전 장면"`)}${button("→", "rail-next", "", `data-rail="${railId}" aria-label="${esc(title.name)} 다음 장면"`)}</div>`;
  }
  function titleFilmRow(title, index) {
    const items = titleMemories(title.id), railId = `row-${title.id}`, view = railView(railId), shownCount = Math.min(items.length, view.loaded);
    const header = `<header class="sleeve-heading"><span class="sleeve-index">${String(index + 1).padStart(2, "0")}</span><div><h2><button type="button" class="title-action" data-action="title" data-id="${title.id}">${esc(title.name)}</button></h2><p class="sleeve-meta">${title.year} · ${esc(title.genre)}<span>${titleMeta(title)}</span></p></div></header>`;
    const cover = `<button type="button" class="case-cover" data-action="title" data-id="${title.id}" id="row-cover-${title.id}" aria-label="${esc(title.name)} 작품 상세">${art("poster", title.poster, `${title.name} 가상 작품 표지`)}</button>`;
    if (!items.length) return `<article class="sleeve-row" data-title="${title.id}">${header}<div class="film-case is-empty" data-case="${title.id}">${cover}<div class="case-empty"><p>아직 남긴 기억이 없어요.</p>${button("첫 기억 남기기", "compose", "", `data-title="${title.id}"`)}</div></div></article>`;
    return `<article class="sleeve-row" data-title="${title.id}">${header}<div class="film-case${view.expanded ? " is-open" : ""}" data-case="${title.id}" style="--frame-count:${shownCount};--more-slots:${shownCount < items.length ? 1 : 0}">${cover}<div class="case-drawer" id="drawer-${title.id}" aria-hidden="${!view.expanded}"><div class="film-track-shell"><div class="film-rail" data-rail-id="${railId}" data-total="${items.length}" tabindex="${view.expanded ? "0" : "-1"}" ${view.expanded ? "" : "inert"} aria-hidden="${!view.expanded}" aria-label="${esc(title.name)} 기억 필름, 좌우 화살표로 이동">${railFrames(title, items, railId)}</div></div></div><button type="button" class="case-pull" data-action="case-toggle" data-title="${title.id}" id="pull-${title.id}" aria-controls="drawer-${title.id}" aria-expanded="${view.expanded}" aria-label="${esc(title.name)} ${view.expanded ? "필름 접기" : "필름 꺼내기"}"><span class="case-pull-glyph" aria-hidden="true">${view.expanded ? "←" : "→"}</span><span class="case-pull-label">${view.expanded ? "접기" : "꺼내기"}</span></button></div><footer class="sleeve-footer"><p><span data-rail-position="${railId}">01 / ${String(items.length).padStart(2, "0")}</span><span class="case-status" data-case-status="${title.id}">${view.expanded ? "좌우로 넘겨 보세요" : "접어 둔 필름"}</span></p>${railControls(title, railId)}</footer></article>`;
  }
  function renderTitleResults(items) { return items.length ? `${controls.view === "album" ? '<p class="sleeve-help">필름 끝의 손잡이를 눌러 보세요.</p>' : ""}<section class="${controls.view === "poster" ? "poster-grid" : "film-rows sleeve-rows"}" aria-label="내 작품 목록">${items.map(controls.view === "poster" ? posterTile : titleFilmRow).join("")}</section>` : empty("찾는 작품이 없어요", "검색어나 필터를 바꿔 보세요.", button("검색 초기화", "reset", "quiet")); }
  function renderTitles() {
    const items = filteredTitles(), filters = [["all", "전체"], ["saved", "저장됨"], ["memory", "기억 있음"], ["watching", "보는 중"], ["completed", "완료"]];
    return `<header class="page-heading"><div><p class="eyebrow">모아 둔 모든 작품</p><h1>내 작품 <span class="muted">${collection().length}</span></h1></div>${button("기억 남기기", "compose", "primary")}</header><div class="toolbar"><label class="search-field"><span class="sr-only">내 작품 검색</span><input id="title-search" class="control" type="search" placeholder="작품이나 장르 찾기" value="${esc(controls.query)}" autocomplete="off"></label><label class="sort-field"><span class="sr-only">작품 정렬</span><select id="title-sort" class="control"><option value="recent" ${controls.sort === "recent" ? "selected" : ""}>최근 기억순</option><option value="title" ${controls.sort === "title" ? "selected" : ""}>제목순</option></select></label><div class="segmented" role="group" aria-label="작품 보기">${button("표지 보기", "view", "", `data-view="poster" aria-pressed="${controls.view === "poster"}" id="view-poster"`)}${button("기억 함께 보기", "view", "", `data-view="album" aria-pressed="${controls.view === "album"}" id="view-album"`)}</div></div><div class="filters" aria-label="작품 필터">${filters.map(([key, label]) => `<button type="button" class="chip" data-action="filter" data-filter="${key}" aria-pressed="${controls.filter === key}" id="filter-${key}">${label}</button>`).join("")}<span class="filter-count muted" role="status">${items.length}개 작품</span></div><div id="title-results">${renderTitleResults(items)}</div>`;
  }
  function renderTitle() {
    const title = findTitle(state.id), items = titleMemories(title.id), view = titleView(), logs = watchLogs[title.id] || [], railId = `title-${title.id}`;
    const identity = `${button("← 돌아가기", "title-back", "quiet back-button")}<section class="title-identity"><div class="title-cover">${art("poster", title.poster, `${title.name} 가상 작품 표지`)}</div><div class="title-info"><p class="eyebrow">${title.year} · ${esc(title.genre)}</p><h1>${esc(title.name)}</h1><p class="muted">${titleMeta(title)}</p><div class="title-actions">${button("기억 남기기", "compose", "primary", `data-title="${title.id}"`)}${button(title.saved ? "작품 저장됨 ✓" : "작품 저장", "save-title", "", `aria-pressed="${title.saved}" id="title-save"`)}</div></div></section>`;
    const tabs = `<div class="section-head"><div class="segmented" role="group" aria-label="작품 안에서 보기">${button(`기억 ${items.length}`, "title-tab", "", `data-tab="memories" aria-pressed="${view.tab === "memories"}" id="tab-memories"`)}${button(`시청 기록 ${logs.length}`, "title-tab", "", `data-tab="watch" aria-pressed="${view.tab === "watch"}" id="tab-watch"`)}</div>${view.tab === "memories" && items.length ? button(view.layout === "film" ? "전체 보기" : "필름으로 보기", "film-layout", "quiet", 'id="film-layout"') : ""}</div>`;
    if (view.tab === "watch") return identity + tabs + (logs.length ? `<section class="watch-list" aria-label="시청 기록">${logs.map((log) => `<article class="watch-entry"><time>${log.date}</time><div class="watch-copy"><h3>${log.event}</h3><p>${esc(log.note)}</p></div></article>`).join("")}</section>` : empty("아직 시청 기록이 없어요", "기억과 시청 기록은 따로 모아 봅니다."));
    if (!items.length) return identity + tabs + empty("아직 남긴 기억이 없어요", "이 작품에서 기억하고 싶은 장면을 남겨 보세요.", button("첫 기억 남기기", "compose", "primary", `data-title="${title.id}"`));
    if (view.layout === "grid") return identity + tabs + `<section class="memory-grid" aria-label="이 작품의 기억">${items.map(memoryTile).join("")}</section>`;
    return identity + tabs + `<section class="detail-film" aria-label="이 작품의 기억 필름"><header class="film-topline"><div><p class="eyebrow">한 작품에 남겨 둔 순간</p><h2>${esc(title.name)}의 필름</h2></div><span class="film-count">${items.length} 장면</span></header><div class="film-track-shell"><div class="film-rail" data-rail-id="${railId}" data-total="${items.length}" tabindex="0" aria-label="${esc(title.name)} 기억 필름, 좌우 화살표로 이동">${railFrames(title, items, railId)}</div></div><footer class="film-footer"><p><span data-rail-position="${railId}">01 / ${String(items.length).padStart(2, "0")}</span><span class="film-hint muted"> · 장면을 누르면 크게 볼 수 있어요</span></p>${railControls(title, railId)}</footer></section>`;
  }
  function renderMemories() { return `<header class="page-heading"><div><p class="eyebrow">모든 장면을 한곳에</p><h1>기억 아카이브 <span class="muted">${memories.length}</span></h1></div>${button("기억 남기기", "compose", "primary")}</header><section class="memory-grid">${[...memories].sort((a, b) => b.sequence - a.sequence).map(memoryTile).join("")}</section>`; }
  function render({ restorePage = false, focusId = "" } = {}) {
    railCleanup();
    const renderers = { home: renderHome, titles: renderTitles, title: renderTitle, memories: renderMemories };
    app.innerHTML = renderers[state.page]();
    document.querySelectorAll("nav [data-page]").forEach((element) => { if (element.dataset.page === (state.page === "title" ? "titles" : state.page)) element.setAttribute("aria-current", "page"); else element.removeAttribute("aria-current"); });
    bindRails();
    requestAnimationFrame(() => {
      if (restorePage) { window.scrollTo({ top: state.routeY.get(routeKey()) || 0, behavior: "instant" }); const selector = state.routeFocus.get(routeKey()); (selector ? app.querySelector(selector) : app)?.focus({ preventScroll: true }); }
      if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
    });
  }

  function moveRail(id, direction) {
    const rail = app.querySelector(`[data-rail-id="${id}"]`), view = railView(id);
    if (!rail || !view.expanded || view.transitioning) return;
    const frames = [...rail.querySelectorAll(".film-frame, .film-load-more")], max = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const positions = [...new Set(frames.map((frame) => Math.min(max, frame.offsetLeft - frames[0].offsetLeft)))];
    const left = direction === "start" ? 0 : direction === "end" ? max : direction > 0 ? positions.find((position) => position > rail.scrollLeft + 2) ?? max : [...positions].reverse().find((position) => position < rail.scrollLeft - 2) ?? 0;
    rail.scrollTo({ left, behavior: reduceMotion() ? "instant" : "smooth" });
  }
  function bindRails() {
    const cleanups = [];
    app.querySelectorAll("[data-rail-id]").forEach((rail) => {
      const id = rail.dataset.railId, view = railView(id), frames = [...rail.querySelectorAll(".film-frame")], desiredLeft = view.left;
      const caseElement = rail.closest(".film-case"), drawer = rail.closest(".case-drawer");
      const pull = caseElement?.querySelector(".case-pull"), controlsElement = app.querySelector(`[data-controls-for="${id}"]`);
      let dragging = null, cancelClick = false, restored = false, releaseTimer, settleTimer, settleFrame;
      view.transitioning = false;
      const update = () => {
        if (!restored || !frames.length) return;
        const unavailable = !view.expanded || view.transitioning;
        // Drawer width changes must never replace the remembered open scroll position.
        if (!unavailable) {
          view.left = rail.scrollLeft;
          view.index = frames.reduce((best, frame, index) => Math.abs(frame.offsetLeft - frames[0].offsetLeft - rail.scrollLeft) < Math.abs(frames[best].offsetLeft - frames[0].offsetLeft - rail.scrollLeft) ? index : best, 0);
        }
        const position = app.querySelector(`[data-rail-position="${id}"]`); if (position) position.textContent = `${String(view.index + 1).padStart(2, "0")} / ${String(rail.dataset.total).padStart(2, "0")}`;
        if (controlsElement) {
          controlsElement.hidden = unavailable || rail.scrollWidth <= rail.clientWidth + 2;
          controlsElement.inert = unavailable;
          controlsElement.setAttribute("aria-hidden", String(unavailable));
          controlsElement.querySelector('[data-action="rail-prev"]').disabled = unavailable || rail.scrollLeft <= 1;
          controlsElement.querySelector('[data-action="rail-next"]').disabled = unavailable || rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
        }
      };
      const presentCase = () => {
        if (!caseElement || !drawer || !pull) return;
        if (!view.expanded && (drawer.contains(document.activeElement) || controlsElement?.contains(document.activeElement))) pull.focus({ preventScroll: true });
        caseElement.classList.toggle("is-open", view.expanded);
        drawer.setAttribute("aria-hidden", String(!view.expanded));
        rail.inert = !view.expanded;
        rail.setAttribute("aria-hidden", String(!view.expanded));
        rail.tabIndex = view.expanded ? 0 : -1;
        pull.setAttribute("aria-expanded", String(view.expanded));
        pull.setAttribute("aria-label", `${findTitle(caseElement.dataset.case).name} ${view.expanded ? "필름 접기" : "필름 꺼내기"}`);
        pull.querySelector(".case-pull-glyph").textContent = view.expanded ? "←" : "→";
        pull.querySelector(".case-pull-label").textContent = view.expanded ? "접기" : "꺼내기";
        const status = app.querySelector(`[data-case-status="${caseElement.dataset.case}"]`);
        if (status) status.textContent = view.expanded ? "좌우로 넘겨 보세요" : "접어 둔 필름";
        update();
      };
      const settleCase = () => {
        clearTimeout(settleTimer); cancelAnimationFrame(settleFrame);
        if (!rail.isConnected) return;
        if (view.expanded) rail.scrollTo({ left: view.left, behavior: "instant" });
        view.transitioning = false;
        update();
      };
      const toggleCase = () => {
        if (!caseElement || !drawer) return;
        if (view.expanded && !view.transitioning) view.left = rail.scrollLeft;
        view.expanded = !view.expanded;
        view.transitioning = true;
        clearTimeout(settleTimer); cancelAnimationFrame(settleFrame);
        presentCase();
        const style = getComputedStyle(drawer);
        const milliseconds = (value) => (parseFloat(value) || 0) * (value.trim().endsWith("ms") ? 1 : 1000);
        const duration = Math.max(...style.transitionDuration.split(",").map(milliseconds), 0);
        const delay = Math.max(...style.transitionDelay.split(",").map(milliseconds), 0);
        if (reduceMotion() || duration === 0) settleFrame = requestAnimationFrame(settleCase);
        else settleTimer = setTimeout(settleCase, duration + delay + 80);
      };
      const transitionend = (event) => {
        if (event.target === drawer && ["width", "max-width", "flex-basis", "grid-template-columns"].includes(event.propertyName) && view.transitioning) settleCase();
      };
      if (caseElement) { presentCase(); caseBindings.set(id, { toggle: toggleCase }); drawer.addEventListener("transitionend", transitionend); }
      const frame = requestAnimationFrame(() => { rail.scrollLeft = desiredLeft; restored = true; update(); });
      const keydown = (event) => { if (!view.expanded || view.transitioning || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); moveRail(id, event.key === "Home" ? "start" : event.key === "End" ? "end" : event.key === "ArrowLeft" ? -1 : 1); };
      const pointerdown = (event) => { if (!view.expanded || view.transitioning || event.pointerType !== "mouse" || event.button !== 0) return; clearTimeout(releaseTimer); dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, start: rail.scrollLeft, moved: false }; cancelClick = false; };
      const pointermove = (event) => { if (!dragging || event.pointerId !== dragging.id) return; const delta = event.clientX - dragging.x; if (!dragging.moved && Math.abs(delta) > 7 && Math.abs(delta) > Math.abs(event.clientY - dragging.y)) { dragging.moved = true; rail.setPointerCapture(event.pointerId); rail.classList.add("is-dragging"); } if (dragging.moved) { event.preventDefault(); rail.scrollLeft = dragging.start - delta; } };
      const pointerup = (event) => { if (!dragging || event.pointerId !== dragging.id) return; cancelClick = dragging.moved; if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId); dragging = null; rail.classList.remove("is-dragging"); update(); if (cancelClick) releaseTimer = setTimeout(() => { cancelClick = false; }, 80); };
      const click = (event) => { if (cancelClick || !view.expanded || view.transitioning) { event.preventDefault(); event.stopPropagation(); } };
      rail.addEventListener("scroll", update, { passive: true }); rail.addEventListener("keydown", keydown); rail.addEventListener("pointerdown", pointerdown); rail.addEventListener("pointermove", pointermove); rail.addEventListener("click", click, true); window.addEventListener("pointerup", pointerup); window.addEventListener("pointercancel", pointerup);
      const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update); observer?.observe(rail);
      cleanups.push(() => {
        cancelAnimationFrame(frame); cancelAnimationFrame(settleFrame); clearTimeout(releaseTimer); clearTimeout(settleTimer); observer?.disconnect();
        view.transitioning = false; caseBindings.delete(id); drawer?.removeEventListener("transitionend", transitionend);
        rail.removeEventListener("scroll", update); rail.removeEventListener("keydown", keydown); rail.removeEventListener("pointerdown", pointerdown); rail.removeEventListener("pointermove", pointermove); rail.removeEventListener("click", click, true); window.removeEventListener("pointerup", pointerup); window.removeEventListener("pointercancel", pointerup);
      });
    });
    railCleanup = () => cleanups.forEach((cleanup) => cleanup());
  }
  function openMemory(id, trigger) {
    if (draft) { showToast("대표 장면은 꾸미기에서 고를 수 있어요. 먼저 적용하거나 취소해 주세요."); return; }
    const memory = findMemory(id), title = findTitle(memory.titleId), rail = trigger?.closest("[data-rail-id]");
    memoryContext = { trigger, railId: rail?.dataset.railId, left: rail?.scrollLeft || 0, suppress: false };
    memoryDialog.innerHTML = `<header class="dialog-header"><p class="muted">${esc(title.name)}</p>${button("닫기 ×", "close-memory", "quiet", 'aria-label="기억 닫기"')}</header><div class="dialog-body memory-detail-body"><div class="detail-art">${art("scene", memory.scene, `${title.name}의 장면`)}</div><div class="detail-copy"><p class="eyebrow">${dateLabel(memory.date)} · 나만 보기</p><h2 id="memory-dialog-title">${esc(memory.note || title.name)}</h2><div class="dialog-actions">${button("이 작품 보기", "memory-title", "primary", `data-title="${title.id}"`)}</div></div></div>`;
    memoryDialog.setAttribute("aria-labelledby", "memory-dialog-title"); memoryDialog.showModal();
  }
  memoryDialog.addEventListener("close", () => { const context = memoryContext; memoryContext = null; if (!context || context.suppress) return; requestAnimationFrame(() => { const rail = context.railId && app.querySelector(`[data-rail-id="${context.railId}"]`); if (rail) rail.scrollLeft = context.left; if (context.trigger?.isConnected) context.trigger.focus({ preventScroll: true }); }); });
  memoryDialog.addEventListener("click", (event) => { const target = event.target.closest("[data-action]"); if (!target) return; if (target.dataset.action === "close-memory") memoryDialog.close(); if (target.dataset.action === "memory-title") { memoryContext.suppress = true; memoryDialog.close(); navigate("title", target.dataset.title); } });

  function openComposer(titleId = "") {
    if (draft) { showToast("꾸미기를 적용하거나 취소한 뒤 기억을 남겨 주세요."); return; }
    composerContext = { scene: null, titleId: findTitle(titleId) ? titleId : "", note: "" };
    composerDialog.innerHTML = `<header class="dialog-header"><h2 id="composer-title">기억 남기기</h2>${button("닫기 ×", "close-composer", "quiet", 'aria-label="작성 취소"')}</header><form id="composer-form" class="dialog-body"><p class="muted prototype-note">시안용 이미지로 만들어 보세요. 새로고침하면 초기화됩니다.</p><div class="composer-grid"><div><h3>이미지 선택</h3><div class="choice-grid">${[0, 1, 2, 3, 4, 5].map((index) => `<button type="button" class="image-choice" data-scene="${index}" aria-pressed="false" aria-label="${index + 1}번 장면 선택">${art("scene", index, `${index + 1}번 시안 장면`)}</button>`).join("")}</div></div><div class="composer-fields"><label class="field">작품<select class="control" id="composer-title-select" required><option value="">작품을 골라 주세요</option>${titles.map((title) => `<option value="${title.id}" ${title.id === titleId ? "selected" : ""}>${esc(title.name)}</option>`).join("")}</select></label><label class="field"><span>짧은 감상 <span class="muted">(선택)</span></span><textarea class="control" id="composer-note" maxlength="160" rows="4" placeholder="어떤 순간이 남았나요?"></textarea></label><p class="muted" id="composer-hint">이미지와 작품을 선택해 주세요.</p></div></div><div class="dialog-actions">${button("취소", "close-composer", "quiet")}<button type="submit" class="button primary" id="composer-save" disabled>기억 저장</button></div></form>`;
    composerDialog.setAttribute("aria-labelledby", "composer-title"); composerDialog.showModal();
  }
  function updateComposerValidity() { const ready = composerContext.scene !== null && Boolean(composerContext.titleId); document.getElementById("composer-save").disabled = !ready; document.getElementById("composer-hint").textContent = ready ? "나만 보는 기억으로 남깁니다." : composerContext.scene === null ? "이미지를 하나 골라 주세요." : "작품을 골라 주세요."; }
  composerDialog.addEventListener("click", (event) => { const choice = event.target.closest("[data-scene]"); if (choice) { composerContext.scene = Number(choice.dataset.scene); composerDialog.querySelectorAll("[data-scene]").forEach((element) => element.setAttribute("aria-pressed", String(element === choice))); updateComposerValidity(); } if (event.target.closest('[data-action="close-composer"]')) composerDialog.close(); });
  composerDialog.addEventListener("change", (event) => { if (event.target.id === "composer-title-select") { composerContext.titleId = event.target.value; updateComposerValidity(); } });
  composerDialog.addEventListener("input", (event) => { if (event.target.id === "composer-note") composerContext.note = event.target.value; });
  composerDialog.addEventListener("submit", (event) => { event.preventDefault(); if (!composerContext || composerContext.scene === null || !findTitle(composerContext.titleId)) return; const { titleId, scene, note } = composerContext; document.getElementById("composer-save").disabled = true; const sequence = state.nextMemory++; memories.push({ id: `m${sequence}`, titleId, scene, note: note.trim(), date: "2026-10-03", sequence }); composerDialog.close(); titleView(titleId).tab = "memories"; railView(`title-${titleId}`).left = 0; if (state.page === "title" && state.id === titleId) render(); else navigate("title", titleId); showToast("시안에 기억을 추가했어요."); });
  composerDialog.addEventListener("close", () => { composerContext = null; });

  app.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-action]"); if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === "title") navigate("title", target.dataset.id);
    else if (action === "nav") navigate(target.dataset.page);
    else if (action === "memory") openMemory(target.dataset.id, target);
    else if (action === "compose") openComposer(target.dataset.title || "");
    else if (action === "title-back") navigate(state.titleOrigin.page, state.titleOrigin.id);
    else if (action === "save-title") { capturePosition(); const title = findTitle(state.id); title.saved = !title.saved; render({ focusId: "title-save" }); showToast(title.saved ? "작품을 저장했어요. 기억은 그대로예요." : "작품 저장을 해제했어요. 기억은 그대로예요."); }
    else if (action === "filter") { captureRails(); controls.filter = target.dataset.filter; render({ focusId: target.id }); }
    else if (action === "view") { captureRails(); controls.view = target.dataset.view; render({ focusId: target.id }); }
    else if (action === "reset") { captureRails(); controls.query = ""; controls.filter = "all"; render({ focusId: "title-search" }); }
    else if (action === "title-tab") { capturePosition(); titleView().tab = target.dataset.tab; render({ focusId: target.id }); }
    else if (action === "film-layout") { capturePosition(); titleView().layout = titleView().layout === "film" ? "grid" : "film"; render({ focusId: target.id }); }
    else if (action === "case-toggle") caseBindings.get(`row-${target.dataset.title}`)?.toggle();
    else if (action === "rail-prev" || action === "rail-next") moveRail(target.dataset.rail, action === "rail-prev" ? -1 : 1);
    else if (action === "rail-more") { capturePosition(); const id = target.dataset.rail, view = railView(id), firstNew = titleMemories(target.dataset.title)[view.loaded]; view.loaded += 3; render({ focusId: `${id}-${firstNew.id}` }); requestAnimationFrame(() => { const rail = app.querySelector(`[data-rail-id="${id}"]`), frame = document.getElementById(`${id}-${firstNew.id}`); if (rail && frame) rail.scrollTo({ left: frame.offsetLeft - rail.querySelector(".film-frame").offsetLeft, behavior: reduceMotion() ? "instant" : "smooth" }); }); }
    else if (action === "shelf-edit") { draft = clone(bookshelf); render({ focusId: "shelf-name" }); }
    else if (action === "shelf-cancel") cancelShelfEdit();
    else if (action === "shelf-apply") { if (!draft.name.trim()) { showToast("책장 이름을 적어 주세요."); document.getElementById("shelf-name").focus(); return; } if (draft.shelves.some((shelf) => !shelf.name.trim())) { showToast("선반 이름을 적어 주세요."); document.getElementById(`shelf-label-${draft.shelves.find((shelf) => !shelf.name.trim()).id}`).focus(); return; } draft.name = draft.name.trim(); draft.bio = draft.bio.trim(); draft.shelves.forEach((shelf) => { shelf.name = shelf.name.trim(); }); bookshelf = clone(draft); draft = null; render({ focusId: "shelf-edit" }); showToast("책장에 적용했어요. 이 시안에서만 유지됩니다."); }
    else if (action === "shelf-theme" && draft) { draft.theme = target.dataset.theme; rerenderEditor(target.id); }
    else if (["shelf-up", "shelf-down", "shelf-remove"].includes(action) && draft) {
      const shelfId = target.dataset.shelf, titleId = target.dataset.id;
      if (action === "shelf-remove") { toggleShelfTitle(draft, shelfId, titleId); rerenderEditor(`shelf-label-${shelfId}`); }
      else {
        moveShelfTitle(draft, shelfId, titleId, action === "shelf-up" ? -1 : 1);
        const order = draft.shelves.find((shelf) => shelf.id === shelfId).titles, position = order.indexOf(titleId);
        const direction = action === "shelf-up" ? (position === 0 ? "down" : "up") : (position === order.length - 1 ? "up" : "down");
        rerenderEditor(`${direction}-${shelfId}-${titleId}`);
        showToast("진열 순서를 바꿨어요. 적용하면 책장에 반영됩니다.");
      }
    }
  });
  app.addEventListener("input", (event) => {
    const target = event.target;
    if (target.id === "title-search") { captureRails(); railCleanup(); controls.query = target.value; const items = filteredTitles(); document.getElementById("title-results").innerHTML = renderTitleResults(items); app.querySelector(".filter-count").textContent = `${items.length}개 작품`; bindRails(); }
    if (!draft) return;
    if (target.id === "shelf-name") draft.name = target.value;
    else if (target.id === "shelf-bio") draft.bio = target.value;
    else if (target.dataset.shelfLabel) draft.shelves.find((shelf) => shelf.id === target.dataset.shelfLabel).name = target.value;
    else return;
    updateShelfPreview();
  });
  app.addEventListener("change", (event) => {
    const target = event.target;
    if (target.id === "title-sort") { captureRails(); controls.sort = target.value; render({ focusId: target.id }); }
    if (!draft) return;
    if (target.id === "shelf-featured") { draft.featured = target.value; updateShelfPreview(); }
    if (target.dataset.pickShelf) { toggleShelfTitle(draft, target.dataset.pickShelf, target.value); rerenderEditor(target.id, target.dataset.pickShelf); }
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && draft && !document.querySelector("dialog[open]")) { event.preventDefault(); cancelShelfEdit(); } });
  document.querySelectorAll("nav [data-page]").forEach((element) => element.addEventListener("click", () => navigate(element.dataset.page)));
  document.getElementById("global-add")?.addEventListener("click", () => openComposer(state.page === "title" ? state.id : ""));
  window.addEventListener("popstate", () => { if (draft) { history.pushState(null, "", "#home"); showToast("꾸미기를 적용하거나 취소해 주세요."); return; } capturePosition(); Object.assign(state, readRoute()); render({ restorePage: true }); });
  window.addEventListener("hashchange", () => { const route = readRoute(); if (route.page === state.page && route.id === state.id) return; if (draft) { history.replaceState(null, "", "#home"); showToast("꾸미기를 적용하거나 취소해 주세요."); return; } capturePosition(); Object.assign(state, route); render({ restorePage: true }); });
  Object.assign(state, readRoute());
  // This review link opens the proposed presentation; it changes no real preference.
  if (state.page === "titles") controls.view = "album";
  if (!location.hash) history.replaceState(null, "", "#home");
  render();
})();
