# Codex 실행 계획 — 스냅샷 이후의 개선 제안

상태: **리뷰에서 제안한 작업 순서. 제품 결정과 운영 변경의 자동 승인 아님.**
기준 소스: `MOEMOA-Pro-Review-2026-09-09.zip/05_CURRENT_SOURCE`.
기존 표지 Gallery·장르 태그·열 조절·Poster/Memory 두 모드·모델 독립성을 보존한다.

## 0. 작업 시작 계약

1. ZIP과 실제 작업 branch의 diff를 확인한다. 최신 소스가 미푸시라는 보고를 무시하고 원격 HEAD로 덮어쓰지 않는다.
2. 작업할 commit/dirty file 목록과 scope를 남기고 개발 기기의 데이터를 별도 보존한다. 브라우저 저장소를 초기화하는 테스트는 전용 프로필에서만 한다.
3. 이 리뷰의 E/R 근거와 현재 소스를 대조한다. 이미 고친 문제는 재수정하지 않고 증거를 기록한다.
4. 의존성 설치와 기존 테스트 baseline을 확보한다. 본 리뷰의 201개 통과는 전체 suite 통과가 아니다.
5. 각 묶음별 `확인→실패 회귀→최소 변경→정상/실패 검증→증거 갱신`으로 진행한다. 한꺼번에 화면을 갈아엎지 않는다.
6. 운영 DB·계정·카탈로그·배포를 변경하지 않는다. 원격 Title tracking sync, Public, 이미지 cloud는 이번 작업에 자동 포함하지 않는다.

## 작업 순서 개요

| 묶음 | 우선순위 | 의존 | 산출 | 완료 판단 |
|---|---|---|---|---|
| W00 | 시작 필수 | 없음 | snapshot 비교·baseline·로컬 데이터 보호 | 어떤 소스를 바꾸는지와 rollback 범위 명확 |
| W01 | P0 | W00 | Memory 완성 조건 일관성·null 평점 수정 | R02/R03 실패 재현이 회귀 테스트로 차단 |
| W02 | P0 | W00 | PrivateTitle ID 재사용·두 번째 기억 | 같은 개인 작품 1앨범/2카드, owner 경계 유지 |
| W03 | P0 | W00 | 자체 ID 작품의 로컬 시청 편집 | 외부 ID 유무와 무관한 저장/재조회 |
| W04a | P0 | W00 | 데이터 범위·백업 안내 정정 | 현재 백업의 포함/제외가 실제 코드와 일치 |
| W04b | P0: 실제 기록 수용 전 | W02,W03,백업 결정 | 신규 메타데이터 export/import와 복구 검증 | clean-store roundtrip·실패시 원본 보존 |
| W05 | P0 핵심 오류 / P1 전체 | W01~W04 | 실패 분류·안전한 이탈·중복 실행 방어 | 오류를 없음/성공으로 오인하지 않음 |
| W06 | P1 | W01,W02 | Memory View와 Board의 이미지 열람 | thumbnail 클릭/시각성/기존 갤러리 보존 |
| W07 | P1 | W02,W03 | Home/Composer/Detail 메인 흐름 정돈 | 처음·반복 작성과 읽기 분리 |
| W08 | P1 | W06 | Archive 최소 검색·탐색 복원 | 저장한 기억을 작품/감상으로 찾고 복귀 |
| W09 | 출시 검증 묶음 | 해당 기능 완성 | Web 사용자·계정·Android gate 별도 증거 | 한 gate PASS를 다른 gate로 확장하지 않음 |
| W10 | P2 | Web 기본 안정 | 부가 기능·카탈로그 잔여·회고 | 핵심 흐름을 막지 않는 독립 backlog |

P0는 취향에 따른 화면 개편이 아니라 기록의 정합성·보존·약속된 기능의 일관성이다. 표지모드 간격 재디자인이나 전체 브랜딩 변경은 P0가 아니다.

## W01. 완성된 Memory의 조건을 모든 쓰기 경로에 적용

### 근거
E08~E11, R02. 생성은 개인 신호를 검사하지만 note update는 같은 검사를 통과하지 않는다. R03은 null 평점 projection 문제다.

### 수정 영역
- `src/features/memory/application/updateMemoryCard.js`
- `src/features/memory/domain/memoryDomain.js`
- `src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js`
- 실제 card replacement/import/sync ingress의 기존 application command
- `src/features/titles/application/titleAlbumProjection.js`
- `tests/unit/updateMemoryCard.test.mjs`, `memoryDomain.test.mjs`, `titleAlbumProjection.test.mjs`

### 구현 계약
최종 candidate card와 현재 title/asset bundle을 공용 validator에 넣고 **저장·sync operation 생성 전에** 검증한다. 공식표지 카드의 마지막 개인신호 삭제는 명확한 domain error로 거부한다. 보정용 note 생성, 자동 DRAFT 강등, 실패 후 일부 sync 큐 기록은 하지 않는다. 다른 신호가 존재해 note만 지우는 경우는 현재 규칙대로 허용한다.

평점 변환은 null/undefined/빈문자열을 먼저 처리하고 실제 0은 보존한다. 기존 저장값을 무단 변경하지 않고 projection 정확성부터 고친다.

### 수용 조건
- 표지+note만 있는 카드의 note삭제 → 원래 카드/버전/큐 변경 없음.
- 표지+note+유효한 다른신호에서 note삭제 → 현재규칙상 허용.
- 사용자 이미지/시스템 디자인은 기존 완료규칙 유지.
- no-op update 동작과 오래된 데이터 수정 시 처리까지 테스트.
- SQL과 local validator 조건이 동등한지 fixture로 대조.
- 미평가null/undefined/empty와 실제0/유효점수를 분리한 테스트.

## W02. 같은 개인 작품에 기억을 누적

### 수정 영역
- `src/features/titles/components/TitleHub.jsx`
- `src/features/titles/domain/titleNavigation.js` 및 기존 Memory navigation parser
- `src/features/memory/components/useMemoryCardComposer.js`
- `src/features/memory/application/createMemoryCard.js`
- title resolver/repository와 `titleAlbumProjection.js`

### 구현 계약
새 개인작품 생성과 기존 개인작품 선택을 구별한다. `privateTitleId`를 이미 선택했다면 명시적으로 재사용하고 소유자·존재·삭제상태를 검증한다. Type/tag 명칭은 실제 기존 contract에 맞추되 문자열만 재전달하지 않는다. PrivateTitle Hub에도 `기억 남기기`를 제공한다.

같은 제목 문자열을 가진 서로 다른 작품이 있을 수 있으므로 제목일치 자동병합은 하지 않는다. 기존 분절자료는 그대로 읽고 추후 명시적 연결 미리보기 절차로만 통합한다.

### 수용 조건
- 개인작품 첫카드→그 Hub의 추가→두번째카드:1앨범/2카드/동일privateTitleId.
- 명시적 새 개인작품은 같은문자열이어도 별개 생성 가능.
- 다른 owner의 ID, 삭제된 ID, 변조된 query는 거부.
- 뒤로가기/선택변경/중복클릭/새로고침에서 잘못된 ID 재사용 없음.
- Board membership과 기존 card ID는 불변.

## W03. 자체 카탈로그 작품도 같은 상태 편집

### 수정 영역
- `src/features/titles/components/TitleHub.jsx`
- `src/features/titles/application/titleHubService.js`
- `src/repositories/titleLibraryRepo.js`
- 기존 `LibraryDetailModal.jsx`, WatchLog domain/repository adapter

### 구현 계약
최소 범위는 공용 내부 Anime ID 작품의 상태·평점 local read/write다. 기존 AniList 연결 작품은 같은 form에 adapter로 연결한다. 기존 UI/자료를 폐기하지 않는다. WatchLog도 약속할 경우 TitleRef 조회/쓰기까지 완성하며, 아직 못하는 출처는 지원 제한을 숨기지 않는다.

PrivateTitle의 작품저장/WatchLog까지 확대하는 것은 현재 명시된 제품 범위를 재확인하고 결정한다. **PrivateTitle Memory 추가(W02)**와 **PrivateTitle tracking 확장**을 한 작업으로 묶지 않는다.

### 수용 조건
- internal Anime ID only, AniList-linked 각각 저장→상태/평점→새로고침→Hub/목록 동일.
- 편집취소/실패시 기존값 보존. read 실패를 0개/미분류로 자동확정하지 않음.
- 작품저장이 Memory를 생성하지 않고 Memory저장이 작품을 자동 저장하지 않음.
- 저장해제시 삭제되는 상태 범위의 문구/결정 확정. Memory/Board 보존.
- 로컬 tracking 구현을 원격 sync 지원 완료로 표현하지 않음.

## W04a. 현재 데이터 도구를 사실대로 표시

### 수정 영역
- `src/components/DataCenter.jsx`
- `src/components/data/ManualDataTools.jsx`
- `src/domain/snapshotCodec.js`, `src/repositories/titleLibraryRepo.js`
- `src/messages/ko.js`, `en.js`, Help

기존 백업이 legacy임을 이미 설명하는 부분은 유지한다. 추가로 **새 자체ID 저장작품도 현재 export에 포함되지 않는 것**을 명시한다. 전체기록수와 기존서재기록수를 분리하고 데이터미로드는0으로 보이지 않게 한다. 계정등록/메타sync/파일보관/공개의 상태는 서로 독립 표시한다.

수용: 포함종류와제외종류를 실제 export필드와1:1대조. Memory-only 사용자가 자신의기록이 없다고 오해하지 않음. 파일 다운로드를 이미지백업완료라 부르지 않음.

## W04b. 보존 가능한 신규 메타데이터 백업

### 선결 결정
- Web 베타에서 제공하는 백업이 메타데이터만인지, native이미지 byte archive까지인지.
- catalog cover는 파일복사가 아니라 안정적ref/version/provenance로 복구하는지.
- 지원하지 않는 개인이미지 bytes는 명확히 제외하고 나중에 별도 단계로 구현 가능.

### 최소 새 snapshot 범위
카탈로그-only saved titles + 기존 저장상태, PrivateTitle, MemoryCard, VisualAsset metadata/design/catalogref, Board, membership, 필요한 preference. 실제 내보내기 계약은 current domain/sync namespace와 대조한다. 서비스 비밀·세션토큰·타owner 데이터는 절대 포함하지 않는다.

### 가져오기
1. schema/version/owner/reference 검증 및 손상 검사.
2. 추가/병합/덮어쓸 수량과 미지원데이터 표시.
3. 변경 전 기존 메타데이터 backup.
4. ID mapping·중복처리·삭제범위를 명시한 preview.
5. 단일DB면 transaction, 여러 저장소/파일이면 staging+journal+rollback/recovery.
6. 실제 durable성공 후 성공표시. 모든 Promise를 await.

### 수용 조건
새 깨끗한 test store로 export/import roundtrip, 동일 count뿐 아니라 ID/ref/note/status/order/catalogref/designdata까지 비교. 이중import 멱등성,중간단계실패,quota초과,옛format호환,foreignowner,손상입력,사용자취소 테스트. 원래 개발기기에서는 destructive시험 금지.

## W05. 실패와 이탈을 안전하게 처리

- TitleHub/MemoryDetail: INVALID_REQUEST, NOT_FOUND, OFFLINE/NETWORK_ERROR, STORAGE_READ_ERROR를 분리.
- catalog/API 실패를 null 정상결과로 광범위 삼키지 않도록 adapter 결과타입을 명확히 한다.
- 기존 값을 가진 화면은 실패시 이전값을 유지하고 retry 제공.
- Board create/update/reorder 및 title/write를 busy/idempotency로 방어.
- Composer/Detail/WatchLog의 dirty 이탈과 저장실패시 입력보존.
- 파일교체의 commit이후 이전파일정리라는 기존안전규칙 유지.

수용: 실패주입별 원본불변·성공메시지없음·재시도중복없음. 중첩main/초점/키보드 수정은 이단계 또는W06에서 함께 회귀확인.

## W06. 기억을 실제로 볼 수 있는 목록과 Board

### 수정 영역
- `src/features/titles/components/TitleAlbumCard.jsx`
- `TitleCover.jsx`, `TitlePosterTile.jsx`, `title-collection.css`
- `src/features/memory/components/MemoryBoardView.jsx`
- `MemoryCardPreview.jsx`, `MemoryVisual.jsx`, system design compact renderer

### 구현
Poster Gallery·태그·열조절을 그대로 둔다. Memory View는1/2/3장 적응형, 클릭 가능한 각Memory,축소용systemdesign,표지없음일때만식별이름. Board는 이미 구현된 읽기/편집구분을 유지하면서 텍스트목록을이미지Gallery로 바꾼다. 이미있는편집모드를새로만드는불필요한재작성금지.

수용: 0/1/2/3/많은Memory,private/covermissing/system/cover/userimage/missingasset fixture. Desktop/Mobile/light/dark. N:M/순서/제거 데이터회귀. 화면전체변경이 아니라 기존review이미지와핵심기능비교.

## W07. Home·작성·상세의 역할 정리

- Home은최근기억/다음행동,Archive는전체목록.
- Web 미선택시 title-first,선택된제목은유지,Android공유는image-first.
- 선택지를첫화면에 모두계층같게노출하지 않고 가용성/문맥으로 줄인다.
- MemoryDetail은읽기기본,수정은명시모드,삭제는더보기/범위확인.
- 기존 route/도메인은유지. 새데이터테이블추가 없이 UI orchestration부터.

수용: 첫사용자가실제Web가용수단으로첫Memory를만들고본인이저장한작품/Memory차이를말할수있음. Cover+note가개인기억으로느껴지는지는테스트질문이며사실로단정하지않음.

## W08. Archive 탐색과 복귀

최소작품/감상검색,최근순/관련일자정렬,제목filter-link를 구현한다. 작품목록의장르필터를Archive검색구현으로오인하지 않는다. URL/history에query/filter/sort/view와필요한scroll문맥을보존한다. Board제안은3개이상상시표시에서dismiss/보드보유/선택문맥으로바꾼다.

수용: 서로다른작품/같은작품여러Memory에서정확히찾기,무결과reset,상세왕복후목록복원,날짜timezone/수정일의미일치. 대규모가상스크롤신규dependency는측정없이다음작업으로넣지않는다.

## W09/W10. 검증과 후순위

Web local beta,Account promotion/sync,Android native,Public을 각각검증한다.계정미검증이면계정기능을숨기거나명시적실험기능으로분리하되정상backup약속으로노출하지않는다.공개지원없어도Privatebeta가불가능한것은아니다.

P2는Timeline/고급회고/Tier개선/Profile확장/세밀한시각효과/추가필터다.카탈로그보류6건과release-source재현성은별도배포/데이터트랙이며현재카드정합성수정을막지않게한다. 다만실제배포시Git/commit/release 식별·회귀증거는필수다.

## 매 작업 후 Codex 보고 형식

- 변경한 문제와근거(E/R/현재line), 변경파일.
- 유지한사용자결정과새승인필요사항.
- 실행한정확한명령/exit/status,환경실패와제품실패구분.
- 수정전실패→수정후성공 fixture와새스크린샷.
- 데이터생성/변경/삭제범위,rollback방법.
- 완료한gate와미확인gate. 운영배포완료라고표현하지않음.
