(() => {
  "use strict";

  // V8 stable curated cover grid with one row-attached film panel. Earlier prototypes remain unchanged.
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
    "강변의 밤", "자전거가 지나간 길", "보라색 반사광",
    "편지 한 장", "초록이 가득한 장면", "창가 자리",
    "다시 읽고 싶은 오후", "별을 기다리는 사람", "눈 덮인 관측소",
    "비 오는 골목", "마지막 전차", "노란 우산",
  ];
  const memoryTitleIds = ["t1", "t1", "t1", "t1", "t1", "t1", "t2", "t2", "t2", "t3", "t3", "t4", "t4", "t5", "t5", "t6", "t6", "t7"];
  const visuals = [
    ...["해안 철도", "창가의 아이스티", "바닷가 역", "여름의 엽서", "해 질 녘 바다", "밤 기차"].map((label, index) => ({ sheet: "prototype-scenes.png", columns: 3, rows: 2, cell: index, ratio: "16/9", titleId: "t1", label })),
    { sheet: "collection-portraits.png", columns: 2, rows: 2, cell: 0, ratio: "2/3", titleId: "t2", label: "밤의 자전거 여행" },
    { sheet: "collection-wides.png", columns: 2, rows: 2, cell: 0, ratio: "1672/941", titleId: "t2", label: "도시의 강변" },
    { sheet: "collection-squares.png", columns: 2, rows: 2, cell: 0, ratio: "1/1", titleId: "t2", label: "네온빛 물웅덩이" },
    { sheet: "collection-squares.png", columns: 2, rows: 2, cell: 1, ratio: "1/1", titleId: "t3", label: "숲에서 온 편지" },
    { sheet: "collection-portraits.png", columns: 2, rows: 2, cell: 1, ratio: "2/3", titleId: "t3", label: "초록의 우편배달부" },
    { sheet: "collection-wides.png", columns: 2, rows: 2, cell: 1, ratio: "1672/941", titleId: "t4", label: "오후의 도서관" },
    { sheet: "collection-squares.png", columns: 2, rows: 2, cell: 2, ratio: "1/1", titleId: "t4", label: "햇빛이 머문 의자" },
    { sheet: "collection-portraits.png", columns: 2, rows: 2, cell: 2, ratio: "2/3", titleId: "t5", label: "별을 기다리는 사람" },
    { sheet: "collection-wides.png", columns: 2, rows: 2, cell: 2, ratio: "1672/941", titleId: "t5", label: "설산의 천문대" },
    { sheet: "collection-squares.png", columns: 2, rows: 2, cell: 3, ratio: "1/1", titleId: "t6", label: "비 내리는 붉은 거리" },
    { sheet: "collection-wides.png", columns: 2, rows: 2, cell: 3, ratio: "1672/941", titleId: "t6", label: "빗속을 지나는 트램" },
    { sheet: "collection-portraits.png", columns: 2, rows: 2, cell: 3, ratio: "2/3", titleId: "t7", label: "초원의 노란 우산" },
  ];
  const seedMemories = memoryTitleIds.map((titleId, index) => ({ id: `m${index + 1}`, titleId, scene: index, note: notes[index], date: `2026-09-${String(28 - index).padStart(2, "0")}`, sequence: 18 - index }));
  let memories = [...seedMemories];
  const collectionOrder = ["m7", "m1", "m10", "m14", "m2", "m12", "m16", "m3", "m18", "m8", "m4", "m11", "m13", "m5", "m15", "m17", "m6", "m9"];
  const memoryControls = { query: "", lastAdded: "" };
  const normalizeSearch = (value) => String(value).toLocaleLowerCase("ko").replace(/\s/g, "");
  const orderedMemories = () => [...memories.filter((memory) => !collectionOrder.includes(memory.id)).sort((a, b) => b.sequence - a.sequence), ...collectionOrder.map((id) => memories.find((memory) => memory.id === id)).filter(Boolean)];
  const searchedMemories = () => orderedMemories().filter((memory) => normalizeSearch(`${findTitle(memory.titleId).name} ${memory.note}`).includes(normalizeSearch(memoryControls.query)));
  const canSaveMemory = (value) => value && Number.isInteger(value.scene) && Boolean(visuals[value.scene]) && Boolean(findTitle(value.titleId));
  function masonryPositions(heights, columns, gap, width) {
    const columnWidth = Math.max(0, (width - gap * (columns - 1)) / columns), bottoms = Array(columns).fill(0);
    const positions = heights.map((height) => {
      const column = bottoms.indexOf(Math.min(...bottoms)), top = bottoms[column];
      bottoms[column] += height + gap;
      return { left: column * (columnWidth + gap), top, width: columnWidth };
    });
    return { positions, height: Math.max(0, ...bottoms) - (heights.length ? gap : 0) };
  }
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
  const state = { page: "home", id: "", titleOrigin: { page: "home", id: "" }, titleViews: new Map(), rails: new Map(), routeY: new Map(), routeFocus: new Map(), homeOpen: "", activeShelf: "all", nextMemory: 19 };
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
  function shelfTitleIds(model, shelfId = "all") {
    const selected = shelfId === "all" ? model.shelves : model.shelves.filter((shelf) => shelf.id === shelfId);
    return [...new Set(selected.flatMap((shelf) => shelf.titles))].filter((id) => findTitle(id));
  }
  function shelfRowEnd(index, columns, total) {
    if (index < 0 || total < 1) return -1;
    return Math.min(total - 1, (Math.floor(index / Math.max(1, columns)) + 1) * Math.max(1, columns) - 1);
  }
  function resolvePullTarget(width, minimum, maximum, distance, initialExpanded) {
    const span = maximum - minimum;
    if (span <= 1) return initialExpanded;
    const directionalThreshold = Math.max(18, Math.min(56, span * 0.2));
    if (Math.abs(distance) >= directionalThreshold) return distance > 0;
    return width >= minimum + span / 2;
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
    assert(resolvePullTarget(275, 200, 900, 75, false), "clear outward drag opens");
    assert(!resolvePullTarget(825, 200, 900, -75, true), "clear inward drag closes");
    assert(!resolvePullTarget(205, 200, 900, 5, false) && resolvePullTarget(895, 200, 900, -5, true), "small movement settles to nearer endpoint");
    state.rails.delete("row-t1");
    assert(visuals.length === 18 && new Set(visuals.map((visual) => `${visual.sheet}/${visual.cell}`)).size === 18, "18 distinct visual cells");
    assert(memories.every((memory) => visuals[memory.scene].titleId === memory.titleId), "visuals match fictional titles");
    assert(new Set(orderedMemories().map((memory) => memory.id)).size === 18 && orderedMemories()[0].id === "m7", "interleaved collection preserves every memory");
    assert(!canSaveMemory({ scene: null, titleId: "t4" }) && !canSaveMemory({ scene: 0, titleId: "" }) && canSaveMemory({ scene: 11, titleId: "t4" }), "explicit visual and title gate");
    const masonry = masonryPositions([100, 200, 50, 70], 2, 10, 210);
    assert(masonry.positions[2].left === 0 && masonry.positions[2].top === 110 && masonry.positions[3].top === 170 && masonry.height === 240, "shortest-column placement in source order");
    memoryControls.query = "별을 건너는"; assert(searchedMemories().length === 3, "archive searches title");
    memoryControls.query = "아무 말"; assert(searchedMemories().length === 1, "archive searches optional note");
    memoryControls.query = "";
    const domain = JSON.stringify({ titles, boards, watchLogs }), populated = memories;
    memories = [];
    assert(orderedMemories().length === 0 && titles.length === 8 && JSON.stringify({ titles, boards, watchLogs }) === domain, "empty demo does not mutate domain fixtures");
    memories = populated;
    const deskA = railView("home-t1"), deskB = railView("home-t2");
    assert(!deskA.expanded && !deskB.expanded && state.homeOpen === "", "home cases begin closed");
    deskA.left = 87;
    selectDesk("home-t1");
    assert(deskA.expanded && !deskB.expanded, "home opens only the selected case");
    selectDesk("home-t2");
    assert(!deskA.expanded && deskB.expanded && deskA.left === 87, "home selection preserves other film position");
    selectDesk("");
    assert(!deskA.expanded && !deskB.expanded && JSON.stringify({ titles, memories, boards, watchLogs }) === before, "closing home changes no domain records");
    assert(!/shelf-intro|shelf-profile|featured-memory|shelf-bio/.test(renderBookshelf.toString()), "home has no introduction or featured hero markup");
    assert(!/shelf-bio|shelf-featured|theme-options/.test(renderShelfEditor.toString()), "editor omits removed hero settings");
    state.rails.delete("home-t1"); state.rails.delete("home-t2");
    const overlapping = clone(bookshelf); overlapping.shelves[1].titles.push("t1");
    assert(shelfTitleIds(overlapping).join() === "t1,t3,t2,t6,t4,t5", "all shelf is deduplicated curated union");
    assert(shelfTitleIds(overlapping, "s2").join() === "t6,t4,t5,t1" && !shelfTitleIds(overlapping).includes("t8"), "shelf filter differs from all saved titles");
    assert(shelfRowEnd(0, 6, 6) === 5 && shelfRowEnd(2, 4, 6) === 3 && shelfRowEnd(4, 4, 6) === 5, "panel follows selected complete or partial row");
    assert(shelfRowEnd(2, 2, 6) === 3 && shelfRowEnd(5, 2, 6) === 5 && shelfRowEnd(-1, 2, 0) === -1, "mobile and empty row placement");
  }
  checkModel();
  if (typeof document === "undefined") return;
  const emptyDemo = new URLSearchParams(location.search).get("start") === "empty";
  if (emptyDemo) memories = [];

  const app = document.getElementById("app"), memoryDialog = document.getElementById("memory-dialog"), composerDialog = document.getElementById("composer-dialog"), toastElement = document.getElementById("toast");
  if (!app || !memoryDialog || !composerDialog || !toastElement) throw new Error("Bookshelf shell is incomplete");
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const routeKey = () => `${state.page}/${state.id}`;
  let toastTimer, memoryContext = null, composerContext = null;
  let railCleanup = () => {};
  let masonryCleanup = () => {};
  let shelfGridCleanup = () => {};
  const caseBindings = new Map();
  const art = (kind, index, label) => {
    if (kind === "scene") {
      const visual = visuals[index] || visuals[0], x = (visual.cell % visual.columns) * 100 / (visual.columns - 1), y = Math.floor(visual.cell / visual.columns) * 100 / (visual.rows - 1);
      const [width, height] = visual.ratio.split("/").map(Number);
      return `<div class="art scene-art collection-art" data-visual="${index}" style="--art-ratio:${visual.ratio};--art-ratio-number:${width / height};--x:${x}%;--y:${y}%;background-image:url(../prototypes/film-archive/${visual.sheet});background-size:${visual.columns * 100}% ${visual.rows * 100}%;background-position:${x}% ${y}%" role="img" aria-label="${esc(label || visual.label)}"></div>`;
    }
    return `<div class="art poster-art" style="--x:${(index % 4) * 100 / 3}%;--y:${Math.floor(index / 4) * 100}%" role="img" aria-label="${esc(label)}"></div>`;
  };
  const button = (text, action, extra = "", attributes = "") => {
 const icons={ 'desk-close':'chevron-up','shelf-edit':'edit','shelf-apply':'check','compose':'plus','shelf-up':'chevron-up','shelf-down':'chevron-down','shelf-remove':'close' };
 const icon=icons[action];const glyph=icon?'<img class="action-icon" src="../ui-kit-v8.2/png/'+icon+'-ink-48.png" alt="">':'';
 const label=['shelf-up','shelf-down','shelf-remove'].includes(action)?'':text;
 return '<button type="button" class="button '+extra+'" data-action="'+action+'" '+attributes+'>'+glyph+'<span>'+label+'</span></button>';
 };
  const dateLabel = (value) => value.replace(/-/g, ". ");
  const titleMeta = (title) => `${title.saved ? esc(title.status || "저장됨") : "미저장"} · 기억 ${titleMemories(title.id).length}개`;
  const memoryTile = (memory) => {
    const title = findTitle(memory.titleId);
    return `<article class="board-memory collection-item" data-memory-id="${memory.id}"><button type="button" class="memory-tile" id="memory-${memory.id}" data-action="memory" data-id="${memory.id}" aria-label="${esc(title.name)}의 기억: ${esc(visuals[memory.scene].label)}"><div class="memory-image">${art("scene", memory.scene, visuals[memory.scene].label)}</div><div class="memory-info"><span class="memory-title">${esc(title.name)}</span><span class="memory-open" aria-hidden="true">↗</span></div></button></article>`;
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
    if (!state.rails.has(id)) state.rails.set(id, { left: 0, index: 0, loaded: /^(row|home)-/.test(id) ? 3 : Infinity, expanded: !id.startsWith("home-"), transitioning: false });
    return state.rails.get(id);
  }
  function selectDesk(id) {
    state.homeOpen = id;
    if (id) railView(id);
    state.rails.forEach((view, key) => { if (key.startsWith("home-")) view.expanded = key === id; });
  }
  function changeDeskSelection(id) {
    if (draft) return;
    const previous = state.homeOpen, panel = app.querySelector(".shelf-film-panel");
    const restoreCover = !id || Boolean(panel?.contains(document.activeElement));
    captureRails(); selectDesk(id); syncShelfPanel();
    if (restoreCover) document.getElementById("desk-cover-" + (id || previous))?.focus({ preventScroll: true });
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

  let channelView = new URLSearchParams(location.search).get('view') === 'table' ? 'table' : 'grid';
  let channelExpanded = false, channelQuery = '', channelSearchOpen = false;

  app.addEventListener('click',event=>{
   const control=event.target.closest('[data-channel-action]');if(!control)return;
   const action=control.dataset.channelAction;
   if(action==='info'){channelExpanded=!channelExpanded;render({focusId:'channel-info-toggle'});}
   if(action==='view'){channelView=control.dataset.view;const u=new URL(location.href);u.searchParams.set('view',channelView);history.pushState({},'',u);render({focusId:'channel-view-'+channelView});}
   if(action==='search'){channelSearchOpen=!channelSearchOpen;if(!channelSearchOpen)channelQuery='';render({focusId:channelSearchOpen?'channel-query':'channel-search-toggle'});}
   if(action==='clear'){channelQuery='';render({focusId:'channel-query'});}
  });
  app.addEventListener('input',event=>{if(event.target.id==='channel-query'){const position=event.target.selectionStart;channelQuery=event.target.value;render({focusId:'channel-query'});document.getElementById('channel-query')?.setSelectionRange(position,position);}});
  window.addEventListener('popstate',()=>{channelView=new URLSearchParams(location.search).get('view')==='table'?'table':'grid';render();});
  document.getElementById('channel-global-search').onclick=()=>{if(state.page==='titles'||state.page==='memories'){tabExpanded[state.page]=true;render({focusId:state.page==='titles'?'title-search':'memory-search'});return;}channelSearchOpen=true;state.page='home';state.id='';if(location.hash!=='#home')location.hash='home';render({focusId:'channel-query'});};
  document.addEventListener('keydown',event=>{if(event.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();document.getElementById('channel-global-search').click();}});

  function renderShelfCaption(title) {
    const items = titleMemories(title.id), latest = items[0], railId = "home-" + title.id;
    return button(esc(title.name), "title", "desk-title", 'data-id="' + title.id + '" id="desk-title-' + railId + '" aria-label="' + esc(title.name) + ' 작품 상세"')
      + '<p class="desk-meta">기억 ' + items.length + '개' + (latest ? ' · <time datetime="' + latest.date + '">' + dateLabel(latest.date) + '</time>' : '') + '</p>'
      + (latest?.note ? '<p class="desk-note">' + esc(latest.note) + '</p>' : '');
  }
  function renderShelfTile(title) {
    const railId = "home-" + title.id, expanded = state.homeOpen === railId;
    return '<article class="shelf-tile' + (expanded ? ' is-selected' : '') + '" data-title="' + title.id + '">'
      + '<button type="button" class="shelf-cover" id="desk-cover-' + railId + '" data-action="desk-toggle" data-rail="' + railId + '" ' + (expanded ? 'aria-controls="desk-panel-' + railId + '" ' : '') + 'aria-expanded="' + expanded + '" aria-label="' + esc(title.name) + (expanded ? ' 필름 접기' : ' 필름 보기') + '" ' + (draft ? 'disabled' : '') + '>'
      + art("poster", title.poster, title.name + " 가상 작품 표지")
      + '<span class="desk-pull-label" aria-hidden="true">' + (expanded ? '접기' : '필름 보기') + '</span></button>'
      + '<div class="shelf-caption">' + renderShelfCaption(title) + '</div></article>';
  }
  function renderShelfPanel(title) {
    const railId = "home-" + title.id, items = titleMemories(title.id);
    return '<article class="shelf-film-panel desk-case is-open' + (items.length ? '' : ' is-empty') + '" id="desk-panel-' + railId + '" data-desk-rail="' + railId + '" data-title="' + title.id + '" aria-label="' + esc(title.name) + ' 기억 필름">'
      + '<header class="film-panel-heading"><div><span class="film-eyebrow">MEMORY FILM</span><h2>' + esc(title.name) + '</h2></div><span class="film-total">기억 ' + items.length + '개</span>' + button('접기', 'desk-close', 'panel-close', 'data-rail="' + railId + '" aria-label="필름 접기"') + '</header><div class="desk-case-body"><button type="button" class="shelf-panel-cover" id="desk-panel-cover-' + railId + '" data-action="title" data-id="' + title.id + '" aria-label="' + esc(title.name) + ' 작품 상세">'
      + art("poster", title.poster, title.name + " 가상 작품 표지") + '<span class="shelf-panel-title">' + esc(title.name) + '</span><span class="desk-meta">기억 ' + items.length + '개</span></button>'
      + '<div class="desk-drawer" id="desk-drawer-' + railId + '" ' + (draft ? 'inert' : '') + '><div class="film-track-shell"><div class="film-rail" data-rail-id="' + railId + '" data-total="' + items.length + '" tabindex="' + (draft ? '-1' : '0') + '" ' + (draft ? 'inert' : '') + ' aria-label="' + esc(title.name) + ' 기억 필름, 좌우 화살표로 이동">'
      + (items.length ? railFrames(title, items, railId) : '<p class="desk-no-memory">아직 남긴 기억이 없어요.</p>')
      + '</div></div><footer class="desk-drawer-footer">'
      + (items.length ? '<span data-rail-position="' + railId + '">01 / ' + String(items.length).padStart(2, "0") + '</span>' + railControls(title, railId) : '')
      + button(items.length ? "기억 추가" : "첫 기억 남기기", "compose", "", 'data-title="' + title.id + '" data-home-rail="' + railId + '" id="desk-compose-' + railId + '" aria-label="' + esc(title.name) + '에 기억 남기기"')
      + button("접기", "desk-close", "quiet", 'data-rail="' + railId + '" aria-label="' + esc(title.name) + ' 필름 접기"')
      + '</footer></div></div></article>';
  }
  function renderBookshelf(model) {
    if (!model.shelves.some(s => s.id === state.activeShelf)) state.activeShelf = 'all';
    const allIds=shelfTitleIds(model,state.activeShelf);
    const ids=allIds.filter(id=>{const t=findTitle(id);return (t.name+' '+titleMemories(id).map(m=>m.note).join(' ')).toLowerCase().includes(channelQuery.toLowerCase());});
    const selectedId=state.homeOpen.slice(5);
    if(!draft && state.homeOpen && !ids.includes(selectedId))selectDesk('');
    const memoriesOnShelf=allIds.flatMap(id=>titleMemories(id));
    const dates=memoriesOnShelf.map(m=>m.date).sort();
    const tabs=[{id:'all',name:'전체'},...model.shelves];
    const menu='<details class="shelf-menu"><summary id="shelf-menu-trigger" aria-label="책장 메뉴"></summary><div class="shelf-menu-content">'+button('책장 꾸미기','shelf-edit','quiet','id="shelf-edit"')+'<a href="#titles">전체 작품 보기</a><a href="#memories">기억 보관함</a><p>진열을 바꿔도 원래 기억은 유지됩니다.</p></div></details>';
    const table='<div class="channel-table-wrap"><table class="channel-table"><caption>진열한 작품 '+ids.length+'개</caption><thead><tr><th>작품</th><th>기억</th><th>최근 기록</th><th>보기</th></tr></thead><tbody>'+ids.map(id=>{const t=findTitle(id),items=titleMemories(id);return '<tr><td>'+button(esc(t.name),'title','quiet','data-id="'+id+'"')+'</td><td>'+items.length+'</td><td>'+(items[0]?dateLabel(items[0].date):'—')+'</td><td>'+button('기억 보기','title','quiet','data-id="'+id+'"')+'</td></tr>';}).join('')+'</tbody></table></div>';
    return '<div class="grid-home channel-home '+(channelExpanded?'info-expanded':'')+'"><header class="desk-toolbar"><h1><a href="#home">MOEMOA</a><span class="crumb-separator">/</span><span class="crumb-owner">내 책장</span>'+(state.activeShelf==='all'?'':'<span class="crumb-separator">/</span><span>'+esc(model.shelves.find(s=>s.id===state.activeShelf)?.name||'')+'</span>')+'</h1><div class="channel-tools"><button type="button" id="channel-search-toggle" data-channel-action="search" aria-label="이 책장 검색" aria-expanded="'+channelSearchOpen+'"><img src="../ui-kit-v8.2/png/search-ink-48.png" alt=""></button>'+(draft?'<span>꾸미는 중</span>':menu)+'</div></header>'
    + '<section id="channel-info" class="channel-info" aria-label="책장 정보"><div class="channel-info-cell info-main"><h2>정보</h2><p>다시 꺼내 보고 싶은 작품과 장면들.</p><dl><div><dt>첫 기억</dt><dd>'+(dates[0]?dateLabel(dates[0]):'아직 없음')+'</dd></div><div><dt>최근 기록</dt><dd>'+(dates.at(-1)?dateLabel(dates.at(-1)):'아직 없음')+'</dd></div><div><dt>작품</dt><dd>'+allIds.length+'</dd></div><div><dt>기억</dt><dd>'+memoriesOnShelf.length+'</dd></div></dl><p class="channel-disclosure">가상 기록 · 실제 저장/공개되지 않습니다.</p></div>'
    + '<div class="channel-info-cell"><h2>선반</h2><div class="channel-shelves" role="group" aria-label="선반 선택">'+tabs.map(s=>button(esc(s.name)+' <small>'+shelfTitleIds(model,s.id).length+'</small>','shelf-tab','','data-shelf="'+s.id+'" id="shelf-tab-'+s.id+'" aria-pressed="'+(state.activeShelf===s.id)+'"')).join('')+'</div><p class="channel-disclosure">전체는 선반에 진열한 작품의 합집합입니다. 작품 목록 전체와는 다릅니다.</p></div>'
    + '<div class="channel-info-cell"><h2>보기</h2><div class="channel-view"><button type="button" id="channel-view-grid" data-channel-action="view" data-view="grid" aria-pressed="'+(channelView==='grid')+'">그리드</button><button type="button" id="channel-view-table" data-channel-action="view" data-view="table" aria-pressed="'+(channelView==='table')+'">표</button></div><p class="channel-disclosure">표지 선택 → 필름 펼침<br>작품 이름 선택 → 작품 상세</p></div></section>'
    + '<button type="button" id="channel-info-toggle" data-channel-action="info" aria-expanded="'+channelExpanded+'" aria-controls="channel-info" aria-label="'+(channelExpanded?'책장 정보 접기':'책장 정보 펼치기')+'"><span aria-hidden="true">'+(channelExpanded?'⌃':'⌄')+'</span></button>'
    + (channelSearchOpen?'<div class="channel-search-row"><label for="channel-query">이 책장 검색</label><input type="search" id="channel-query" value="'+esc(channelQuery)+'" placeholder="작품 이름 또는 감상"><span role="status">'+ids.length+'개</span><button type="button" data-channel-action="clear">지우기</button></div>':'')
    + (!ids.length?'<div class="desk-empty-shelf"><p>'+(channelQuery?'검색 결과가 없어요.':'진열한 작품이 없어요.')+'</p>'+(channelQuery?'<button type="button" data-channel-action="clear">검색 지우기</button>':button('작품 고르기','shelf-edit','quiet'))+'</div>':channelView==='table'?table:'<div class="shelf-cover-grid" id="shelf-cover-grid" data-shelf-grid aria-label="진열한 작품">'+ids.map(id=>renderShelfTile(findTitle(id))).join('')+(state.homeOpen&&ids.includes(selectedId)?renderShelfPanel(findTitle(selectedId)):'')+'</div>')+'</div>';
  }

  function positionShelfPanel(grid) {
    const panel = grid?.querySelector(".shelf-film-panel");
    if (!panel) return;
    const tiles = [...grid.querySelectorAll(":scope > .shelf-tile")], index = tiles.findIndex((tile) => tile.dataset.title === panel.dataset.title);
    if (index < 0) return;
    const style = getComputedStyle(grid), tracks = style.gridTemplateColumns.trim().split(/\s+/);
    const columns = style.gridTemplateColumns !== "none" ? tracks.length : Number.parseInt(style.getPropertyValue("--shelf-columns"), 10) || 1;
    const anchor = tiles[shelfRowEnd(index, columns, tiles.length)];
    grid.dataset.columns = String(columns);
    if (anchor.nextElementSibling === panel) return;
    const focus = panel.contains(document.activeElement) ? document.activeElement : null;
    const rail = panel.querySelector("[data-rail-id]"), left = rail?.scrollLeft || 0;
    anchor.after(panel);
    if (rail) rail.scrollLeft = left;
    focus?.focus({ preventScroll: true });
  }
  function bindShelfGrid() {
    const grid = app.querySelector("[data-shelf-grid]");
    if (!grid) return;
    let frame = 0;
    const layout = () => { if (grid.isConnected) positionShelfPanel(grid); };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(layout); };
    layout();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(grid); window.addEventListener("resize", schedule);
    shelfGridCleanup = () => { observer?.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", schedule); };
  }
  function syncShelfPanel() {
    const grid = app.querySelector("[data-shelf-grid]");
    if (!grid) return;
    railCleanup();
    grid.querySelector(".shelf-film-panel")?.remove();
    grid.querySelectorAll(".shelf-tile").forEach((tile) => {
      const expanded = state.homeOpen === "home-" + tile.dataset.title, cover = tile.querySelector(".shelf-cover");
      tile.classList.toggle("is-selected", expanded); cover.setAttribute("aria-expanded", String(expanded));
      if (expanded) cover.setAttribute("aria-controls", "desk-panel-home-" + tile.dataset.title);
      else cover.removeAttribute("aria-controls");
      cover.setAttribute("aria-label", findTitle(tile.dataset.title).name + (expanded ? " 필름 접기" : " 필름 보기"));
      cover.querySelector(".desk-pull-label").textContent = expanded ? "접기" : "필름 보기";
    });
    const title = findTitle(state.homeOpen.slice(5));
    if (title && grid.querySelector('[data-title="' + title.id + '"]')) {
      grid.insertAdjacentHTML("beforeend", renderShelfPanel(title)); positionShelfPanel(grid);
    }
    bindRails();
  }
  function renderShelfEditor() {
    return `<aside class="shelf-editor" aria-labelledby="shelf-editor-heading"><div class="editor-heading"><h2 id="shelf-editor-heading">책장 꾸미기</h2><p class="muted">골라 둔 작품만 이곳에 진열해요.</p></div><section class="editor-section"><label class="editor-label" for="shelf-name">책장 이름</label><input class="control" id="shelf-name" maxlength="32" value="${esc(draft.name)}"></section>${draft.shelves.map((shelf, shelfIndex) => `<section class="editor-section"><label class="editor-label" for="shelf-label-${shelf.id}">${shelfIndex + 1}번째 선반</label><input class="control" id="shelf-label-${shelf.id}" data-shelf-label="${shelf.id}" maxlength="24" value="${esc(shelf.name)}"><ol class="curation-list">${shelf.titles.map((id, index) => `<li class="curation-item"><span>${esc(findTitle(id).name)}</span><div class="curation-actions">${button("↑", "shelf-up", "quiet", `data-shelf="${shelf.id}" data-id="${id}" id="up-${shelf.id}-${id}" aria-label="${esc(findTitle(id).name)} 앞으로" ${index === 0 ? "disabled" : ""}`)}${button("↓", "shelf-down", "quiet", `data-shelf="${shelf.id}" data-id="${id}" id="down-${shelf.id}-${id}" aria-label="${esc(findTitle(id).name)} 뒤로" ${index === shelf.titles.length - 1 ? "disabled" : ""}`)}${button("×", "shelf-remove", "quiet", `data-shelf="${shelf.id}" data-id="${id}" aria-label="${esc(findTitle(id).name)} 진열에서 빼기"`)}</div></li>`).join("")}</ol><details class="title-picker"><summary>작품 고르기 <span>${shelf.titles.length}/${titles.length}</span></summary>${titles.map((title) => `<label class="title-pick-item"><input type="checkbox" id="pick-${shelf.id}-${title.id}" data-pick-shelf="${shelf.id}" value="${title.id}" ${shelf.titles.includes(title.id) ? "checked" : ""}><span>${esc(title.name)}</span></label>`).join("")}</details></section>`).join("")}<p class="editor-footnote muted">진열에서 빼도 작품과 기억은 그대로 남아요.</p><div class="editor-actions">${button("취소", "shelf-cancel", "quiet", 'id="shelf-cancel"')}${button("적용", "shelf-apply", "primary", 'id="shelf-apply"')}</div></aside>`;
  }
  function renderHome() {
    return draft ? `<div class="shelf-edit-banner" role="status">꾸미기 미리보기 · 적용 전에는 바뀌지 않아요.</div><div class="shelf-edit-layout">${renderShelfEditor()}<div id="shelf-live-preview">${renderBookshelf(draft)}</div></div>` : renderBookshelf(bookshelf);
  }
  function updateShelfPreview() { const preview = document.getElementById("shelf-live-preview"); if (preview && draft) { captureRails(); railCleanup(); masonryCleanup(); shelfGridCleanup(); preview.innerHTML = renderBookshelf(draft); bindShelfGrid(); bindRails(); bindMasonry(); } }
  function cancelShelfEdit() { draft = null; render({ focusId: "shelf-menu-trigger" }); showToast("꾸미기를 취소했어요."); }
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
    return shown.map((memory, index) => `<button type="button" class="film-frame" style="--frame-art-ratio:${visuals[memory.scene].ratio.split('/').reduce((width, height) => Number(width) / Number(height))}" id="${railId}-${memory.id}" data-action="memory" data-id="${memory.id}" data-frame="${index}" aria-label="${esc(title.name)}, ${index + 1}번째 기억, ${esc(memory.note || dateLabel(memory.date))}"><div class="frame-image">${art("scene", memory.scene, `${title.name}의 장면`)}</div><span class="frame-caption"><span class="frame-number">${String(index + 1).padStart(2, "0")}</span><span class="frame-note">${esc(memory.note || title.name)}</span><small class="frame-date">${dateLabel(memory.date)}</small></span></button>`).join("") + (shown.length < items.length ? `<button type="button" class="film-load-more" data-action="rail-more" data-rail="${railId}" data-title="${title.id}" id="more-${railId}"><span>+${items.length - shown.length}</span><strong>다음 장면 펼치기</strong></button>` : "");
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

  const serviceFacetOptions={"AFFINITY_OPTIONS":["최애","기억남음","불호지만강렬"],"REASON_TAG_OPTIONS":["성장","관계성","대사","연출","디자인","성우","기타"]};
  // Explicit synthetic watch-log associations, not image recognition or real user records.
  const facetLabels={성장:'서사',디자인:'비주얼',성우:'성우연기',기억남음:'인상 깊었음',불호지만강렬:'불호인데 강렬함'};
  const fixtureCharacterNames=['하루 (가상)','유나 (가상)','소라 (가상)','민 (가상)','루카 (가상)','렌 (가상)','아오 (가상)'];
  const fixtureLogFacets=titles.slice(0,7).map((t,i)=>({titleId:t.id,characterId:'fixture-character-'+i,name:fixtureCharacterNames[i],reasonTags:[serviceFacetOptions.REASON_TAG_OPTIONS[i],serviceFacetOptions.REASON_TAG_OPTIONS[(i+1)%7]],affinity:serviceFacetOptions.AFFINITY_OPTIONS[i%3]}));
  let activeFacets={tag:'',character:'',affinity:''};
  function matchesArchiveFacets(memory){
    if(!Object.values(activeFacets).some(Boolean))return true;
    return fixtureLogFacets.some(log=>log.titleId===memory.titleId&&(!activeFacets.tag||log.reasonTags.includes(activeFacets.tag))&&(!activeFacets.character||log.characterId===activeFacets.character)&&(!activeFacets.affinity||log.affinity===activeFacets.affinity));
  }
  function renderArchiveFacets(){
    const links=(key,options)=>`<div class="facet-links" role="group" aria-label="${key==='tag'?'포인트 태그':key==='character'?'캐릭터':'캐릭터 감정'}">${options.map(([value,text],i)=>`<button type="button" id="facet-${key}-${i}" data-facet-key="${key}" data-facet-value="${esc(value)}" aria-pressed="${activeFacets[key]===value}">${esc(text)}</button>`).join('')}</div>`;
    return `<div class="archive-facets"><div class="channel-info-cell facet-cell"><h2>포인트 태그</h2>${links('tag',serviceFacetOptions.REASON_TAG_OPTIONS.map(t=>[t,facetLabels[t]||t]))}<div class="facet-status"><span role="status">${archiveItems().length}개의 기억</span><button type="button" data-clear-facets>전체 보기 ↗</button></div><p class="facet-context">작품의 감상 기록으로 모아보기</p></div><div class="channel-info-cell facet-cell"><h2>캐릭터</h2>${links('character',fixtureLogFacets.map(l=>[l.characterId,l.name.replace(' (가상)','')]))}<h3>캐릭터 감정</h3>${links('affinity',serviceFacetOptions.AFFINITY_OPTIONS.map(t=>[t,facetLabels[t]||t]))}<p class="facet-context">캐릭터·연결은 가상 자료</p></div></div>`;
  }
  app.addEventListener('click',event=>{const target=event.target.closest('[data-facet-key]');if(target){const key=target.dataset.facetKey,value=target.dataset.facetValue;activeFacets[key]=activeFacets[key]===value?'':value;render({focusId:target.id});}else if(event.target.closest('[data-clear-facets]')){activeFacets={tag:'',character:'',affinity:''};render({focusId:'facet-tag-0'});}});

  const tabExpanded = {titles:false,memories:false};
  let archiveView='grid', archiveSort='recent';
  function tabShell(page,label,description,stats,tools,views,results){
    const expanded=tabExpanded[page];
    return `<section class="channel-home channel-tab ${page==='memories'?'has-facets':''} ${expanded?'info-expanded':''}"><header class="desk-toolbar"><h1><a href="#home">MOEMOA</a><span class="crumb-separator">/</span><span>${label}</span></h1></header><section class="channel-info" id="tab-info" aria-label="${label} 정보"><div class="channel-info-cell"><h2>정보</h2><p>${description}</p><dl>${stats.map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl><p class="channel-disclosure">가상 기록 · 실제 저장/공개되지 않습니다.</p></div><div class="channel-info-cell"><h2>찾아보기</h2>${tools}</div><div class="channel-info-cell"><h2>보기</h2>${views}</div>${page==='memories'?renderArchiveFacets():''}</section><button type="button" class="tab-info-toggle" data-tab-action="info" aria-expanded="${expanded}" aria-controls="tab-info" aria-label="${label} 정보 ${expanded?'접기':'펼치기'}">${expanded?'⌃':'⌄'}</button>${results}</section>`;
  }
  function renderTitleResults(items){
    if(!items.length)return empty('찾는 작품이 없어요','검색어나 필터를 바꿔 보세요.',button('검색 초기화','reset','quiet'));
    if(controls.view==='album')return `<section class="film-rows sleeve-rows" aria-label="내 작품 목록">${items.map(titleFilmRow).join('')}</section>`;
    return `<section class="channel-items" aria-label="내 작품 목록">${items.map(t=>`<button type="button" class="channel-item" data-action="title" data-id="${t.id}" id="poster-${t.id}"><span class="channel-stage channel-poster">${art('poster',t.poster,t.name+' 가상 작품 표지')}</span><span class="channel-item-name">${esc(t.name)}</span><span class="channel-item-meta">${titleMeta(t)}</span></button>`).join('')}</section>`;
  }
  function renderTitles(){
    const items=filteredTitles(),all=collection(), filters=[['all','전체'],['saved','저장됨'],['memory','기억 있음'],['watching','보는 중'],['completed','완료']];
    const tools=`<label class="tab-search"><span class="sr-only">내 작품 검색</span><input id="title-search" type="search" placeholder="작품이나 장르 찾기" value="${esc(controls.query)}"></label><div class="tab-filters" aria-label="작품 필터">${filters.map(([key,label])=>button(label,'filter','','data-filter="'+key+'" id="filter-'+key+'" aria-pressed="'+(controls.filter===key)+'"')).join('')}</div><span class="filter-count" role="status">${items.length}개 작품</span>`;
    const views=`<div class="channel-view">${button('표지 보기','view','','data-view="poster" aria-pressed="'+(controls.view==='poster')+'" id="view-poster"')}${button('기억 함께 보기','view','','data-view="album" aria-pressed="'+(controls.view==='album')+'" id="view-album"')}</div><label class="tab-sort">정렬 <select id="title-sort"><option value="recent" ${controls.sort==='recent'?'selected':''}>최근 기억순</option><option value="title" ${controls.sort==='title'?'selected':''}>제목순</option></select></label>`;
    return tabShell('titles','내 작품','저장한 작품과 기억을 남긴 작품을 한곳에.',[['전체 작품',all.length],['저장한 작품',all.filter(t=>t.saved).length],['기억이 있는 작품',all.filter(t=>titleMemories(t.id).length).length]],tools,views,`<div id="title-results">${renderTitleResults(items)}</div>`);
  }
  function archiveItems(){const items=searchedMemories().filter(matchesArchiveFacets);return archiveSort==='oldest'?[...items].reverse():items;}
  function renderMemoryResults(){
    const items=archiveItems();
    if(!items.length)return empty(memories.length?'찾는 기억이 없어요':'아직 남긴 기억이 없어요',memories.length?'작품명이나 감상으로 다시 찾아보세요.':'이미지와 작품을 골라 첫 기억을 남겨 보세요.',button(memories.length?'검색 초기화':'첫 기억 남기기',memories.length?'memory-reset':'compose','quiet'));
    if(archiveView==='table')return `<div class="channel-table-wrap"><table class="channel-table"><caption>기억 ${items.length}개</caption><thead><tr><th>작품 · 감상</th><th>기록일</th></tr></thead><tbody>${items.map(m=>`<tr><td>${button(esc(findTitle(m.titleId).name)+'<small class="table-note">'+esc(m.note||'감상 없음')+'</small>','memory','quiet','data-id="'+m.id+'"')}</td><td>${dateLabel(m.date)}</td></tr>`).join('')}</tbody></table></div>`;
    return `<section class="channel-items channel-memory-grid" data-masonry aria-label="내 기억 목록">${items.map(m=>`<button type="button" class="channel-item" data-action="memory" data-id="${m.id}" id="memory-${m.id}"><span class="channel-stage">${art('scene',m.scene,visuals[m.scene].label)}</span><span class="channel-item-name">${esc(findTitle(m.titleId).name)}</span><span class="channel-item-note">${esc(m.note||'')}</span><span class="channel-item-meta">${dateLabel(m.date)}</span></button>`).join('')}</section>`;
  }
  function renderMemories(){
    const dates=memories.map(m=>m.date).sort(),added=findMemory(memoryControls.lastAdded);
    const tools=`<label class="tab-search"><span class="sr-only">기억 검색</span><input id="memory-search" type="search" placeholder="작품이나 감상 찾기" value="${esc(memoryControls.query)}"></label><p class="collection-result-count" role="status">${archiveItems().length}개의 기억</p>${button('검색 초기화','memory-reset','quiet')}`;
    const views=`<div class="channel-view"><button type="button" data-tab-action="memory-view" data-view="grid" aria-pressed="${archiveView==='grid'}">그리드</button><button type="button" data-tab-action="memory-view" data-view="table" aria-pressed="${archiveView==='table'}">표</button></div><label class="tab-sort">정렬 <select id="archive-sort"><option value="recent" ${archiveSort==='recent'?'selected':''}>최근 기록순</option><option value="oldest" ${archiveSort==='oldest'?'selected':''}>오래된 기록순</option></select></label>`;
    return tabShell('memories','기억 아카이브','작품마다 남겨 둔 장면과 짧은 감상.',[['기억',memories.length],['작품',new Set(memories.map(m=>m.titleId)).size],['최근 기록',dates.length?dateLabel(dates.at(-1)):'아직 없음']],tools,views,`${added?`<div class="collection-feedback" role="status">기억을 남겼어요. ${button(esc(findTitle(added.titleId).name)+' 필름 보기 →','title','quiet','data-id="'+added.titleId+'" id="collection-title-link"')}</div>`:''}<div id="memory-results">${renderMemoryResults()}</div>`);
  }
  app.addEventListener('click',event=>{const control=event.target.closest('[data-tab-action]');if(!control)return;if(control.dataset.tabAction==='info'){tabExpanded[state.page]=!tabExpanded[state.page];render();app.querySelector('.tab-info-toggle')?.focus({preventScroll:true});}else if(control.dataset.tabAction==='memory-view'){archiveView=control.dataset.view;render();app.querySelector('[data-tab-action="memory-view"][aria-pressed="true"]')?.focus({preventScroll:true});}});
  app.addEventListener('change',event=>{if(event.target.id==='archive-sort'){archiveSort=event.target.value;render({focusId:'archive-sort'});}});


  function renderTitle() {
    const title = findTitle(state.id), items = titleMemories(title.id), view = titleView(), logs = watchLogs[title.id] || [], railId = `title-${title.id}`;
    const identity = `${button("← 돌아가기", "title-back", "quiet back-button")}<section class="title-identity"><div class="title-cover">${art("poster", title.poster, `${title.name} 가상 작품 표지`)}</div><div class="title-info"><p class="eyebrow">${title.year} · ${esc(title.genre)}</p><h1>${esc(title.name)}</h1><p class="muted">${titleMeta(title)}</p><div class="title-actions">${button("기억 남기기", "compose", "primary", `data-title="${title.id}"`)}${button(title.saved ? "작품 저장됨 ✓" : "작품 저장", "save-title", "", `aria-pressed="${title.saved}" id="title-save"`)}</div></div></section>`;
    const tabs = `<div class="section-head"><div class="segmented" role="group" aria-label="작품 안에서 보기">${button(`기억 ${items.length}`, "title-tab", "", `data-tab="memories" aria-pressed="${view.tab === "memories"}" id="tab-memories"`)}${button(`시청 기록 ${logs.length}`, "title-tab", "", `data-tab="watch" aria-pressed="${view.tab === "watch"}" id="tab-watch"`)}</div>${view.tab === "memories" && items.length ? button(view.layout === "film" ? "전체 보기" : "필름으로 보기", "film-layout", "quiet", 'id="film-layout"') : ""}</div>`;
    if (view.tab === "watch") return identity + tabs + (logs.length ? `<section class="watch-list" aria-label="시청 기록">${logs.map((log) => `<article class="watch-entry"><time>${log.date}</time><div class="watch-copy"><h3>${log.event}</h3><p>${esc(log.note)}</p></div></article>`).join("")}</section>` : empty("아직 시청 기록이 없어요", "기억과 시청 기록은 따로 모아 봅니다."));
    if (!items.length) return identity + tabs + empty("아직 남긴 기억이 없어요", "이 작품에서 기억하고 싶은 장면을 남겨 보세요.", button("첫 기억 남기기", "compose", "primary", `data-title="${title.id}"`));
    if (view.layout === "grid") return identity + tabs + `<section class="memory-grid collection-grid" data-masonry aria-label="이 작품의 기억">${items.map(memoryTile).join("")}</section>`;
    return identity + tabs + `<section class="detail-film" aria-label="이 작품의 기억 필름"><header class="film-topline"><div><p class="eyebrow">한 작품에 남겨 둔 순간</p><h2>${esc(title.name)}의 필름</h2></div><span class="film-count">${items.length} 장면</span></header><div class="film-track-shell"><div class="film-rail" data-rail-id="${railId}" data-total="${items.length}" tabindex="0" aria-label="${esc(title.name)} 기억 필름, 좌우 화살표로 이동">${railFrames(title, items, railId)}</div></div><footer class="film-footer"><p><span data-rail-position="${railId}">01 / ${String(items.length).padStart(2, "0")}</span><span class="film-hint muted"> · 장면을 누르면 크게 볼 수 있어요</span></p>${railControls(title, railId)}</footer></section>`;
  }

  function bindMasonry() {
    const cleanups = [];
    app.querySelectorAll("[data-masonry]").forEach((grid) => {
      const items = [...grid.children];
      let frame = 0, ready = false, signature = "", disposed = false;
      const layout = () => {
        if (disposed || !grid.isConnected) return;
        const style = getComputedStyle(grid), width = grid.clientWidth;
        const columns = Math.max(1, Math.min(12, Number.parseInt(style.getPropertyValue("--collection-columns"), 10) || 4));
        const gap = Math.max(0, Number.parseFloat(style.getPropertyValue("--collection-gap")) || 0);
        const anchor = ready && grid.getBoundingClientRect().top < 0 && !document.querySelector("dialog[open]") ? items.find((item) => item.getBoundingClientRect().bottom > 0) : null;
        const before = anchor?.getBoundingClientRect().top;
        const itemWidth = Math.max(0, (width - gap * (columns - 1)) / columns);
        items.forEach((item) => { item.style.width = `${itemWidth}px`; });
        const heights = items.map((item) => item.getBoundingClientRect().height);
        const nextSignature = `${width}/${columns}/${gap}/${heights.join(",")}`;
        if (nextSignature === signature) return;
        signature = nextSignature;
        const result = masonryPositions(heights, columns, gap, width);
        grid.style.position = "relative";
        items.forEach((item, index) => {
          item.style.position = "absolute"; item.style.left = `${result.positions[index].left}px`; item.style.top = `${result.positions[index].top}px`;
        });
        grid.style.height = `${result.height}px`; grid.dataset.columns = String(columns); grid.dataset.masonryReady = "true";
        if (anchor && Number.isFinite(before)) window.scrollBy({ top: anchor.getBoundingClientRect().top - before, behavior: "instant" });
        ready = true;
      };
      const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(layout); };
      layout();
      const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
      observer?.observe(grid); items.forEach((item) => observer?.observe(item));
      window.addEventListener("resize", schedule);
      document.fonts?.ready.then(() => { if (!disposed) schedule(); });
      cleanups.push(() => { disposed = true; observer?.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", schedule); });
    });
    masonryCleanup = () => cleanups.forEach((cleanup) => cleanup());
  }
  function render({ restorePage = false, focusId = "" } = {}) {
    railCleanup(); masonryCleanup(); shelfGridCleanup();
    const renderers = { home: renderHome, titles: renderTitles, title: renderTitle, memories: renderMemories };
    app.innerHTML = renderers[state.page]();
    document.querySelectorAll("nav [data-page]").forEach((element) => { if (element.dataset.page === (state.page === "title" ? "titles" : state.page)) element.setAttribute("aria-current", "page"); else element.removeAttribute("aria-current"); });
    bindShelfGrid(); bindRails(); bindMasonry();
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
      const caseElement = rail.closest(".film-case, .desk-case"), drawer = rail.closest(".case-drawer, .desk-drawer");
      const isDesk = Boolean(caseElement?.classList.contains("desk-case")), transitionElement = isDesk ? caseElement : drawer;
      const pull = isDesk ? document.getElementById("desk-cover-" + id) : caseElement?.querySelector(".case-pull"), controlsElement = app.querySelector(`[data-controls-for="${id}"]`);
      let dragging = null, cancelClick = false, restored = false, releaseTimer, settleTimer, settleFrame;
      let pullGesture = null, suppressPullClick = false;
      view.transitioning = false;
      const update = () => {
        if (caseElement && drawer) caseElement.style.setProperty("--drawer-live-width", `${drawer.getBoundingClientRect().width}px`);
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
        if (isDesk) drawer.inert = !view.expanded || Boolean(draft);
        rail.inert = !view.expanded || (isDesk && Boolean(draft));
        rail.setAttribute("aria-hidden", String(!view.expanded));
        rail.tabIndex = view.expanded && !(isDesk && draft) ? 0 : -1;
        pull.setAttribute("aria-expanded", String(view.expanded));
        pull.setAttribute("aria-label", `${findTitle(caseElement.dataset.case || caseElement.dataset.title).name} ${view.expanded ? "필름 접기" : "필름 꺼내기"}`);
        if (isDesk) pull.querySelector(".desk-pull-label").textContent = view.expanded ? "접기" : "필름 보기";
        else { pull.querySelector(".case-pull-glyph").textContent = view.expanded ? "←" : "→"; pull.querySelector(".case-pull-label").textContent = view.expanded ? "접기" : "꺼내기"; }
        const status = app.querySelector(`[data-case-status="${caseElement.dataset.case}"]`);
        if (status) status.textContent = view.expanded ? "좌우로 넘겨 보세요" : "접어 둔 필름";
        update();
      };
      const settleCase = () => {
        clearTimeout(settleTimer); cancelAnimationFrame(settleFrame);
        if (!rail.isConnected || pullGesture?.moved) return;
        if (view.expanded) rail.scrollTo({ left: view.left, behavior: "instant" });
        view.transitioning = false;
        update();
      };
      const commitCase = (expanded, fromPull = false) => {
        if (!caseElement || !drawer) return;
        view.expanded = expanded;
        view.transitioning = true;
        clearTimeout(settleTimer); cancelAnimationFrame(settleFrame);
        if (fromPull) caseElement.classList.remove("is-pulling");
        presentCase();
        if (fromPull) {
          // Establish the manually dragged width, then let CSS settle to its endpoint.
          drawer.getBoundingClientRect();
          drawer.style.removeProperty("width");
        }
        const style = getComputedStyle(transitionElement);
        const milliseconds = (value) => (parseFloat(value) || 0) * (value.trim().endsWith("ms") ? 1 : 1000);
        const duration = Math.max(...style.transitionDuration.split(",").map(milliseconds), 0);
        const delay = Math.max(...style.transitionDelay.split(",").map(milliseconds), 0);
        if (reduceMotion() || duration === 0) settleFrame = requestAnimationFrame(settleCase);
        else settleTimer = setTimeout(settleCase, duration + delay + 80);
      };
      const toggleCase = () => {
        if (pullGesture) finishPull(true);
        if (view.expanded && !view.transitioning) view.left = rail.scrollLeft;
        commitCase(!view.expanded);
      };
      const pullBounds = () => {
        const style = getComputedStyle(caseElement);
        const pixels = (property) => parseFloat(style.getPropertyValue(property)) || 0;
        const cover = caseElement.querySelector(".case-cover").getBoundingClientRect().width;
        const maximum = Math.max(0, caseElement.clientWidth - pixels("padding-left") - pixels("padding-right") - cover + pixels("--overlap"));
        return { minimum: Math.min(pixels("--peek"), maximum), maximum };
      };
      const writePullWidth = (width) => {
        drawer.style.width = `${width}px`;
        caseElement.style.setProperty("--drawer-live-width", `${drawer.getBoundingClientRect().width}px`);
      };
      const releasePullCapture = (pointerId) => { if (pull?.hasPointerCapture(pointerId)) pull.releasePointerCapture(pointerId); };
      function finishPull(cancelled = false) {
        const gesture = pullGesture;
        if (!gesture) return;
        pullGesture = null;
        releasePullCapture(gesture.id);
        if (!gesture.moved) return;
        suppressPullClick = true;
        view.left = gesture.savedLeft;
        const expanded = cancelled ? gesture.initialExpanded : resolvePullTarget(gesture.width, gesture.minimum, gesture.maximum, gesture.distance, gesture.initialExpanded);
        commitCase(expanded, true);
        pull.focus({ preventScroll: true });
      }
      const pullDown = (event) => {
        if (event.isPrimary === false || event.button !== 0 || pullGesture) return;
        suppressPullClick = false;
        const bounds = pullBounds();
        pullGesture = { id: event.pointerId, pointerType: event.pointerType, x: event.clientX, y: event.clientY, width: drawer.getBoundingClientRect().width, startWidth: drawer.getBoundingClientRect().width, minimum: bounds.minimum, maximum: bounds.maximum, initialExpanded: view.expanded, savedLeft: view.left, moved: false, distance: 0 };
      };
      const pullMove = (event) => {
        const gesture = pullGesture;
        if (!gesture || event.pointerId !== gesture.id) return;
        if (gesture.pointerType === "mouse" && event.buttons === 0) { finishPull(true); return; }
        const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
        const threshold = gesture.pointerType === "mouse" ? 6 : 9;
        if (!gesture.moved) {
          // Leave vertical touch gestures to the browser's normal page scrolling.
          if (Math.abs(dy) > threshold && Math.abs(dy) > Math.abs(dx)) { pullGesture = null; return; }
          if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.15) return;
          gesture.moved = true;
          if (view.expanded && !view.transitioning) view.left = rail.scrollLeft;
          gesture.savedLeft = view.left;
          gesture.startWidth = drawer.getBoundingClientRect().width;
          clearTimeout(settleTimer); cancelAnimationFrame(settleFrame);
          view.transitioning = true;
          caseElement.classList.add("is-pulling");
          writePullWidth(gesture.startWidth);
          rail.inert = true; rail.tabIndex = -1; rail.setAttribute("aria-hidden", "true");
          drawer.setAttribute("aria-hidden", "true");
          pull.setPointerCapture(event.pointerId);
          pull.focus({ preventScroll: true });
          update();
        }
        event.preventDefault();
        gesture.distance = dx;
        gesture.width = Math.max(gesture.minimum, Math.min(gesture.maximum, gesture.startWidth + dx));
        writePullWidth(gesture.width);
      };
      const pullUp = (event) => { if (pullGesture?.id === event.pointerId) finishPull(false); };
      const pullCancel = (event) => { if (pullGesture?.id === event.pointerId) finishPull(true); };
      const pullLostCapture = (event) => { if (pullGesture?.id === event.pointerId && pullGesture.moved) finishPull(true); };
      const pullKeydown = (event) => { if (event.key === "Escape" && pullGesture) { event.preventDefault(); event.stopPropagation(); finishPull(true); } };
      const pullClick = (event) => { if (suppressPullClick && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressPullClick = false; } };
      const pullResize = () => { if (pullGesture) finishPull(true); update(); };
      const transitionend = (event) => {
        if (event.target === transitionElement && ["width", "max-width", "flex-basis", "grid-template-columns"].includes(event.propertyName) && view.transitioning) settleCase();
      };
      if (caseElement) {
        presentCase(); caseBindings.set(id, { toggle: toggleCase, setExpanded: commitCase }); transitionElement.addEventListener("transitionend", transitionend);
      }
      if (caseElement && !isDesk) {
        pull.style.touchAction = "pan-y";
        pull.addEventListener("pointerdown", pullDown); pull.addEventListener("lostpointercapture", pullLostCapture); pull.addEventListener("click", pullClick, true);
        window.addEventListener("pointermove", pullMove, { passive: false }); window.addEventListener("pointerup", pullUp); window.addEventListener("pointercancel", pullCancel); window.addEventListener("keydown", pullKeydown, true); window.addEventListener("resize", pullResize);
      }
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
        if (pullGesture) { const gesture = pullGesture; pullGesture = null; view.expanded = gesture.initialExpanded; view.left = gesture.savedLeft; releasePullCapture(gesture.id); }
        caseElement?.classList.remove("is-pulling"); drawer?.style.removeProperty("width");
        pull?.removeEventListener("pointerdown", pullDown); pull?.removeEventListener("lostpointercapture", pullLostCapture); pull?.removeEventListener("click", pullClick, true);
        window.removeEventListener("pointermove", pullMove); window.removeEventListener("pointerup", pullUp); window.removeEventListener("pointercancel", pullCancel); window.removeEventListener("keydown", pullKeydown, true); window.removeEventListener("resize", pullResize);
        view.transitioning = false; caseBindings.delete(id); transitionElement?.removeEventListener("transitionend", transitionend);
        rail.removeEventListener("scroll", update); rail.removeEventListener("keydown", keydown); rail.removeEventListener("pointerdown", pointerdown); rail.removeEventListener("pointermove", pointermove); rail.removeEventListener("click", click, true); window.removeEventListener("pointerup", pointerup); window.removeEventListener("pointercancel", pointerup);
      });
    });
    railCleanup = () => cleanups.forEach((cleanup) => cleanup());
  }
  function openMemory(id, trigger) {
    if (draft) { showToast("꾸미기를 적용하거나 취소한 뒤 기억을 열어 주세요."); return; }
    const memory = findMemory(id), title = findTitle(memory.titleId), rail = trigger?.closest("[data-rail-id]");
    memoryContext = { trigger, railId: rail?.dataset.railId, left: rail?.scrollLeft || 0, suppress: false };
    const visual=visuals[memory.scene], linkedBoards=boards.filter(b=>b.ids.includes(memory.id));
    memoryDialog.innerHTML = `<header class="dialog-header"><p>MOEMOA <span>/</span> 기억</p>${button('×','close-memory','quiet','aria-label="기억 닫기"')}</header><div class="dialog-body memory-detail-body"><div class="detail-art" style="--art-ratio:${visual.ratio}">${art('scene',memory.scene,`${title.name}의 장면`)}</div><aside class="detail-copy"><h2 id="memory-dialog-title">${esc(visual.label)}</h2><p class="detail-reflection">${esc(memory.note||'아직 남긴 감상이 없어요.')}</p><dl class="detail-facts"><div><dt>작품</dt><dd>${esc(title.name)}</dd></div><div><dt>기록일</dt><dd>${dateLabel(memory.date)}</dd></div><div><dt>공개 범위</dt><dd>나만 보기</dd></div><div><dt>이미지 비율</dt><dd>${esc(visual.ratio.replace('/', ' : '))}</dd></div></dl><div class="dialog-actions">${button('작품으로 이동 →','memory-title','quiet',`data-title="${title.id}"`)}</div><section class="detail-connections"><h3>연결된 보드 <span>${linkedBoards.length}</span></h3>${linkedBoards.length?linkedBoards.map(b=>`<details class="detail-board"><summary><span>${esc(b.name)}</span><small>${b.ids.length}개의 기억</small></summary><p>이 기억이 포함된 보드입니다.</p><ul>${b.ids.map(mid=>findMemory(mid)).filter(Boolean).map(m=>`<li${m.id===memory.id?' aria-current="true"':''}>${esc(m.note||findTitle(m.titleId).name)}</li>`).join('')}</ul></details>`).join(''):'<p class="detail-unlinked">아직 연결된 보드가 없어요.</p>'}</section><p class="detail-fixture-note">가상 이미지와 기록으로 구성한 시안입니다.</p></aside></div>`;

    memoryDialog.setAttribute("aria-labelledby", "memory-dialog-title"); memoryDialog.showModal();
  }
  memoryDialog.addEventListener("close", () => { const context = memoryContext; memoryContext = null; if (!context || context.suppress) return; requestAnimationFrame(() => { const rail = context.railId && app.querySelector(`[data-rail-id="${context.railId}"]`); if (rail) rail.scrollLeft = context.left; if (context.trigger?.isConnected) context.trigger.focus({ preventScroll: true }); }); });
  memoryDialog.addEventListener("click", (event) => { const target = event.target.closest("[data-action]"); if (!target) return; if (target.dataset.action === "close-memory") memoryDialog.close(); if (target.dataset.action === "memory-title") { memoryContext.suppress = true; memoryDialog.close(); navigate("title", target.dataset.title); } });

  function openComposer(titleId = "", homeRail = "") {
    if (draft) { showToast("꾸미기를 적용하거나 취소한 뒤 기억을 남겨 주세요."); return; }
    const deskOrigin = state.page === "home" && homeRail.startsWith("home-") && findTitle(titleId) ? homeRail : "";
    composerContext = { scene: null, titleId: deskOrigin ? titleId : "", note: "", homeRail: deskOrigin };
    composerDialog.innerHTML = `<header class="dialog-header"><h2 id="composer-title">기억 남기기</h2>${button("닫기 ×", "close-composer", "quiet", 'aria-label="작성 취소"')}</header><form id="composer-form" class="dialog-body collection-composer"><div class="composer-layout"><section class="composer-images" aria-labelledby="composer-images-title"><div class="composer-preview" id="composer-preview"><p class="composer-placeholder">아래에서 마음에 드는 이미지를 골라 보세요.</p></div><h3 id="composer-images-title">이미지 고르기</h3><p class="composer-demo-note">가상 이미지로 만드는 시안입니다.</p><div class="choice-grid">${visuals.map((visual, index) => `<button type="button" class="image-choice" data-scene="${index}" aria-pressed="false" aria-label="${visual.label} 선택">${art("scene", index, visual.label)}</button>`).join("")}</div></section><section class="composer-fields" aria-label="기억 정보"><label class="field" for="composer-title-select">작품</label><select class="control" id="composer-title-select" required disabled><option value="">작품을 골라 주세요</option>${titles.map((title) => `<option value="${title.id}" ${composerContext.titleId === title.id ? "selected" : ""}>${esc(title.name)}</option>`).join("")}</select><label class="field" for="composer-note"><span>짧은 감상 <span class="muted">(선택)</span></span></label><textarea class="control" id="composer-note" maxlength="160" rows="4" placeholder="어떤 순간이 남았나요?" disabled></textarea><p class="composer-hint" id="composer-hint" role="status">이미지를 먼저 골라 주세요.</p><p class="composer-private">나만 보는 기억으로 남깁니다.</p><div class="dialog-actions">${button("취소", "close-composer", "quiet")}<button type="submit" class="button primary" id="composer-save" disabled>기억 남기기</button></div></section></div></form>`;
    composerDialog.setAttribute("aria-labelledby", "composer-title"); composerDialog.showModal();
  }
  function updateComposerValidity() {
    if (!composerContext) return;
    const chosen = Number.isInteger(composerContext.scene), ready = canSaveMemory(composerContext);
    document.getElementById("composer-title-select").disabled = !chosen || Boolean(composerContext.homeRail);
    document.getElementById("composer-note").disabled = !chosen;
    document.getElementById("composer-save").disabled = !ready;
    document.getElementById("composer-hint").textContent = ready ? "이미지와 작품이 준비됐어요." : chosen ? "이 장면을 기억할 작품을 골라 주세요." : "이미지를 먼저 골라 주세요.";
  }
  composerDialog.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-scene]");
    if (choice && composerContext) {
      composerContext.scene = Number(choice.dataset.scene);
      composerDialog.querySelectorAll("[data-scene]").forEach((element) => element.setAttribute("aria-pressed", String(element === choice)));
      const visual = visuals[composerContext.scene];
      document.getElementById("composer-preview").innerHTML = art("scene", composerContext.scene, visual.label);
      updateComposerValidity();
    }
    if (event.target.closest('[data-action="close-composer"]')) composerDialog.close();
  });
  composerDialog.addEventListener("change", (event) => { if (event.target.id === "composer-title-select" && composerContext && !composerContext.homeRail) { composerContext.titleId = event.target.value; updateComposerValidity(); } });
  composerDialog.addEventListener("input", (event) => { if (event.target.id === "composer-note" && composerContext) composerContext.note = event.target.value; });
  composerDialog.addEventListener("submit", (event) => {
    event.preventDefault(); if (!canSaveMemory(composerContext)) return;
    const { titleId, scene, note, homeRail } = composerContext, sequence = state.nextMemory++, id = `m${sequence}`;
    capturePosition();
    composerContext = null; document.getElementById("composer-save").disabled = true;
    memories.push({ id, titleId, scene, note: note.trim(), date: "2026-10-05", sequence });
    composerDialog.close();
    memoryControls.query = ""; memoryControls.lastAdded = id;
    titleView(titleId).tab = "memories"; titleView(titleId).layout = "film"; railView(`title-${titleId}`).left = 0;
    if (homeRail && state.page === "home") {
      selectDesk(homeRail); railView(homeRail).left = 0; railView(homeRail).index = 0;
      const tile = app.querySelector('.shelf-tile[data-title="' + titleId + '"]');
      if (tile) tile.querySelector(".shelf-caption").innerHTML = renderShelfCaption(findTitle(titleId));
      syncShelfPanel();
      requestAnimationFrame(() => {
        const rail = app.querySelector(`[data-rail-id="${homeRail}"]`), frame = document.getElementById(`${homeRail}-${id}`);
        if (rail) rail.scrollTo({ left: 0, behavior: "instant" });
        frame?.focus({ preventScroll: true }); frame?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      });
    } else {
      state.routeY.set("memories/", 0); navigate("memories");
      requestAnimationFrame(() => { window.scrollTo({ top: 0, behavior: "instant" }); document.getElementById(`memory-${id}`)?.focus({ preventScroll: true }); });
    }
    showToast("기억을 남겼어요.");
  });
  composerDialog.addEventListener("close", () => { composerContext = null; });

  app.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-action]"); if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === "title") navigate("title", target.dataset.id);
    else if (action === "nav") navigate(target.dataset.page);
    else if (action === "memory") openMemory(target.dataset.id, target);
    else if (action === "compose") openComposer(target.dataset.title || "", target.dataset.homeRail || "");
    else if (action === "desk-toggle") changeDeskSelection(state.homeOpen === target.dataset.rail ? "" : target.dataset.rail);
    else if (action === "desk-close") changeDeskSelection("");
    else if (action === "shelf-tab") { capturePosition(); state.activeShelf = target.dataset.shelf; render({ focusId: target.id }); }
    else if (action === "memory-reset") { memoryControls.query = ""; activeFacets={tag:"",character:"",affinity:""}; render({ focusId: "memory-search" }); }
    else if (action === "title-back") navigate(state.titleOrigin.page, state.titleOrigin.id);
    else if (action === "save-title") { capturePosition(); const title = findTitle(state.id); title.saved = !title.saved; render({ focusId: "title-save" }); showToast(title.saved ? "작품을 저장했어요. 기억은 그대로예요." : "작품 저장을 해제했어요. 기억은 그대로예요."); }
    else if (action === "filter") { captureRails(); controls.filter = target.dataset.filter; render({ focusId: target.id }); }
    else if (action === "view") { captureRails(); controls.view = target.dataset.view; render({ focusId: target.id }); }
    else if (action === "reset") { captureRails(); controls.query = ""; controls.filter = "all"; render({ focusId: "title-search" }); }
    else if (action === "title-tab") { capturePosition(); titleView().tab = target.dataset.tab; render({ focusId: target.id }); }
    else if (action === "film-layout") { capturePosition(); titleView().layout = titleView().layout === "film" ? "grid" : "film"; render({ focusId: target.id }); }
    else if (action === "case-toggle") caseBindings.get(`row-${target.dataset.title}`)?.toggle();
    else if (action === "rail-prev" || action === "rail-next") moveRail(target.dataset.rail, action === "rail-prev" ? -1 : 1);
    else if (action === "rail-more") { capturePosition(); const id = target.dataset.rail, view = railView(id), firstNew = titleMemories(target.dataset.title)[view.loaded]; view.loaded += 3; if (id.startsWith("home-")) { syncShelfPanel(); document.getElementById(`${id}-${firstNew.id}`)?.focus({ preventScroll: true }); } else render({ focusId: `${id}-${firstNew.id}` }); requestAnimationFrame(() => { const rail = app.querySelector(`[data-rail-id="${id}"]`), frame = document.getElementById(`${id}-${firstNew.id}`); if (rail && frame) rail.scrollTo({ left: frame.offsetLeft - rail.querySelector(".film-frame").offsetLeft, behavior: reduceMotion() ? "instant" : "smooth" }); }); }
    else if (action === "shelf-edit") { capturePosition(); draft = clone(bookshelf); render({ focusId: target.dataset.editShelf ? `shelf-label-${target.dataset.editShelf}` : "shelf-name" }); }
    else if (action === "shelf-cancel") cancelShelfEdit();
    else if (action === "shelf-apply") { if (!draft.name.trim()) { showToast("책장 이름을 적어 주세요."); document.getElementById("shelf-name").focus(); return; } if (draft.shelves.some((shelf) => !shelf.name.trim())) { showToast("선반 이름을 적어 주세요."); document.getElementById(`shelf-label-${draft.shelves.find((shelf) => !shelf.name.trim()).id}`).focus(); return; } draft.name = draft.name.trim(); draft.shelves.forEach((shelf) => { shelf.name = shelf.name.trim(); }); bookshelf = clone(draft); draft = null; render({ focusId: "shelf-menu-trigger" }); showToast("책장에 적용했어요. 이 시안에서만 유지됩니다."); }
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
    if (target.id === "memory-search") { memoryControls.query = target.value; masonryCleanup(); document.getElementById("memory-results").innerHTML = renderMemoryResults(); app.querySelector(".archive-facets").outerHTML=renderArchiveFacets(); app.querySelector(".collection-result-count").textContent = `${archiveItems().length}개의 기억`; bindMasonry(); }
    if (target.id === "title-search") { captureRails(); railCleanup(); controls.query = target.value; const items = filteredTitles(); document.getElementById("title-results").innerHTML = renderTitleResults(items); app.querySelector(".filter-count").textContent = `${items.length}개 작품`; bindRails(); }
    if (!draft) return;
    if (target.id === "shelf-name") draft.name = target.value;
    else if (target.dataset.shelfLabel) draft.shelves.find((shelf) => shelf.id === target.dataset.shelfLabel).name = target.value;
    else return;
    updateShelfPreview();
  });
  app.addEventListener("change", (event) => {
    const target = event.target;
    if (target.id === "title-sort") { captureRails(); controls.sort = target.value; render({ focusId: target.id }); }
    if (!draft) return;
    if (target.dataset.pickShelf) { toggleShelfTitle(draft, target.dataset.pickShelf, target.value); rerenderEditor(target.id, target.dataset.pickShelf); }
  });
  document.addEventListener("keydown", (event) => { if (event.key !== "Escape" || document.querySelector("dialog[open]")) return; if (draft) { event.preventDefault(); cancelShelfEdit(); } else if (state.page === "home" && state.homeOpen) { event.preventDefault(); changeDeskSelection(""); } });
  document.querySelectorAll("nav [data-page]").forEach((element) => element.addEventListener("click", () => navigate(element.dataset.page)));
  document.getElementById("global-add")?.addEventListener("click", () => openComposer(state.page === "title" ? state.id : ""));
  window.addEventListener("popstate", () => { if (draft) { history.pushState(null, "", "#home"); showToast("꾸미기를 적용하거나 취소해 주세요."); return; } capturePosition(); Object.assign(state, readRoute()); render({ restorePage: true }); });
  window.addEventListener("hashchange", () => { const route = readRoute(); if (route.page === state.page && route.id === state.id) return; if (draft) { history.replaceState(null, "", "#home"); showToast("꾸미기를 적용하거나 취소해 주세요."); return; } capturePosition(); Object.assign(state, route); render({ restorePage: true }); });
  Object.assign(state, readRoute());
  // This review link opens the proposed presentation; it changes no real preference.
  if (state.page === "titles") controls.view = "poster";
  if (!location.hash) { Object.assign(state, { page: "home", id: "" }); history.replaceState(null, "", "#home"); }
  render();
})();
