# Codex 전달 — 컬렉션을 하나의 미니홈으로 정렬하는 구현 명세

작성일: 2026-10-13 KST
소스 기준: `b0541fffb03c1e828feef21d3e38fa5caa335c07`
관련 검토: `01_REVIEW_AND_TARGET_SPEC.md`
현재 요청 범위: **분석·계획 문서 작성**. 이 문서가 코드·DB·운영 변경을 포괄 승인하지 않는다.

본 문서는 기존 ExecPlan에 반영할 입력이다. M0~M5/W01~W20/C01~C12/Q01~Q24/D01~D06은 유지한다. `release-v2/03_RELEASE_WORKBOARD.md`만 진행 상태의 기준으로 삼고, 새 작업판·마일스톤 트리를 추가하지 않는다. 기존 완료된 디자인 보고를 미완료로 고치지 말고, 이번 새로운 관계 교정의 범위를 같은 진행 체계에 연결한다.

## 1. 목적과 사용자 결과

사용자 표현을 그대로 제품 관계로 사용한다.

> 컬렉션 = 미니홈. 컬렉션 속 선반 = 애니 작품 보드. 현재 별개로 구현된 Memory 보드 = 컬렉션 안의 다른 종류의 묶음.

최종 완료 문장:

> 소유자가 하나의 컬렉션에서 기존 작품 선반과 이미지 보드를 구성하고, 그중 선택한 내용을 같은 구조의 공개 컬렉션으로 보여준다. 방문자는 작품·기억을 열고 팔로우하며, 공개 철회와 원본 보존은 기존 계약대로 작동한다.

미니홈 링크를 메뉴에 추가하는 것만으로 완료하지 않는다. 별도 프로필 폼에서 동일한 전시를 다시 작성하게 하지 않는다. 작품 선반을 공개하기 위해 가짜 Memory를 만드는 것도 금지한다.

## 2. 관련 확정 결정

- 이번 사용자 설명은 분리된 컬렉션/미니홈 UX에 대한 교정이다. 과거 문서의 별도 영역 유지 제안을 그대로 실행하지 않는다.
- 컬렉션/작품/기억 기본 탐색, 작품 두 보기, 기존 선반의 표지 뒤 실제 기억과 옆 펼침/모바일 아래 펼침, 현행 테마·핑크 포인트는 보존한다.
- 취소된 `COLLECTION-TASTE-SPACE-01`의 새로운 실험 배치나 선반을 작품 탭으로 이전하는 내용을 되살리지 않는다.
- 기존 작품 저장·시청 상태·평점·재시청·WatchLog와 Memory는 독립한다. 과거 감상 관리가 이미 구현된 현행 코드를 재사용한다.
- 무료/Web 우선, 현행 계정·이미지 권리·가입/국가·삭제/철회·한도는 바꾸지 않는다.
- 기능이 같은 사용자 공간에 있다는 것과 같은 공개 권한을 갖는다는 것은 다르다. 원본 private와 public projection은 분리한다.

결정 문서에는 위 관계 교정과 기존 결정 중 무엇을 대체하는지를 한 항목으로 기록한다. 구현 방식 후보와 새 공개 필드 허용은 별도로 표시한다.

## 3. 현재 상태와 저장소 증거

- Bookshelf는 `shelves[{id,name,titleKeys}]`. 현재 normalizer는 그 외 필드를 제거한다.
- Memory Board는 기존 boardId와 card membership을 갖는다. 한 Memory는 여러 보드에 연결된다.
- Minihome은 기존 Memory publicationId를 선택하는 모델이다. titleKeys 기반 선반 공개는 현재 계약에 없다.
- 기존 공개 이미지·미니홈·팔로우·신고·조치·철회는 과거 exact 후보의 운영 인수 증거가 있다. 현재/new 구조의 통과로 바꿔 적지 않는다.
- 최근 디자인 인수는 앱 `cafcd2a`, 문서 후속 `b0541ff`. 이전 디자인 완료를 부정하지 않되 사용자 경험 수용은 별도다.
- 이번 독립 검사: `minihome.test.mjs` + `memoryBoard.test.mjs` 9 PASS. 원본 모듈/합성 gateway 관찰3건. 전체 앱/브라우저/SQL/실계정 검사는 미실행.
- `get_memory_minihome`이 반환하는 selection이 현행 status/controller에서 유실되고 편집 폼이 빈 값으로 시작하는 경로가 있다.
- `simpleCardSharing.js`는 카드 하나의 공개를 위해 내부 1카드 보드를 생성할 수 있다. 모든 board를 사용자 전시 선반으로 자동 배치하지 않는다.

기준 이후 코드가 진행됐으면 동일 기능의 현재 구현을 먼저 확인한다. 이미 해결된 문제를 다시 수정하지 않는다. 현재 branch의 변경을 보존하고 force/reset/과거 브랜치 통합을 하지 않는다.

## 4. 범위

### 포함

- 하나의 Collection shell에서 소유자 보기·편집·공개 설정·방문자 보기의 디자인 계층을 통일한다.
- 기존 작품 선반/이미지 보드를 참조하는 최소 배치 모델과 계정 연속성을 연결한다.
- Memory가 없는 작품도 전시할 수 있는 공개 작품 선반 계약을 추가한다.
- 기존 공개 homeId/publicationId, 팔로우/신고 대상, 딥링크와 기존 전시 설정을 보존한다.
- 공개 설정 폼의 폭·선택 타일·현재 선택 요약·개별 옵션·주요 행동을 재배치한다.
- 재진입 초기값, 저장·취소·뒤로가기, 부분 실패·권한 변경 및 새 유형의 공개/철회를 검사한다.

### 제외

- 임의의 다중 중첩 보드, 협업, 범용 콘텐츠 그래프, 새 추천/취향 시각화.
- Memory 없는 작품을 위해 시스템 카드를 자동 생성하는 우회 구현.
- 전체 CSS/TypeScript 경고 정리, 디자인 시스템/상태관리/라우터 전면 교체.
- DB·인증·백업 전체 재작성, 기존 test 환경 다시 구축.
- 광고·결제·저장 상품·국가·성인 인증·Android 출시 확대.
- 개인 작품/감상/이미지의 자동 공개, 승인 없는 권리 확대.

## 5. 아키텍처·데이터 흐름

```text
기존 Title shelf ───────┐
                       ├─ owner별 Collection layout 참조 → 소유자 화면
기존 Memory Board ─────┘

명시적 공개 선택
  → 서버가 source ID/owner/version/권리/허용 필드를 재검증
  → typed public home projection
  → 방문자 Collection 렌더러

기존 Memory publication과 image 전달 경계는 그대로 재사용
```

렌더러는 동일한 UI 구조를 공유할 수 있다. owner loader와 public reader는 섞지 않는다. 방문자는 private 자료를 먼저 받고 숨기는 방식이 아니라 서버가 허용한 public DTO만 받는다.

### 최소 논리 계약 (물리 저장 위치는 코드 대조 후 확정)

```text
CollectionLayout v1
  owner별
  sections: [{ sectionId, kind: TITLE_SHELF | MEMORY_BOARD, sourceId, position }]

PublicHome의 신규 선택 버전
  동일 homeId
  nickname/bio
  entries:
    - 기존 memory publication 참조
    - TITLE_SHELF 공개 선택 참조
```

`kind`를 기존 shelf JSON에 무조건 추가하지 않는다. 현재 normalizer와 백업/sync가 이를 버린다. 별도의 versioned layout을 두거나 기존 저장 모델을 additive하게 확장하되, 이름·작품/카드 membership을 중복 소유하는 저장소는 만들지 않는다. 물리 구현안은 기존 계정 저장에 대한 작은 adapter를 우선한다.

공개 작품 선반은 원본 `titleKeys`를 그대로 client 주장으로 신뢰하지 않는다. 서버가 사용자가 소유한 source와 선택한 작품을 대조하고, 승인된 카탈로그 ID/표지 revision으로 직렬화한다. 현재 title state의 계정 서버 자료를 활용하며 새 전체 카탈로그 동기화는 만들지 않는다.

### 최초 공개 작품 항목 권장 범위

작품명·검증된 작품 참조·승인된 표지만. 평점·상태·재시청·감상·태그·캐릭터·private 기억 수는 자동 포함하지 않는다. 추가 필드 공개는 별도 명시 선택/미리보기 계약이 생길 때만 적용한다. 권리와 카탈로그 참조를 해결할 수 없는 작품은 제외 이유를 표시하고 임의로 다른 작품에 연결하지 않는다.

내 선반에 보이는 Memory 팬은 private 자료다. 공개판에는 명시적으로 선택되어 현재도 공개 가능한 Memory만 나타난다. 첫 slice를 표지-only로 완성할 수 있으나 이를 개인 선반 전체의 공개와 혼동하지 않게 표시한다. 이미지 전시는 기존 Memory 보드를 같은 컬렉션에 배치해 제공한다.

## 6. 변경 파일 지도

아래는 영향 지도이며 모든 파일의 무조건 수정 목록이 아니다.

| 책임 | 기존 위치 | 변경 원칙 |
|---|---|---|
| Collection 소유자 | `src/pages/index.astro`, `src/features/bookshelf/BookshelfView.jsx`, `BookshelfEditor.jsx` | 선반 기능 보존, typed section 표시/선택/배치 연결 |
| 선반 저장 | `src/features/bookshelf/bookshelfSettings.js`, `src/features/titles/application/titleStateSync.js` | owner·기존 keys 보존, 새 layout의 version/동기화 의미 명시 |
| 이미지 보드 | `MemoryBoardView.jsx`, `AddMemoryToBoard.jsx`, `domain/memoryBoard.js`, `adapters/indexeddb/memoryBoardStore.js` | 기존 membership·순서·삭제 명령을 재사용하는 embedding adapter |
| 공개 설정 | `MemoryPublicationPanel.jsx`, `createPublicationController.js` | controller 보존, 폼/선택/초깃값/현재 작업 상태 presentation 변경 |
| 미니홈 | `MemoryMinihome.jsx`, `createMinihomeController.js`, `domain/minihomeView.js`, `MinihomeSnapshot.jsx` | selection hydration + typed entry, homeId 유지 |
| 서버 연결 | `adapters/supabase/SupabasePublicationGateway.js`, 관련 minihome/publication migration | additive 버전 계약, 새 shelf projection/validation 및 기존 v1 compatibility |
| 방문자 | `PublicMinihome.jsx`, `PublicMemoryBoard.jsx`, `PublicBoardSnapshot.jsx` | 공통 Collection 레이아웃, public DTO 전용 |
| 카드 간편 공유 | `application/simpleCardSharing.js` | 내부 생성 보드 식별·기존 전시 보존. 자동 정리/삭제 금지 |
| 메뉴/호환 | `PrimaryNavigationLinks.jsx`, `TopNavDataMenu.jsx`, 기존 안전 return/navigation helper | Collection 중심 진입, 기존 `/boards/`, `/minihome/`, public URL 계속 작동 |
| 스타일 | `channel-service.css`, `arena-refinement.css`, `memory-board.css`, `memory-publication.css`, `public-surface-design.css` | 작업별 범위 안의 cascade 정리. 전역 override 추가로 덮지 않기 |
| 문구 | `src/messages/ko.js`, `src/messages/en.js`, 관련 copy | 소유자/방문자·원본/공개 위치·묶음 종류를 분명히 |

새 파일은 명확한 책임이 기존 모듈에 없을 때만 추가한다. 위 표의 `src/features/memory/` 이하 약식 경로는 원 저장소에서 정확한 위치를 확인한다.

## 7. 데이터·스키마 마이그레이션

서버 코드 변경 없이 주어진 요구 전체를 충족한다고 주장하지 않는다. 새 public title-shelf 계약이 필요하다. 다만 기존 Memory publication 전체를 재작성할 필요도 없다.

권장 적용 순서:

1. 기존 home/board/shelf의 읽기 전용 대비표와 기존 공개 selection을 확보한다. 개인 데이터는 테스트 로그·리포트에 넣지 않는다.
2. 새 버전을 읽을 수 있는 reader/gateway/SQL을 additive하게 준비한다. 기존 v1 조회와 링크는 계속 동작한다.
3. 새 writer는 명시 선택으로만 typed entries를 쓴다. 구클라이언트가 새 entry를 이해하지 못한 채 저장해 지우는 경우는 안전하게 거절하고 갱신을 안내한다.
4. 기존 homeId·boardId·publicationId·shelfId를 그대로 쓰며 기존 전시는 의도한 순서로 표현한다. 데이터 형태 변경이 필요하면 dry-run 수량·참조 매핑을 확인한다.
5. owner 배치와 public 선택을 구분한다. 기존 private 선반/보드를 전시 가능 목록에 보인다고 게시가 바뀌지 않는다.
6. 20개 private 선반과 10개 public entries의 다른 제한을 존중한다. 초과분은 보존·미배치/선택 제한으로 안내하며 자르지 않는다.
7. 저장/내보내기에는 새 배치 메타데이터가 포함되는지 확인한다. 기존 백업 체계의 전체 재구축은 하지 않는다.

공개 선반의 제거·가림·권리 철회가 home reader에도 적용되어야 한다. 제목/표지 revision이 바뀌면 기존 preview/hash/policy 재검토 경계를 유지한다. 공유 구조 변경으로 공개 상태를 자동 부활시키지 않는다.

## 8. 마일스톤 — 기존 W 안의 고정 체크포인트

새 M단계가 아니라 기존 실행 계획에 넣을 수용 체크포인트다. 한 번에 하나의 사용자 결과를 닫는다.

| 완료할 결과 | 기존 W | 종료선 |
|---|---|---|
| 한 컬렉션에 두 종류가 보임 | W18, W06 영향 | 작품 선반1개·기존 이미지 보드1개가 같은 문맥에서 읽기/편집/저장/재진입됨 |
| 같은 컬렉션을 안전하게 공개함 | W07·W09·W10·W11 | Memory0인 작품 포함, 명시 공개, public DTO, 같은 homeId, 철회 |
| 기존 링크와 사회 기능이 이어짐 | W12·W13·W14 영향 | 기존 링크→올바른 묶음/작성자→follow/재방문/신고·가림/복원 |
| 실제 작업 레이아웃이 완성됨 | W18 | 읽기·선택·공개 설정을 다른 폭/위계로 구성, desktop/phone 대표 장면 검토 |
| 수정된 후보를 검증·인수함 | W19·W20 | 관련 자동검사/실환경 근거·운영 승인·정확 후보 일치 |

**첫 실행은 많은 관리 도구가 아니라, 작품 선반1개와 기존 이미지 보드1개를 같이 보여주는 실제 화면이다.** 이를 확인한 뒤 공개 계약을 연결한다. DB만 오랫동안 만들거나 전역 CSS만 계속 손보지 않는다.

## 9. 테스트와 검증

각 검사는 변경된 계약에만 추가한다. 기존 passed 테스트를 단순 삭제하거나 기대값만 편하게 바꾸지 않는다. 아래는 수용 조건이며 아직 PASS가 아니다.

| 대표 과업 | 합격 조건 | 기존 Q/W |
|---|---|---|
| 첫 화면/두 종류 | 같은 owner의 작품 선반과 Memory 보드를 혼동하지 않고 생성·선택·편집. 이동으로 원본 복제0 | Q24 / W18 |
| 기존 미니홈 편집 재진입 | 이전 소개·선택·순서 복원. 늦은 load가 입력 덮어쓰기0. 동의 자동체크0 | Q02·Q15 / W11·W18 |
| Memory 없는 작품 공개 | 표지·제목을 공개하되 Memory 생성/가짜 ID0. 공개하지 않은 rating/note/count0 | Q08·Q15 / W07·W11 |
| 현재 source가 바뀐 공개 미리보기 | owner/source/version/선택/권리/정책 불일치 시 재확인. 기존 공개본을 임의 변경하지 않음 | Q11 / W09·W10 |
| 계정 A→B·익명 | A의 private 배열/preview/소개 draft·숨긴 묶음 이름이 B/익명에 남지 않음 | Q05·Q07 / W06·W19 |
| membership/배치/철회 분리 | 배치 제외가 원본 삭제 아님. home 제외와 독립 board 링크의 차이를 정확히 표시 | Q12·Q14 / W10·W11 |
| 카드 전체 비공개/권리 철회 | 기존 및 새 컬렉션 위치·이미지 URL에서 같은 철회 적용 | Q09·Q13·Q14 / W08·W10 |
| 기존 간편공유 1카드 보드 | 자동 선반 도배/자동 삭제0. 명시 전시된 과거 항목은 유지 | Q15·Q24 / W11·W18 |
| follow/신고/관리 | homeId 유지. 동일 대상 follow/해제·재방문, title shelf 포함 가림/복원/통지 유지 | Q16~Q18 / W12~W14 |
| 구URL·모바일 복귀 | `/boards/?id`, `/minihome/#following`, public links가 의도한 기존 자료에 도달. 루프/외부 return0 | Q04·Q16 / W13·W18 |
| 실패·취소·중복 | draft 유지, 같은 operation replay, 불명확한 게시를 취소 완료로 위장하지 않음 | Q02·Q03·Q10·Q11 / W09·W18 |
| 저장/백업/구버전 | 기존 records/IDs 보존, 새 layout roundtrip, 구client의 unknown type 삭제 거절 | Q20·Q23 / W06·W17·W20 |

계약 단위 확인 출발점:

```bash
node --test tests/unit/minihome.test.mjs tests/unit/memoryBoard.test.mjs
```

기존 `tests/publication-ui.spec.ts`, `tests/memory-board.spec.ts`, `tests/title-collection.spec.ts`, `tests/arena-refinement.spec.ts` 및 필요한 새 케이스를 사용한다. 전체 runnable checkout의 `package.json`과 기존 실행기를 확인하고 실행한다. 검토 ZIP을 npm build 가능한 전체 저장소로 취급하지 않는다.

### 시각 검수

최소 대표 장면은 소유자 작품 선반, 소유자 이미지 보드, 공개 선택, 방문자 컬렉션, 긴 제목/많은 항목/부분 실패다. 같은 합성 자료로 1440px PC와 390px phone을 비교하고 320px 넘침도 확인한다. 이 폭은 검수 출발점이지 사용자 테스트를 대신하는 표준이 아니다.

- 갤러리의 넓은 폭과 입력폼 폭이 분리되어 있는가?
- 선택할 카드가 내용·선택표시·준비상태와 가까이 묶여 있는가?
- 첫 방문자가 현재 작업/다음 행동/공개 결과를 설명할 수 있는가?
- 제목 입력을 위해 과도한 빈 폭을 제공하거나 전폭 CTA를 불필요하게 만들지 않았는가?
- 공개 설정을 여는 순간에만 설정이 나타나며, 읽기 화면을 긴 form이 밀어내지 않는가?
- 모바일 키보드·뒤로가기·sticky 동작이 콘텐츠와 CTA를 가리지 않는가?

자동 검사의 no-overflow·button count·bounding box PASS와 사람의 구성/가독성 확인을 따로 기록한다. 이미지가 아름답다고 권한 검사를 생략하지 않고, 권한 검사가 많다고 레이아웃을 승인하지 않는다.

## 10. 보안·개인정보·권리 영향

- source ownership과 public projection 경계 유지. frontend 숨김은 보안 수단이 아니다.
- 선반 공개 기본안은 작품명·표지만이며, private Memory 팬/평점/감상을 조용히 전달하지 않는다.
- 독립적인 공유 링크와 home 전시 위치의 공개 범위를 사용자에게 알린다.
- 새 공개 유형에도 기존 권리·가림·차단·철회 정책을 적용한다. 정책 자체의 국가/연령 확대는 이번 범위 밖이다.
- 관리자 검토에서 무엇을 가리는지 대상이 명확해야 한다. 운영자에 일반 private 데이터 열람 권한을 추가하지 않는다.
- 미리보기·follow·신고·공개 ID는 기존 ID로 유지하고 ID 문자열을 권한 증명으로 취급하지 않는다.

## 11. 관찰 가능성·분석 이벤트

이미 있는 오류·작업 계측을 재사용한다. 필요 시 sectionKind, editor/review/visitor mode, 성공/실패 코드, 공개 revision만 기록한다. 개인 보드 이름·감상·선반 전체 keys·이미지 URL·토큰을 로그에 추가하지 않는다.

보고는 구현/합성 테스트/실환경 검증/시각 수용을 분리한다. 과거 운영 공개 인수는 그 exact 후보의 재사용 근거다. 이번 새 title shelf 공개가 통과했다는 증거로 대신하지 않는다.

## 12. 롤백·복구

- 초기에 기존 경로를 유지하고 새 shell을 검증한 뒤 일반 진입을 전환한다.
- 새 layout reader 실패 시 명확한 오류와 기존 읽기 경로를 제공하되 빈 저장으로 덮어쓰지 않는다.
- 신규 typed 공개물이 존재한 뒤 v1-only writer로 롤백하면 내용 유실 가능성이 있다. 해당 writer를 차단하고 이전 reader의 안전한 범위 또는 공개 일시중지 경로를 문서화한다.
- 원본 shelf/board/card와 ID를 복사·삭제하지 않는 additive 접근을 사용한다. 다운 migration으로 새 public 데이터 전부를 삭제하지 않는다.
- 신규 공개 타입만 일시중지하더라도 기존 사용자의 private 기록과 기존 안전한 공개 이미지 계약은 가능한 범위에서 유지한다.
- 최신 공개 철회·제재 이력을 복구 전에 반영한다. 예전 snapshot 복구로 숨긴 콘텐츠를 되살리지 않는다.
- 이번 UI 변경 때문에 전체99테이블/전체 카탈로그 복구 리허설을 반복하지 않는다. 새 배치/typed 공개 데이터의 roundtrip과 영향 범위만 추가한다.

## 13. 위험과 완화

| 위험 | 최소 대응 |
|---|---|
| ‘그냥 화면만 합치면 된다’고 오판 | title shelf public은 신규 계약임을 명시, 가짜 Memory 우회 금지 |
| 통합을 이유로 모든 UI/DB 재작성 | 기존 controllers/IDs 유지, 두 타입·한 깊이에 제한 |
| 같은 전시를 두 번 편집 | private 구성은 같은 source 참조, 공개 선택만 별도 관리 |
| 사진/감상 자동 노출 | server public allowlist, preview, 명시 publish와 read 필터 |
| 기존 공개·follow 링크 단절 | 기존 homeId/publicationId 유지·호환 링크 테스트 |
| 시각 확인이 또 미뤄짐 | 실제 두 묶음이 보이는 화면을 먼저 닫고 단계 확대 |
| 추가 발견으로 끝없는 테스트 | 새 실패 또는 계약 변경이 있는 경계만 검사. 같은 기반의 무의미한 재실행 금지 |

## 14. 필요한 사용자 결정

이미 설명한 컬렉션=미니홈 관계는 다시 묻지 않는다. 이름은 컬렉션 유지, 공개 전시 적용은 명시적, 첫 공개 작품 선반은 제목/표지만이라는 **권장 기본안**을 제출한다. 다른 의미가 필요한 항목만 이유/영향과 함께 묻는다.

특히 ‘저장하면 public도 즉시 갱신’이나 ‘상태·평점·모든 이미지 자동 공개’는 사용자가 요구하지 않았다. 편의를 이유로 이 안을 기본값으로 적용하지 않는다.

D03은 기존 예산·한도 유지, D04는 새 제목/표지 공개 선택의 정확한 범위만, D05는 새 layout 데이터의 사본 포함만, D06은 실제 후보 DB/배포 승인만 연결한다. 다른 운영 계약을 다시 조사하는 선행 작업은 추가하지 않는다.

## 15. 진행 기록

실제 실행은 기존 workboard 현재 카드에 다음 형식으로 기록한다.

```text
현재 W:
이번에 닫을 사용자 행동:
이번 변경 파일/계약:
재사용한 기존 증거(커밋 포함):
이번에 직접 검증한 것:
시각 확인 결과:
남은 차단 1개 또는 다음 행동 1개:
```

문서에 매번 ‘현재’ 제목을 위로 계속 쌓지 않는다. 최상단 하나를 갱신하고 이전 로그는 역사로 보존한다.

## 16. 발견 사항과 계획 변경

새 발견은 다음 중 하나로만 분류한다.

1. 현재 목표의 작은 결함: 현재 W 안에서 고치고 복귀.
2. 새 공개 타입을 위한 진짜 필수 선행: 같은 W 계층에 둔 범위 제한 작업으로 해결. 하위 계획 속 하위 계획을 만들지 않음.
3. 운영 권한·정확 후보 승인 대기: 해당 작업만 차단하고 관련 없는 기반 구현을 시작하지 않음.
4. 더 있으면 좋은 기능: 기존 보류 목록에 한 줄, 이번 완료 기준에 추가하지 않음.

같은 계약의 완료 증거가 있고 관련 변경도 없으면 새 실험을 만들지 않는다. 전체 정적 경고·프로필 꾸미기·고급 공개 필드까지 이번 출시에 묶지 않는다.

## 17. 완료 보고

완료 판단에는 실제 수정 commit, 이전/새 데이터 보존, 두 타입의 공개·철회, 예전 링크·follow 대상 유지, PC/모바일 대표 장면과 실제 A/B/익명 검증을 포함한다. 스크린샷만 또는 SQL PASS만으로 끝내지 않는다.

새 관계 교정의 acceptance를 끝내면 작업을 닫는다. 모든 MOEMOA 출시 게이트까지 자동 완료로 올리지 않는다. 배포·원격 데이터 변경은 정확한 별도 승인과 실제 결과가 있을 때만 보고한다.

---

## Codex에 복사할 지시문 (향후 구현을 승인한 뒤 사용)

```text
MOEMOA b0541ff 이후 현재 작업 상태를 보존하고 기존 release-v2에서 이어가라.
이번 목표는 ‘컬렉션=미니홈, 작품 선반과 기존 Memory 보드를 그 안의 두 종류로 구성’하는 것이다.

먼저 현재 결정/구조와 이 패키지의 01_REVIEW_AND_TARGET_SPEC, 02_CODEX_EXECUTION_NOTE를 대조해
기존 ExecPlan과 단일 workboard의 현재 W18 및 영향 W07/09/10/11을 갱신하라.
과거 M0부터 재감사하지 말고, 이미 완료된 감상 편집·공개·신고·복구 기반은 재사용하라.

대표 결과는 기존 작품 선반1개+기존 이미지 보드1개가 같은 컬렉션에서 읽기/편집되는 장면이다.
그다음 Memory0인 작품 선반도 가짜 카드 없이 명시 공개하고, 같은 homeId의 방문자 화면에 연결하라.
단순 메뉴 링크 추가·별도 전시 재작성 폼으로 완료하지 말라.

원본 private 데이터와 public projection, 기존 publication/owner/rights/version/hash/withdrawal/한도는 유지하라.
새 typed selection/layout은 작은 additive 계약으로 설계하고 구클라이언트의 누락 저장을 막아라.
기존 homeId/boardId/cardId/shelfId/링크/팔로우/전시 내용은 보존하라.
간편공유용 1카드 보드를 무조건 컬렉션에 넣거나 삭제하지 말라.

현재 제목/소개/공개 선택은 편집 재진입 시 복원하고 미저장 입력/동의를 함부로 덮거나 자동 승인하지 말라.
공개 폼은 읽기 갤러리와 다른 폭/위계로 구성하고 현재 캡처 같은 초광폭 입력·거대한 빈 행·전폭CTA를 교정하라.
PC/모바일 대표 장면을 실제 컴포넌트에서 먼저 확인하고, 한 장면이 수용된 뒤 주변에 확장하라.

이 문서의 기능 보존/수용 표로 변경된 계약만 검사하고, 기존 운영 증거와 이번 새 실행을 구분하라.
새 관계도/챗봇/요금/성인인증/백업플랫폼은 만들지 말라.
원격 DB/공개 범위/배포는 현재 유효한 정확한 승인 없이는 실행하지 말고 필요한 결정만 보고하라.
모든 상태는 기존 03_RELEASE_WORKBOARD.md 하나에 기록하고, 완료 조건을 만족하면 종료하라.
```
