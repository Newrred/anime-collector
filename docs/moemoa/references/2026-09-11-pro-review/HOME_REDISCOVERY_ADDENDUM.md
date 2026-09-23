# MOEMOA 홈 재발견 기능 보완 검토

- 검토일: 2026-09-11
- 상태: **제품 제안 및 소스 확인 결과. 사용자 승인 전 신규 확정 결정이 아님.**
- 기준: `MOEMOA-Pro-Review-2026-09-09.zip`의 최신 소스. 과거 문서는 기능 의도의 참고 자료일 뿐 현재 확정 규칙을 덮어쓰지 않는다.
- 범위: 기존 홈/쇼케이스의 기능 잔존 여부, 신규 Memory와의 연결, 홈의 역할 및 복구 우선순위.
- 검증 한계: 과거 운영 버전을 다시 빌드하거나 브라우저에서 재현하지 않았다. 소스 분기 검토와 실제 순수 함수 실행을 구분한다.
- 기존 리뷰 문서와 프로젝트 원본은 수정하지 않았다.

## 1. 결론

현재의 깔끔한 표현은 유지하고, 기록 재발견 기능은 선택적으로 복구한다. 기존 대시보드를 통째로 되돌리거나 모든 회고를 메뉴 깊숙이 숨기는 방식은 모두 권장하지 않는다.

홈은 최근 목록의 복제본이 아니라 ‘내 기록을 새로운 맥락으로 꺼내주는 화면’으로 만들고, Archive는 모든 기록을 찾는 화면으로 유지한다. 재방문 효과는 제품 가설이며 아직 검증된 수치가 없다.

## 2. 확인된 사실

### 홈에 직접 연결된 기존 기능

- `ResurfacingCards`: 이어 쓸 기록, 최근 남긴 기억, 이맘때의 나.
- `YearRecapPanel`: 연도별 로그·작품·캐릭터·재시청·계절 요약, 텍스트 복사/공유와 이미지 저장 코드.
- `HomeTasteCard`: 기존 Library의 상태별 분류, 장르 상위 5, 재시청 상위 5.
- `HomeShowcasePreview`: 기본 preview layout에 캐릭터 오비트, 한 줄 기억, 기록 밀도 캘린더.
- `CharacterInsightSheet`: 선택 캐릭터의 관련 작품·이유 태그·기록 타임라인.

### 공용 쇼케이스에 추가로 남아 있는 기능

`ShowcaseGrid.jsx`, `showcaseSelectors.js`에는 취향 지문, 이맘때의 나, 단어 × 장르, 기억의 온도, 한 줄 기억, 기록 밀도 캘린더, 캐릭터 오비트, 포스터 팔레트의 계산/표시 구현이 있다.

이 공용 위젯 전부가 과거 홈에 동시에 노출되었다고 단정하지 않는다. 현재 Home의 preview layout이 직접 선택하는 것은 위에 열거한 세 개다. 함수·UI의 존재와 현재 데이터에서의 품질/실행 성공도 구분한다.

### 지금 보이지 않는 이유

`Home.jsx`는 Memory를 `useHomeMemoryArchive()`로, 기존 Library/WatchLog를 `useShowcaseSource()`로 각각 읽는다. 기존 회고와 쇼케이스 계산은 후자의 `items`, `logs`, `mediaMap`, `titleById`를 사용한다.

화면 분기는 Memory 읽기가 ready인 상황에서:

1. `memoryArchive.latest`가 있어야 활성 홈으로 들어간다.
2. 그 안에서 `legacyOnboardingState.stage === "active"`일 때 기존 블록을 렌더링한다.
3. `deriveOnboardingState` 호출에는 `itemCount`, `logCount`만 전달하고 `memoryCardCount`는 전달하지 않는다.
4. 이 호출 방식에서는 Library 작품 3개 이상과 WatchLog 1개 이상이 active 조건이다.

따라서 신규 Memory 50개가 있어도 기존 Library/WatchLog가 없으면 옛 재발견 블록은 보이지 않는다. 반대로 기존 기록만 있고 Memory가 없으면 바깥 분기에서 빈 Home으로 간다. 이는 소스 조건의 결과이며 화면 실행 실험 결과라고 표시하지 않는다.

`buildHomeResurfacing`의 `missingMemory`는 신규 Memory 수가 아니라 기존 WatchLog가 없는 Library 작품을 찾는다. 이름이 비슷해도 신규 Memory용 함수로 그대로 재사용해서는 안 된다.

## 3. 권장 홈

고정된 작은 구조 안에서 데이터에 맞는 콘텐츠를 선택한다.

1. 기록 진입점과 최근 Memory 3~6장: 최근 작업 복귀.
2. ‘다시 꺼내볼 기억’: 실제 오래된 카드 또는 해당 시기의 카드 1~3장과 원문 감상·날짜.
3. ‘오늘의 발견’: 같은 작품의 서로 다른 시기 기억, 한 줄 기억, 가벼운 기간 요약 중 의미 있는 1~2개.
4. ‘발견 더 보기’: 자세한 캘린더·회고·취향 시각화를 보는 비공개 상세 진입점. 처음부터 새 최상위 메뉴는 만들지 않는다.

빈 통계·잠긴 위젯·같은 카드 반복으로 공간을 채우지 않는다. 최초 기억 작성 CTA와 최근 기록 접근성을 보존한다. 모바일에서는 긴 대시보드가 되지 않도록 노출 수를 제한한다.

## 4. 복구 우선순위

| 기능 | 권장 처리 | 최소 데이터/의미 조건 |
|---|---|---|
| 한 줄 기억 | 먼저 복구 | 실제 작성한 비어 있지 않은 감상. AI가 문장을 만든 것으로 대체하지 않음 |
| 예전 기억/이맘때의 나 | 먼저 복구 | 유효한 과거 날짜. 저장일과 시청일을 구분하고 정밀도에 맞는 라벨 사용 |
| 같은 작품, 다른 시기의 기억 | 우선 추가 | 동일한 안정적 TitleRef와 다른 기록 시점. 내용만 보여주고 감정 변화를 단정하지 않음 |
| 자주 기록한 작품/기억의 온도 | 다음 복구 | 집계 기준·대상 기간을 밝힘. 작성 빈도를 최애/평점으로 바꾸어 말하지 않음 |
| 월·연간 회고/기록 밀도 | 요약 후 상세 확장 | 실제 데이터 기간과 정확한 건수. 카드·작품·시청 완료·Board membership을 중복 합산하지 않음 |
| 캐릭터 오비트 | 연결 데이터 확보 후 | 명시적 캐릭터 참조가 있을 때만. 장면 이미지에서 임의 추론하지 않음 |
| 취향 지문/단어×장르 | 상세 영역에서 검증 | 텍스트·장르 표본과 분모 표시. 읽기/파악 비용이 재미보다 커지지 않는지 확인 |
| 포스터 팔레트 | 선택적 시각화 | 공식 표지 색을 모은 결과와 사용자 장면 이미지 색을 모은 결과를 구분 |

공식 표지 기반 Memory도 유효한 사용자 기록이며 재발견 대상이다. catalog 표지 표시만으로 새 Memory를 만들거나 기억 수에 포함하지 않는다.

## 5. 노출 원칙

노출은 일괄 ‘몇 개 달성’보다 각 기능의 데이터 조건으로 판단한다.

- 기록이 없는 홈: 첫 작성 안내와 명시적 예시만 표시.
- 기록이 적은 홈: 최근 기억 중심. 재발견의 명분이 없으면 억지로 생성하지 않음.
- 같은 작품의 서로 다른 시점 카드가 있으면 비교형 발견 허용.
- 기간이 쌓이면 과거 카드/월간 회고 허용.
- 상세 분석은 충분한 원본 데이터가 있는 경우에만 추가.

초기에는 하루/세션 안에서 안정적인 후보를 보여주고, 같은 카드가 여러 영역에 반복되지 않게 한다. 사용자가 직접 ‘다른 기억 보기’를 누르면 교체할 수 있다. 무한 피드, 연속 기록 압박, 알림, 대시보드 편집기는 첫 복구 범위에 포함하지 않는다.

## 6. 새 데이터 기준으로 연결할 때의 필수 조건

- `MemoryCard`를 주 입력으로 사용하며 catalog·PrivateTitle을 같은 TitleRef 체계로 처리한다.
- Library/WatchLog는 원래 의미를 가진 별도 보조 자료다. 자동 Memory 변환, 강제 작품 저장, 새 Board 자동 생성은 금지한다.
- 파생 회고/시각화는 원본을 참조하는 읽기 모델이다. 원본 카드나 통계를 영구 복제할 필요가 없다.
- `createdAt`은 기록 생성일, `watchedAt`은 사용자가 입력한 시청일, `updatedAt`은 수정일로 구분한다. 오늘 수정한 과거 기록을 ‘오늘 본 작품’으로 표현하지 않는다.
- 감정·캐릭터 필드가 모델에 있더라도 실제 입력 경로와 데이터가 없으면 해당 시각화를 활성화하지 않는다.
- 최근에 열었는지를 활용하려면 로컬 열람 이력이 필요하다. 생성일만 가지고 ‘오랫동안 안 봤던 기억’이라고 단정하지 않는다.
- 카드·작품·보드 관계는 다른 집계 단위다. 카드를 여러 Board에 넣었다고 새 기록 수가 늘지 않는다.
- 원본 이미지가 현재 기기에 없는 경우를 처리한다. catalog 표지로 개인 이미지를 조용히 대체하지 않는다.
- 계정/guest 소유자 경계를 지키고, private 재발견을 public 미니홈이나 자동 공유로 연결하지 않는다.
- 홈에서 전체 고해상도 이미지를 로드하지 않는다. 후보 메타데이터를 고른 뒤 소수 preview만 읽는다.

## 7. 앞선 리뷰의 우선순위 보완

‘Legacy 통계/회고 이동·접기’는 기존 거대한 대시보드를 낮추자는 의미로 좁힌다. 개인 기록을 다시 꺼내는 기능 전체를 P2로 미뤄서는 안 된다.

- 기존 P0 유지: 공식 표지 카드 수정 검증, PrivateTitle 누적, 기록/백업 범위·오류 정합성.
- P1 앞쪽: 신규 Memory 기준 한 줄 기억, 과거 카드 재발견, 같은 작품 연결, 원본 상세 열기. 재방문 베타에서 검증할 최소 범위로 포함.
- 이후 P1: 기간 요약과 보드 재열람, 필요한 전용 상세.
- P2: 관계망·교차 분석·포스터 팔레트·고급 연간 연출·공유. 기존 코드 보존하되 준비 전 전체 노출하지 않음.

Library 3개/로그 1개 조건만 삭제해서 기존 블록을 모두 켜는 것은 권장하지 않는다. 데이터 의미와 시각 표현을 함께 전환한다.

## 8. 검증

비교할 것은 빈 초기 화면이 아니라 기록이 축적된 사용자의 홈이다. 데이터량과 기간을 맞춘 샘플/동의받은 실제 개인 기록으로 ‘최근 목록만 있는 홈’과 ‘제한된 재발견을 포함한 홈’을 비교한다. 소규모 질적 테스트를 통계적으로 확정된 리텐션 결과라고 보고하지 않는다.

관찰 대상: 과거 기록을 자발적으로 여는지, 왜 이 기억이 보이는지 이해하는지, 원본과 연결이 정확한지, 작성/검색을 찾기 어려워지지 않는지. 실제 반복 사용에서는 원본 재열람·같은 작품 추가 기록·보드 재정리·복귀를 함께 본다. 클릭률/체류시간만으로 성공을 선언하지 않는다. 읽고 만족했다면 작성하지 않아도 가치 있는 사용이다.

## 9. 참고 자료의 지위

- 2026-08-10 제품 방향성·시장 검증 전략서, 6.4: 과거 카드, 동일 작품의 다른 시기 카드, 한 달 전·작년 같은 달 등 규칙 기반 재발견을 기술. 과거 기획의 의도 근거이지 당시 모든 기능 구현의 증명은 아님.
- 2026-09-09 ZIP의 현재 코드: 아래 경로와 줄 범위에서 직접 확인.
- Nielsen Norman Group, Progressive Disclosure: 필수 기능과 상세 기능의 노출을 나누는 일반 UX 원리 참고. 이 문서가 MOEMOA의 특정 기능 효과를 검증한 것은 아님.

원본 ZIP SHA-256: `840f14082e9fbcd9172905b7d1754f2bc63e51704d536aae700f1c3beb4dd237`

## 10. 실제 selector 실행과 분기 확인

모든 행은 Memory 읽기 상태가 ready라고 가정한다. 실제 `deriveOnboardingState`를 import해 실행하고 Home의 조건식과 결합했다. 브라우저 E2E는 수행하지 않았다.

| 신규 Memory | 기존 Library 작품 | 기존 WatchLog | 기존 stage | 옛 홈 블록 노출 |
|---:|---:|---:|---|---|
| 0 | 3 | 1 | active | 아니오 |
| 1 | 0 | 0 | add-first-title | 아니오 |
| 50 | 0 | 0 | add-first-title | 아니오 |
| 50 | 2 | 10 | add-three-titles | 아니오 |
| 1 | 3 | 0 | write-first-log | 아니오 |
| 1 | 3 | 1 | active | 예 |

## 11. 소스 위치와 핵심 발췌

아래 줄 번호는 ZIP의 `05_CURRENT_SOURCE` 아래 원본 파일 기준이다.

### `src/components/Home.jsx:164–174`

```text
 164 export default function Home() {
 165   const { theme, locale, setTheme, setLocale } = useUiPreferences();
 166   const copy = getMessageGroup(locale, "home");
 167   const onboardingCopy = getMessageGroup(locale, "homeOnboarding");
 168   const memoryCopy = getMessageGroup(locale, "homeMemory");
 169   const tasteCopy = getMessageGroup(locale, "libraryStatsPanel");
 170   const { items, logs, mediaMap, titleById } = useShowcaseSource(locale);
 171   const memoryArchive = useHomeMemoryArchive();
 172   const [canInstallPwa, setCanInstallPwa] = useState(false);
 173   const [selectedCharacter, setSelectedCharacter] = useState(null);
 174   const [recapYear, setRecapYear] = useState(null);
```

### `src/components/Home.jsx:196–209`

```text
 196   const resurfacing = useMemo(() => buildHomeResurfacing({ items, logs }), [items, logs]);
 197   const tasteDashboard = useLibraryStatsPanelProps({ items, mediaMap, locale, titleById });
 198 
 199   const showcaseModel = useMemo(
 200     () => buildShowcaseModel({ items, logs, mediaMap, titleById, locale }),
 201     [items, logs, mediaMap, titleById, locale]
 202   );
 203 
 204   const rawBase = String(import.meta.env.BASE_URL || "/");
 205   const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
 206   const legacyOnboardingState = deriveOnboardingState({
 207     itemCount: items.length,
 208     logCount: logs.length,
 209   });
```

### `src/components/Home.jsx:320–326`

```text
 320       {memoryArchive.status === "loading" || memoryArchive.status === "error" ? (
 321         <HomeMemoryOverview base={base} copy={memoryCopy} memory={memoryArchive} />
 322       ) : memoryArchive.latest ? (
 323         <>
 324       <HomeMemoryOverview base={base} copy={memoryCopy} memory={memoryArchive} />
 325       {legacyOnboardingState.stage === "active" ? (
 326         <>
```

### `src/components/Home.jsx:385–422`

```text
 385       <ResurfacingCards
 386         locale={locale}
 387         base={base}
 388         mediaMap={mediaMap}
 389         titleById={titleById}
 390         recentLogs={recentLogTargets}
 391         missingMemory={continueTargets}
 392         thisTimeRows={thisTimeTargets}
 393       />
 394 
 395       <YearRecapPanel
 396         locale={locale}
 397         recapYear={recapYear}
 398         setRecapYear={setRecapYear}
 399         recapYears={recapYears}
 400         yearRecap={yearRecap}
 401         titleById={titleById}
 402         onOpenCharacter={openCharacterSheet}
 403       />
 404 
 405       <HomeTasteCard
 406         dashboard={tasteDashboard}
 407         base={base}
 408         copy={tasteCopy}
 409       />
 410 
 411       <HomeShowcasePreview locale={locale} base={base} model={showcaseModel} />
 412 
 413       <CharacterInsightSheet
 414         locale={locale}
 415         base={base}
 416         selectedCharacter={selectedCharacter}
 417         characterInsight={characterInsight}
 418         titleById={titleById}
 419         onClose={() => setSelectedCharacter(null)}
 420       />
 421         </>
 422       ) : null}
```

### `src/domain/onboardingState.js:1–10`

```text
   1 export function deriveOnboardingState({ itemCount = 0, logCount = 0, memoryCardCount = 0 } = {}) {
   2   const items = Math.max(0, Number(itemCount) || 0);
   3   const logs = Math.max(0, Number(logCount) || 0);
   4   const memoryCards = Math.max(0, Number(memoryCardCount) || 0);
   5   if (memoryCards > 0) return { stage: "active", primaryAction: "open-archive" };
   6   if (items === 0) return { stage: "add-first-title", primaryAction: "add-title" };
   7   if (logs === 0) return { stage: "write-first-log", primaryAction: "write-log" };
   8   if (items < 3) return { stage: "add-three-titles", primaryAction: "add-title" };
   9   return { stage: "active", primaryAction: "open-library" };
  10 }
```

### `src/hooks/useShowcaseSource.js:19–32`

```text
  19     async function load() {
  20       setLoading(true);
  21       await ensureLegacyStorageMigrated().catch(() => {});
  22 
  23       const [list, preferredLogs] = await Promise.all([
  24         readLibraryListPreferred([]).catch(() => []),
  25         readAllWatchLogsPreferred().catch(() => []),
  26       ]);
  27       const safeList = Array.isArray(list) ? list : [];
  28       const ids = safeList.map((x) => Number(x?.anilistId)).filter(Number.isFinite);
  29 
  30       if (!alive) return;
  31       setItems(safeList);
  32       setLogs(Array.isArray(preferredLogs) ? preferredLogs : []);
```

### `src/components/home/HomeShowcasePreview.jsx:1–10`

```text
   1 import { getMessageGroup } from "../../domain/messages.js";
   2 import ShowcaseGrid from "../showcase/ShowcaseGrid.jsx";
   3 
   4 const PREVIEW_LAYOUT = {
   5   version: 2,
   6   widgets: [
   7     { id: "characterGravity", enabled: true, size: "wide" },
   8     { id: "memoryLineShelf", enabled: true, size: "wide" },
   9     { id: "logDensityCalendar", enabled: true, size: "wide" },
  10   ],
```

### `src/domain/showcase/showcaseSelectors.js:577–588`

```text
 577 export function buildShowcaseModel({ items, logs, mediaMap, titleById, locale = "ko" }) {
 578   return {
 579     tasteFingerprint: buildTasteFingerprint({ logs, mediaMap, locale }),
 580     thisTimeCapsule: buildThisTimeCapsule({ logs, mediaMap, titleById }),
 581     genreWordHeatmap: buildGenreWordHeatmap({ logs, mediaMap, locale }),
 582     resonanceShelf: buildResonanceShelf({ logs, mediaMap, titleById }),
 583     memoryLineShelf: buildMemoryLineShelf({ logs, mediaMap, titleById, locale }),
 584     logDensityCalendar: buildLogDensityCalendar({ logs }),
 585     characterGravity: buildCharacterGravity({ logs, titleById, locale }),
 586     posterPalette: buildPosterPalette({ items, mediaMap, titleById, locale }),
 587   };
 588 }
```

### `src/domain/homeSelectors.js:38–47`

```text
  38   const seenLogAnime = new Set(
  39     sortedLogs.map((x) => Number(x?.anilistId)).filter(Number.isFinite)
  40   );
  41   const missingMemory = safeItems
  42     .filter((it) => !seenLogAnime.has(Number(it?.anilistId)))
  43     .sort((a, b) => Number(b?.addedAt || 0) - Number(a?.addedAt || 0))
  44     .slice(0, 8)
  45     .map((it) => ({
  46       anilistId: Number(it.anilistId),
  47     }));
```

### `src/features/memory/components/useHomeMemoryArchive.js:16–29`

```text
  16     getPlatformMemoryRuntime().then(async (runtime) => {
  17       const archive = (await runtime.listArchive()).filter(Boolean);
  18       const latestBundle = archive[0] || null;
  19       const previewDataUrl = latestBundle?.asset?.localRef
  20         ? await runtime.getPreview(latestBundle.asset.localRef).catch(() => null)
  21         : null;
  22       const catalogCover = latestBundle?.asset?.catalogCoverRef
  23         ? await runtime.resolveCatalogCover(latestBundle.asset.catalogCoverRef).catch(() => null)
  24         : null;
  25       if (!active) return;
  26       setState({
  27         status: "ready",
  28         count: archive.length,
  29         latest: latestBundle ? { ...latestBundle, previewDataUrl, catalogCover } : null,
```

추가 확인 위치: `src/domain/recapSelectors.js:105–226`, `src/domain/characterInsights.js:13–96`, `src/components/showcase/ShowcaseGrid.jsx`, `src/messages/ko.js:833–997`, `src/components/Home.jsx:47–101`, `src/features/memory/application/createMemoryCard.js:193–209`.
