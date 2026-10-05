(() => {
  "use strict";

  // This standalone proposal uses invented records held only in this page.
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
  const memories = memoryTitleIds.map((titleId, index) => ({
    id: `m${index + 1}`, titleId, scene: index % 6, note: notes[index],
    date: `2026-09-${String(28 - index).padStart(2, "0")}`, sequence: 18 - index,
  }));
  const boards = [
    { id: "b1", name: "여름의 잔상", description: "햇빛과 바람이 남아 있는 장면들.", ids: ["m1", "m2", "m3", "m4", "m5", "m6", "m10", "m12"] },
    { id: "b2", name: "밤 산책", description: "조용히 다시 보고 싶은 밤.", ids: ["m2", "m7", "m8", "m9", "m14", "m18"] },
    { id: "b3", name: "초록의 기록", description: "마음이 잠깐 쉬어 가는 곳.", ids: ["m3", "m10", "m11", "m16"] },
  ];
  const watchLogs = {
    t1: [
      { date: "2026. 9. 28", event: "다시 봄", note: "첫날의 공기를 다시 느끼고 싶어서." },
      { date: "2026. 9. 20", event: "완료", note: "끝을 보고 나니 시작이 다르게 보였다." },
      { date: "2026년 여름", event: "보기 시작", note: "정확한 날은 기억나지 않지만, 더운 날이었다." },
    ],
    t2: [{ date: "2026. 9. 18", event: "완료", note: "엔딩 음악까지 전부 들었다." }],
    t3: [{ date: "날짜 미상", event: "완료", note: "편지의 마지막 문장이 생각난다." }],
    t6: [{ date: "2026. 9. 6", event: "완료", note: "비 오는 날 다시 보고 싶다." }],
  };
  const controls = { query: "", filter: "all", sort: "recent", view: "poster" };
  const state = { page: "titles", id: "", titleOrigin: { page: "titles", id: "" }, titleViews: new Map(), routeY: new Map(), routeFocus: new Map(), nextMemory: 19, nextBoard: 4 };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const findTitle = (id) => titles.find((title) => title.id === id);
  const findMemory = (id) => memories.find((memory) => memory.id === id);
  const findBoard = (id) => boards.find((board) => board.id === id);
  const titleMemories = (id) => memories.filter((memory) => memory.titleId === id).sort((a, b) => b.sequence - a.sequence);
  const boardMemories = (board) => board.ids.map(findMemory).filter(Boolean);
  const latestSequence = (id) => titleMemories(id)[0]?.sequence || 0;
  const filteredTitles = () => titles.filter((title) => {
    const count = titleMemories(title.id).length;
    if (!title.saved && !count) return false;
    if (controls.query && !`${title.name} ${title.genre}`.replace(/\s/g, "").includes(controls.query.trim().replace(/\s/g, ""))) return false;
    if (controls.filter === "saved" && !title.saved) return false;
    if (controls.filter === "memory" && !count) return false;
    if (controls.filter === "watching" && (!title.saved || title.status !== "보는 중")) return false;
    if (controls.filter === "completed" && (!title.saved || title.status !== "완료")) return false;
    return true;
  }).sort((a, b) => controls.sort === "title" ? a.name.localeCompare(b.name, "ko") : latestSequence(b.id) - latestSequence(a.id) || a.name.localeCompare(b.name, "ko"));
  const addMembership = (board, memoryId) => {
    if (!findMemory(memoryId) || board.ids.includes(memoryId)) return false;
    board.ids.push(memoryId);
    return true;
  };

  function checkModel() {
    const assert = (condition, message) => { if (!condition) throw new Error(`Prototype fixture: ${message}`); };
    assert(titles.length === 8 && memories.length === 18, "seed counts");
    assert(titleMemories("t1").length === 6 && titleMemories("t8").length === 0, "populated and empty titles");
    assert(!findTitle("t4").saved && titleMemories("t4").length === 2, "unsaved title with memories");
    assert(boards.every((board) => new Set(board.ids).size === board.ids.length && board.ids.every(findMemory)), "valid memberships");
    const sampleBoard = { ids: ["m1"] };
    assert(!addMembership(sampleBoard, "m1") && addMembership(sampleBoard, "m2"), "membership uniqueness");
    sampleBoard.ids = sampleBoard.ids.filter((id) => id !== "m1");
    assert(Boolean(findMemory("m1")) && memories.length === 18, "membership removal preserves original");
    const originalSaved = findTitle("t4").saved;
    findTitle("t4").saved = !originalSaved;
    assert(titleMemories("t4").length === 2, "title save independence");
    findTitle("t4").saved = originalSaved;
    const originalFilter = controls.filter;
    controls.filter = "memory";
    const posterIds = filteredTitles().map((title) => title.id).join(",");
    controls.view = "album";
    assert(filteredTitles().map((title) => title.id).join(",") === posterIds, "same collection across views");
    controls.view = "poster";
    controls.filter = originalFilter;
  }
  checkModel();
  if (typeof document === "undefined") return;

  const app = document.getElementById("app");
  const memoryDialog = document.getElementById("memory-dialog");
  const composerDialog = document.getElementById("composer-dialog");
  const boardDialog = document.getElementById("board-dialog");
  const toastElement = document.getElementById("toast");
  if (!app || !memoryDialog || !composerDialog || !boardDialog || !toastElement) throw new Error("Prototype shell is incomplete");
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const routeKey = () => `${state.page}/${state.id}`;
  let toastTimer;
  let memoryContext = null;
  let composerContext = null;
  let boardContext = null;
  let railCleanup = () => {};

  const art = (kind, index, label, extra = "") => {
    const columns = kind === "poster" ? 4 : 3;
    const x = (index % columns) * 100 / (columns - 1);
    const y = Math.floor(index / columns) * 100;
    return `<div class="art ${kind}-art ${extra}" style="--x:${x}%;--y:${y}%" role="img" aria-label="${esc(label)}"></div>`;
  };
  const button = (text, action, extra = "", attributes = "") => `<button type="button" class="button ${extra}" data-action="${action}" ${attributes}>${text}</button>`;
  const dateLabel = (value) => value.replace(/-/g, ". ");
  const memoryTile = (memory, boardId = "") => {
    const title = findTitle(memory.titleId);
    return `<article class="board-memory"><button type="button" class="memory-tile" data-action="memory" data-id="${memory.id}" aria-label="${esc(title.name)}의 기억, ${esc(memory.note || dateLabel(memory.date))}"><div class="memory-image">${art("scene", memory.scene, `${title.name}의 장면`)}</div><div class="memory-info"><h3>${esc(memory.note || title.name)}</h3><p>${esc(title.name)} · ${dateLabel(memory.date)}</p></div></button>${boardId ? button("보드에서 빼기", "remove", "quiet remove-memory", `data-id="${memory.id}" data-board="${boardId}"`) : ""}</article>`;
  };
  const posterTile = (title) => `<button type="button" class="poster-tile" data-action="title" data-id="${title.id}">${art("poster", title.poster, `${title.name} 가상 작품 표지`)}<div class="poster-info"><span class="poster-title">${esc(title.name)}</span><p class="poster-meta">${title.saved ? esc(title.status || "저장됨") : "미저장"} · 기억 ${titleMemories(title.id).length}개</p></div></button>`;
  const albumTile = (title) => {
    const items = titleMemories(title.id);
    return `<button type="button" class="album-card" data-action="title" data-id="${title.id}"><div class="album-cover">${art("poster", title.poster, `${title.name} 가상 작품 표지`)}</div><div class="album-info"><h3>${esc(title.name)}</h3><p class="muted">${title.saved ? esc(title.status || "저장됨") : "미저장"} · 기억 ${items.length}개</p>${items.length ? `<div class="album-previews">${items.slice(0, 3).map((memory) => `<div class="album-preview">${art("scene", memory.scene, `${title.name}의 기억`)}</div>`).join("")}</div><p class="album-note">${esc(items[0].note)}</p>` : '<p class="album-note muted">아직 남긴 기억이 없어요</p>'}</div></button>`;
  };
  const boardCard = (board) => {
    const items = boardMemories(board).slice(0, 3);
    return `<button type="button" class="board-card" data-action="board" data-id="${board.id}"><div class="board-collage" data-count="${items.length}">${items.length ? items.map((memory) => `<div class="collage-cell">${art("scene", memory.scene, `${board.name}의 기억`)}</div>`).join("") : '<span class="muted">첫 기억을 담아 보세요</span>'}</div><h3>${esc(board.name)}</h3><p class="muted">기억 ${board.ids.length}개 · 나만 보기</p></button>`;
  };
  const empty = (heading, body = "", action = "") => `<section class="empty-state"><h2>${heading}</h2>${body ? `<p class="muted">${body}</p>` : ""}${action}</section>`;

  function showToast(message) {
    clearTimeout(toastTimer);
    toastElement.textContent = message;
    toastElement.hidden = false;
    toastElement.classList.add("visible");
    toastTimer = setTimeout(() => { toastElement.classList.remove("visible"); toastElement.hidden = true; }, 3800);
  }
  function titleView(id = state.id) {
    if (!state.titleViews.has(id)) state.titleViews.set(id, { tab: "memories", layout: "film", left: 0, index: 0 });
    return state.titleViews.get(id);
  }
  function capturePosition() {
    state.routeY.set(routeKey(), window.scrollY);
    const active = document.activeElement;
    if (active && app.contains(active)) {
      if (active.id) state.routeFocus.set(routeKey(), `#${CSS.escape(active.id)}`);
      else if (active.dataset.action && active.dataset.id) state.routeFocus.set(routeKey(), `[data-action="${active.dataset.action}"][data-id="${active.dataset.id}"]`);
    }
    const rail = document.getElementById("film-rail");
    if (rail && state.page === "title") titleView().left = rail.scrollLeft;
  }
  function navigate(page, id = "") {
    capturePosition();
    if (page === "title" && state.page !== "title") state.titleOrigin = { page: state.page, id: state.id };
    const hash = `#${page}${id ? `/${id}` : ""}`;
    if (location.hash === hash) render({ restorePage: true });
    else location.hash = hash;
  }
  function readRoute() {
    const [page, id = ""] = location.hash.slice(1).split("/");
    if (page === "title" && findTitle(id)) return { page, id };
    if (page === "board" && findBoard(id)) return { page, id };
    if (["home", "titles", "memories", "boards"].includes(page)) return { page, id: "" };
    return { page: "titles", id: "" };
  }
  function renderTitles() {
    const items = filteredTitles();
    const filters = [["all", "전체"], ["saved", "저장됨"], ["memory", "기억 있음"], ["watching", "보는 중"], ["completed", "완료"]];
    return `<header class="page-heading"><div><p class="eyebrow">모아 둔 작품</p><h1>내 작품 <span class="muted">${titles.filter((title) => title.saved || titleMemories(title.id).length).length}</span></h1></div>${button("기억 남기기", "compose", "primary")}</header><div class="toolbar"><label class="search-field"><span class="sr-only">내 작품 검색</span><input id="title-search" class="control" type="search" placeholder="작품이나 장르 찾기" value="${esc(controls.query)}" autocomplete="off"></label><label class="sort-field"><span class="sr-only">작품 정렬</span><select id="title-sort" class="control"><option value="recent" ${controls.sort === "recent" ? "selected" : ""}>최근 기억순</option><option value="title" ${controls.sort === "title" ? "selected" : ""}>제목순</option></select></label><div class="segmented" role="group" aria-label="작품 보기">${button("표지 보기", "view", "", `data-view="poster" aria-pressed="${controls.view === "poster"}" id="view-poster"`)}${button("기억 함께 보기", "view", "", `data-view="album" aria-pressed="${controls.view === "album"}" id="view-album"`)}</div></div><div class="filters" aria-label="작품 필터">${filters.map(([key, label]) => `<button type="button" class="chip" data-action="filter" data-filter="${key}" aria-pressed="${controls.filter === key}" id="filter-${key}">${label}</button>`).join("")}<span class="filter-count muted" role="status">${items.length}개 작품</span></div><div id="title-results">${renderTitleResults(items)}</div>`;
  }
  function renderTitleResults(items) {
    return items.length ? `<section class="${controls.view === "poster" ? "poster-grid" : "album-grid"}" aria-label="내 작품 목록">${items.map(controls.view === "poster" ? posterTile : albumTile).join("")}</section>` : empty("찾는 작품이 없어요", "검색어나 필터를 바꿔 보세요.", button("검색 초기화", "reset", "quiet"));
  }
  function renderTitle() {
    const title = findTitle(state.id);
    const items = titleMemories(title.id);
    const view = titleView();
    const logs = watchLogs[title.id] || [];
    const identity = `${button("← 돌아가기", "title-back", "quiet back-button")}<section class="title-identity"><div class="title-cover">${art("poster", title.poster, `${title.name} 가상 작품 표지`)}</div><div class="title-info"><p class="eyebrow">${title.year} · ${esc(title.genre)}</p><h1>${esc(title.name)}</h1><p class="muted">${title.saved ? esc(title.status || "저장됨") : "미저장"} · 기억 ${items.length}개</p><div class="title-actions">${button("기억 남기기", "compose", "primary", `data-title="${title.id}"`)}${button(title.saved ? "작품 저장됨 ✓" : "작품 저장", "save-title", "", `aria-pressed="${title.saved}" id="title-save"`)}</div></div></section>`;
    const tabs = `<div class="section-head"><div class="segmented" role="group" aria-label="작품 안에서 보기">${button(`기억 ${items.length}`, "title-tab", "", `data-tab="memories" aria-pressed="${view.tab === "memories"}" id="tab-memories"`)}${button(`시청 기록 ${logs.length}`, "title-tab", "", `data-tab="watch" aria-pressed="${view.tab === "watch"}" id="tab-watch"`)}</div>${view.tab === "memories" && items.length ? button(view.layout === "film" ? "전체 보기" : "필름으로 보기", "film-layout", "quiet", 'id="film-layout"') : ""}</div>`;
    if (view.tab === "watch") {
      const logContents = logs.length
        ? `<section class="watch-list" aria-label="시청 기록">${logs.map((log) => `<article class="watch-entry"><time>${log.date}</time><div class="watch-copy"><h3>${log.event}</h3><p>${esc(log.note)}</p></div></article>`).join("")}</section>`
        : empty("아직 시청 기록이 없어요", "기억과 시청 기록은 따로 모아 봅니다.");
      return identity + tabs + logContents;
    }
    if (!items.length) return identity + tabs + empty("아직 남긴 기억이 없어요", "이 작품에서 기억하고 싶은 장면을 남겨 보세요.", button("첫 기억 남기기", "compose", "primary", `data-title="${title.id}"`));
    if (view.layout === "grid") return identity + tabs + `<section class="memory-grid" aria-label="이 작품의 기억">${items.map((memory) => memoryTile(memory)).join("")}</section>`;
    return identity + tabs + `<section class="film-shell" aria-label="이 작품의 기억 필름"><div id="film-rail" class="film-rail" tabindex="0" aria-label="기억 필름. 좌우 화살표로 이동">${items.map((memory, index) => `<button type="button" class="film-frame" data-action="memory" data-id="${memory.id}" data-frame="${index}" aria-label="${index + 1}번째 기억, ${esc(memory.note || title.name)}"><div class="frame-image">${art("scene", memory.scene, `${title.name}의 장면`)}</div><span class="frame-caption"><span>${esc(memory.note || title.name)}</span><small>${dateLabel(memory.date)}</small></span></button>`).join("")}</div><div class="film-footer"><p class="muted"><span id="film-position" aria-live="polite">${view.index + 1} / ${items.length}</span><span class="film-hint"> · 옆으로 넘겨 보세요</span></p><div class="film-buttons">${button("← 이전", "film-prev", "", 'id="film-prev" aria-label="이전 기억으로 이동"')}${button("다음 →", "film-next", "", 'id="film-next" aria-label="다음 기억으로 이동"')}</div></div></section>`;
  }
  function renderHome() {
    const recent = [...memories].sort((a, b) => b.sequence - a.sequence).slice(0, 6);
    return `<header class="page-heading"><div><p class="eyebrow">나의 필름집</p><h1>다시 펼쳐 보는 장면들</h1></div>${button("기억 남기기", "compose", "primary")}</header><div class="section-head"><h2>최근 남긴 기억</h2>${button("모든 기억 보기 →", "nav", "quiet", 'data-page="memories"')}</div><section class="memory-grid">${recent.map((memory) => memoryTile(memory)).join("")}</section><div class="section-head"><h2>내 작품</h2>${button("모든 작품 보기 →", "nav", "quiet", 'data-page="titles"')}</div><section class="poster-grid">${titles.slice(0, 4).map(posterTile).join("")}</section>`;
  }
  function renderMemories() {
    return `<header class="page-heading"><div><p class="eyebrow">모든 장면을 한곳에</p><h1>기억 아카이브 <span class="muted">${memories.length}</span></h1></div>${button("기억 남기기", "compose", "primary")}</header><section class="memory-grid">${[...memories].sort((a, b) => b.sequence - a.sequence).map((memory) => memoryTile(memory)).join("")}</section>`;
  }
  function renderBoards() {
    return `<header class="page-heading"><div><p class="eyebrow">함께 보고 싶은 기억</p><h1>보드 <span class="muted">${boards.length}</span></h1></div>${button("새 보드", "new-board", "primary")}</header><section class="board-grid">${boards.map(boardCard).join("")}</section>`;
  }
  function renderBoard() {
    const board = findBoard(state.id);
    const items = boardMemories(board);
    return `${button("← 보드 목록", "nav", "quiet back-button", 'data-page="boards"')}<header class="page-heading"><div><p class="eyebrow">나만 보기 · 기억 ${items.length}개</p><h1>${esc(board.name)}</h1><p class="muted">${esc(board.description)}</p></div>${button("기억 담기", "board-pick", "primary", `data-board="${board.id}"`)}</header>${items.length ? `<section class="memory-grid" aria-label="보드의 기억">${items.map((memory) => memoryTile(memory, board.id)).join("")}</section>` : empty("함께 보고 싶은 기억을 담아 보세요", "보드에서 빼도 기억은 아카이브에 남아요.", button("기억 선택", "board-pick", "primary", `data-board="${board.id}"`))}`;
  }
  function render({ restorePage = false, focusId = "" } = {}) {
    railCleanup();
    const active = document.activeElement;
    const selection = active?.id === "title-search" ? [active.selectionStart, active.selectionEnd] : null;
    const renderers = { home: renderHome, titles: renderTitles, title: renderTitle, memories: renderMemories, boards: renderBoards, board: renderBoard };
    app.innerHTML = renderers[state.page]();
    document.querySelectorAll("nav [data-page]").forEach((element) => {
      const current = element.dataset.page === (state.page === "title" ? "titles" : state.page === "board" ? "boards" : state.page);
      if (current) element.setAttribute("aria-current", "page"); else element.removeAttribute("aria-current");
    });
    bindFilm();
    requestAnimationFrame(() => {
      if (restorePage) {
        window.scrollTo({ top: state.routeY.get(routeKey()) || 0, behavior: "instant" });
        const savedFocus = state.routeFocus.get(routeKey());
        const focusTarget = savedFocus ? app.querySelector(savedFocus) : app;
        focusTarget?.focus({ preventScroll: true });
      }
      if (focusId) {
        const element = document.getElementById(focusId);
        element?.focus({ preventScroll: true });
        if (selection && element?.id === "title-search" && typeof element.setSelectionRange === "function") {
          try { element.setSelectionRange(...selection); } catch { /* search inputs need no manual selection restoration */ }
        }
      }
    });
  }
  function moveFilm(direction) {
    const rail = document.getElementById("film-rail");
    if (!rail) return;
    const frames = [...rail.querySelectorAll(".film-frame")];
    const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const positions = [...new Set(frames.map((frame) => Math.min(max, frame.offsetLeft - frames[0].offsetLeft)))];
    const target = direction > 0
      ? positions.find((position) => position > rail.scrollLeft + 2) ?? max
      : [...positions].reverse().find((position) => position < rail.scrollLeft - 2) ?? 0;
    rail.scrollTo({ left: target, behavior: reduceMotion() ? "instant" : "smooth" });
  }
  function bindFilm() {
    const rail = document.getElementById("film-rail");
    if (!rail) return;
    const view = titleView();
    const frames = [...rail.querySelectorAll(".film-frame")];
    let dragging = null;
    let cancelClick = false;
    const update = () => {
      view.left = rail.scrollLeft;
      const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
      view.index = atEnd ? frames.length - 1 : frames.reduce((best, frame, index) => Math.abs(frame.offsetLeft - frames[0].offsetLeft - rail.scrollLeft) < Math.abs(frames[best].offsetLeft - frames[0].offsetLeft - rail.scrollLeft) ? index : best, 0);
      document.getElementById("film-position").textContent = `${view.index + 1} / ${frames.length}`;
      document.getElementById("film-prev").disabled = rail.scrollLeft <= 1;
      document.getElementById("film-next").disabled = atEnd;
    };
    const desiredLeft = view.left;
    const scrollFrame = requestAnimationFrame(() => { rail.scrollLeft = desiredLeft; update(); });
    const keydown = (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      moveFilm(event.key === "ArrowLeft" ? -1 : 1);
    };
    const pointerdown = (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, start: rail.scrollLeft, moved: false };
      cancelClick = false;
    };
    const pointermove = (event) => {
      if (!dragging || event.pointerId !== dragging.id) return;
      const distance = event.clientX - dragging.x;
      if (!dragging.moved && Math.abs(distance) > 7 && Math.abs(distance) > Math.abs(event.clientY - dragging.y)) {
        dragging.moved = true;
        rail.setPointerCapture(event.pointerId);
        rail.classList.add("is-dragging");
      }
      if (dragging.moved) { event.preventDefault(); rail.scrollLeft = dragging.start - distance; }
    };
    const pointerup = (event) => {
      if (!dragging || event.pointerId !== dragging.id) return;
      cancelClick = dragging.moved;
      if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
      dragging = null;
      rail.classList.remove("is-dragging");
      update();
      if (cancelClick) setTimeout(() => { cancelClick = false; }, 0);
    };
    const click = (event) => { if (cancelClick) { event.preventDefault(); event.stopPropagation(); } };
    rail.addEventListener("scroll", update, { passive: true });
    rail.addEventListener("keydown", keydown);
    rail.addEventListener("pointerdown", pointerdown);
    rail.addEventListener("pointermove", pointermove);
    rail.addEventListener("click", click, true);
    window.addEventListener("pointerup", pointerup);
    window.addEventListener("pointercancel", pointerup);
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    resizeObserver?.observe(rail);
    railCleanup = () => {
      cancelAnimationFrame(scrollFrame);
      resizeObserver?.disconnect();
      rail.removeEventListener("scroll", update);
      rail.removeEventListener("keydown", keydown);
      rail.removeEventListener("pointerdown", pointerdown);
      rail.removeEventListener("pointermove", pointermove);
      rail.removeEventListener("click", click, true);
      window.removeEventListener("pointerup", pointerup);
      window.removeEventListener("pointercancel", pointerup);
    };
  }

  function openMemory(id, trigger) {
    const memory = findMemory(id);
    const title = findTitle(memory.titleId);
    const rail = document.getElementById("film-rail");
    memoryContext = { id, trigger, left: rail?.scrollLeft || 0, suppress: false };
    memoryDialog.innerHTML = `<header class="dialog-header"><p class="muted">${esc(title.name)}</p>${button("닫기 ×", "close-memory", "quiet", 'aria-label="기억 닫기"')}</header><div class="dialog-body memory-detail-body"><div class="detail-art">${art("scene", memory.scene, `${title.name}의 장면`)}</div><div class="detail-copy"><p class="eyebrow">${dateLabel(memory.date)} · 나만 보기</p><h2 id="memory-dialog-title">${esc(memory.note || title.name)}</h2><div class="dialog-actions">${button("보드에 담기", "memory-board", "primary", `data-id="${memory.id}"`)}${button("이 작품 보기", "memory-title", "", `data-title="${title.id}"`)}</div></div></div>`;
    memoryDialog.setAttribute("aria-labelledby", "memory-dialog-title");
    memoryDialog.showModal();
  }
  memoryDialog.addEventListener("close", () => {
    const context = memoryContext;
    memoryContext = null;
    if (!context || context.suppress) return;
    requestAnimationFrame(() => {
      const rail = document.getElementById("film-rail");
      if (rail) rail.scrollLeft = context.left;
      if (context.trigger?.isConnected) context.trigger.focus({ preventScroll: true });
    });
  });
  memoryDialog.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    if (target.dataset.action === "close-memory") memoryDialog.close();
    if (target.dataset.action === "memory-board") openBoardPicker(target.dataset.id);
    if (target.dataset.action === "memory-title") {
      memoryContext.suppress = true;
      memoryDialog.close();
      navigate("title", target.dataset.title);
    }
  });

  function openComposer(titleId = "") {
    composerContext = { scene: null, titleId: findTitle(titleId) ? titleId : "", note: "", trigger: document.activeElement };
    composerDialog.innerHTML = `<header class="dialog-header"><h2 id="composer-title">기억 남기기</h2>${button("닫기 ×", "close-composer", "quiet", 'aria-label="작성 취소"')}</header><form id="composer-form" class="dialog-body"><p class="muted prototype-note">시안용 이미지로 만들어 보세요. 새로고침하면 초기화됩니다.</p><div class="composer-grid"><div><h3>이미지 선택</h3><div class="choice-grid">${[0, 1, 2, 3, 4, 5].map((index) => `<button type="button" class="image-choice" data-scene="${index}" aria-pressed="false" aria-label="${index + 1}번 장면 선택">${art("scene", index, `${index + 1}번 시안 장면`)}</button>`).join("")}</div></div><div class="composer-fields"><label class="field">작품<select class="control" id="composer-title-select" required><option value="">작품을 골라 주세요</option>${titles.map((title) => `<option value="${title.id}" ${title.id === titleId ? "selected" : ""}>${esc(title.name)}</option>`).join("")}</select></label><label class="field"><span>짧은 감상 <span class="muted">(선택)</span></span><textarea class="control" id="composer-note" maxlength="160" rows="4" placeholder="어떤 순간이 남았나요?"></textarea></label><p class="muted" id="composer-hint">이미지와 작품을 선택해 주세요.</p></div></div><div class="dialog-actions">${button("취소", "close-composer", "quiet")}<button type="submit" class="button primary" id="composer-save" disabled>기억 저장</button></div></form>`;
    composerDialog.setAttribute("aria-labelledby", "composer-title");
    composerDialog.showModal();
  }
  function updateComposerValidity() {
    const ready = composerContext.scene !== null && Boolean(composerContext.titleId);
    document.getElementById("composer-save").disabled = !ready;
    document.getElementById("composer-hint").textContent = ready ? "나만 보는 기억으로 남깁니다." : composerContext.scene === null ? "이미지를 하나 골라 주세요." : "작품을 골라 주세요.";
  }
  composerDialog.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-scene]");
    if (choice) {
      composerContext.scene = Number(choice.dataset.scene);
      composerDialog.querySelectorAll("[data-scene]").forEach((element) => element.setAttribute("aria-pressed", String(element === choice)));
      updateComposerValidity();
    }
    if (event.target.closest('[data-action="close-composer"]')) composerDialog.close();
  });
  composerDialog.addEventListener("change", (event) => {
    if (event.target.id === "composer-title-select") { composerContext.titleId = event.target.value; updateComposerValidity(); }
  });
  composerDialog.addEventListener("input", (event) => { if (event.target.id === "composer-note") composerContext.note = event.target.value; });
  composerDialog.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!composerContext || composerContext.scene === null || !findTitle(composerContext.titleId)) return;
    const { titleId, scene, note } = composerContext;
    document.getElementById("composer-save").disabled = true;
    const id = `m${state.nextMemory++}`;
    memories.push({ id, titleId, scene, note: note.trim(), date: "2026-10-03", sequence: state.nextMemory });
    composerDialog.close();
    const view = titleView(titleId);
    view.tab = "memories"; view.left = 0; view.index = 0;
    if (state.page === "title" && state.id === titleId) render(); else navigate("title", titleId);
    showToast("시안에 기억을 추가했어요");
  });
  composerDialog.addEventListener("close", () => { composerContext = null; });

  function openBoardPicker(memoryId) {
    boardContext = { type: "add-memory", memoryId };
    boardDialog.innerHTML = `<header class="dialog-header"><h2 id="board-dialog-title">보드에 담기</h2>${button("닫기 ×", "close-board", "quiet", 'aria-label="보드 선택 닫기"')}</header><div class="dialog-body"><p class="muted">같은 기억을 여러 보드에 담을 수 있어요.</p><div class="board-picker-list">${boards.map((board) => `<button type="button" class="board-pick-row" data-add-board="${board.id}" ${board.ids.includes(memoryId) ? "disabled" : ""}><span>${esc(board.name)}</span><span class="muted">${board.ids.includes(memoryId) ? "담긴 보드 ✓" : "담기 ＋"}</span></button>`).join("")}</div></div>`;
    boardDialog.setAttribute("aria-labelledby", "board-dialog-title");
    boardDialog.showModal();
  }
  function openBoardMemories(boardId) {
    const board = findBoard(boardId);
    boardContext = { type: "pick-memories", boardId };
    boardDialog.innerHTML = `<header class="dialog-header"><h2 id="board-dialog-title">기억 담기</h2>${button("닫기 ×", "close-board", "quiet", 'aria-label="기억 선택 닫기"')}</header><div class="dialog-body"><p class="muted">${esc(board.name)}</p><div class="memory-picker-grid">${memories.map((memory) => `<button type="button" class="image-choice memory-choice" data-add-memory="${memory.id}" ${board.ids.includes(memory.id) ? "disabled" : ""}>${art("scene", memory.scene, findTitle(memory.titleId).name)}<span>${esc(findTitle(memory.titleId).name)}</span><small>${board.ids.includes(memory.id) ? "담았어요 ✓" : "담기 ＋"}</small></button>`).join("")}</div></div>`;
    boardDialog.setAttribute("aria-labelledby", "board-dialog-title");
    boardDialog.showModal();
  }
  function openNewBoard() {
    boardContext = { type: "create" };
    boardDialog.innerHTML = `<header class="dialog-header"><h2 id="board-dialog-title">새 보드</h2>${button("닫기 ×", "close-board", "quiet", 'aria-label="보드 만들기 취소"')}</header><form id="new-board-form" class="dialog-body"><label class="field">보드 이름<input class="control" id="new-board-name" maxlength="40" placeholder="함께 모으고 싶은 기억" required></label><div class="dialog-actions">${button("취소", "close-board", "quiet")}<button type="submit" class="button primary" id="new-board-save" disabled>보드 만들기</button></div></form>`;
    boardDialog.setAttribute("aria-labelledby", "board-dialog-title");
    boardDialog.showModal();
  }
  boardDialog.addEventListener("click", (event) => {
    if (event.target.closest('[data-action="close-board"]')) { boardDialog.close(); return; }
    const boardButton = event.target.closest("[data-add-board]");
    const memoryButton = event.target.closest("[data-add-memory]");
    if (boardButton && !boardButton.disabled && boardContext?.type === "add-memory") {
      if (addMembership(findBoard(boardButton.dataset.addBoard), boardContext.memoryId)) {
        boardButton.disabled = true;
        boardButton.lastElementChild.textContent = "담긴 보드 ✓";
        showToast("보드에 담았어요");
      }
    }
    if (memoryButton && !memoryButton.disabled && boardContext?.type === "pick-memories") {
      if (addMembership(findBoard(boardContext.boardId), memoryButton.dataset.addMemory)) {
        memoryButton.disabled = true;
        memoryButton.querySelector("small").textContent = "담았어요 ✓";
        showToast("보드에 담았어요");
      }
    }
  });
  boardDialog.addEventListener("input", (event) => { if (event.target.id === "new-board-name") document.getElementById("new-board-save").disabled = !event.target.value.trim(); });
  boardDialog.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("new-board-name")?.value.trim();
    if (boardContext?.type !== "create" || !name) return;
    const board = { id: `b${state.nextBoard++}`, name, description: "", ids: [] };
    boards.push(board);
    boardDialog.close();
    navigate("board", board.id);
    showToast("시안에 새 보드를 만들었어요");
  });
  boardDialog.addEventListener("close", () => {
    const context = boardContext;
    boardContext = null;
    if (context?.type === "pick-memories" || (context?.type === "add-memory" && ["board", "boards"].includes(state.page))) {
      const activeMemory = memoryContext;
      capturePosition();
      render();
      if (activeMemory) activeMemory.trigger = app.querySelector(`[data-action="memory"][data-id="${activeMemory.id}"]`);
      else requestAnimationFrame(() => app.querySelector('[data-action="board-pick"]')?.focus({ preventScroll: true }));
    }
  });

  app.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-action]");
    if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === "title") navigate("title", target.dataset.id);
    else if (action === "board") navigate("board", target.dataset.id);
    else if (action === "nav") navigate(target.dataset.page);
    else if (action === "memory") openMemory(target.dataset.id, target);
    else if (action === "compose") openComposer(target.dataset.title || "");
    else if (action === "new-board") openNewBoard();
    else if (action === "board-pick") openBoardMemories(target.dataset.board);
    else if (action === "title-back") navigate(state.titleOrigin.page, state.titleOrigin.id);
    else if (action === "save-title") {
      capturePosition();
      const title = findTitle(state.id);
      title.saved = !title.saved;
      render({ focusId: "title-save" });
      showToast(title.saved ? "작품을 저장했어요. 기억은 그대로예요." : "작품 저장을 해제했어요. 기억은 그대로예요.");
    } else if (action === "filter") { controls.filter = target.dataset.filter; render({ focusId: target.id }); }
    else if (action === "view") { controls.view = target.dataset.view; render({ focusId: target.id }); }
    else if (action === "reset") { controls.query = ""; controls.filter = "all"; render({ focusId: "title-search" }); }
    else if (action === "title-tab") { capturePosition(); titleView().tab = target.dataset.tab; render({ focusId: target.id }); }
    else if (action === "film-layout") { capturePosition(); titleView().layout = titleView().layout === "film" ? "grid" : "film"; render({ focusId: "film-layout" }); }
    else if (action === "film-prev") moveFilm(-1);
    else if (action === "film-next") moveFilm(1);
    else if (action === "remove") {
      const board = findBoard(target.dataset.board);
      board.ids = board.ids.filter((id) => id !== target.dataset.id);
      render();
      app.querySelector('[data-action="board-pick"]')?.focus({ preventScroll: true });
      showToast("이 보드에서 뺐어요. 기억은 그대로 남아 있어요.");
    }
  });
  app.addEventListener("input", (event) => {
    if (event.target.id === "title-search") {
      controls.query = event.target.value;
      const items = filteredTitles();
      document.getElementById("title-results").innerHTML = renderTitleResults(items);
      app.querySelector(".filter-count").textContent = `${items.length}개 작품`;
    }
  });
  app.addEventListener("change", (event) => {
    if (event.target.id === "title-sort") { controls.sort = event.target.value; render({ focusId: "title-sort" }); }
  });
  document.querySelectorAll("nav [data-page]").forEach((element) => element.addEventListener("click", () => navigate(element.dataset.page)));
  document.getElementById("global-add")?.addEventListener("click", () => openComposer(state.page === "title" ? state.id : ""));
  window.addEventListener("hashchange", () => { capturePosition(); Object.assign(state, readRoute()); render({ restorePage: true }); });
  Object.assign(state, readRoute());
  if (!location.hash) history.replaceState(null, "", "#titles");
  render();
})();
