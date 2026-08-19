# Web Catalog Consumer Unification ExecPlan

## 1. 목적과 사용자 결과

Supabase Preview의 확정된 Service Projection v2를 카드 작성뿐 아니라 기존 Library 검색의 우선 공급자로 사용한다. 사용자는 개발용 출처 배지와 중복 Legacy 후보 대신 하나의 정리된 작품 결과를 보고, 상세 화면에서 카드를 만들 때 정확한 `AnimeRef`가 저장된다.

## 2. 관련 확정 결정

- `PRODUCT-01`: 일반 트래커가 아니라 Memory Card 진입을 위한 작품 선택 기반이다.
- `CATALOG-01/02`: 자체 내부 ID·정규화 필드·명시적 provenance를 유지한다.
- `LEGACY-01`: 기존 aliases는 삭제·승격하지 않고 검증되지 않은 fallback으로만 보존한다.
- `CARD-01`, `ACCOUNT-01`: 로그인 없이 Anime/PrivateTitle + LOCAL_ONLY visual로 Complete Card를 저장한다.
- `TECH-01`: 공용 Web UI를 먼저 검증한 뒤 Android shell에 적용한다.

## 3. 현재 상태와 저장소 증거

- `src/features/memory/runtime/platformTitleResolver.js`는 카드 작성에서 Supabase 우선·AniList fallback을 사용한다.
- `src/components/AddAnime.jsx`는 메인/Library 검색에서 AniList·Wikidata를 직접 호출한다.
- `src/features/memory/application/titleResolver.js`는 Supabase 결과가 있어도 일치하지 않는 Legacy 결과를 함께 노출한다.
- `src/features/catalog/CatalogDetail.jsx`는 카드 작성 링크에 제목만 전달해 catalog identity가 유실된다.
- Supabase Preview에는 active release의 search/detail/assets 각 3,998개, people 4,899 pages, cover 3,998개가 검증·적재돼 있다.

## 4. 범위

### 포함

- Supabase catalog를 Library 검색의 우선 공급자로 연결하고 기존 화면 모델로 bounded projection.
- Supabase 결과가 있으면 동일 ID Legacy alias만 병합하고 나머지 Legacy 후보는 숨김.
- 의심스러운 홍보성 대표 제목을 표시 후보에서 제외하고 안전한 alias로 fallback.
- 개발자용 provenance badge를 사용자용 상태 문구로 변경.
- 상세 `animeId`를 검증해 카드 composer에서 정확한 `AnimeRef` 선택 상태 복원.
- 검색 실패·0건·PrivateTitle·AniList fallback 유지.
- 모바일·데스크톱 및 실제 Preview E2E.

### 제외

- Legacy row 삭제·canonical 자동 승격.
- Production/master 배포와 Production 표지 권한 확대.
- 사용자 이미지 cloud upload, 로그인·sync, Board, Public UGC.
- Library 저장 schema의 파괴적 변경.

## 5. 아키텍처·데이터 흐름

```text
Library / Memory composer
→ shared catalog consumer adapters
→ Supabase active Service Projection v2
→ safe UI projection
→ no result / unavailable only: existing AniList or Legacy fallback

Catalog detail animeId
→ bounded detail read
→ verified ANILIST source binding
→ Memory composer selectedTitleChoice
→ createMemoryCardCommand
→ owner-scoped AnimeRef + LOCAL_ONLY Card
```

## 6. 변경 파일 지도

- `src/features/catalog/*`: search/detail safe projection과 Library compatibility adapter.
- `src/features/memory/application/titleResolver.js`: remote 우선 dedupe 정책.
- `src/features/memory/components/*`: 사용자용 결과 문구와 detail deep-link 복원.
- `src/components/search/TopNavGlobalSearch.jsx`, `src/domain/search/quickActionRemote.js`: 실제 메인/Library 공통 검색의 catalog-first 점진적 cutover.
- `tests/unit/*`, `tests/*.spec.ts`: 계약·E2E.
- `CODEX_START_HERE.md`, 기존 ExecPlan/증거 문서: 실제 상태 동기화.

## 7. 데이터·스키마 마이그레이션

DB migration 없음. active release와 기존 IndexedDB schema를 그대로 사용한다. 기존 Library/Legacy record는 읽기·쓰기 형식을 변경하지 않는다.

## 8. 마일스톤

1. RED: remote 결과 시 unmatched Legacy 숨김, 의심 제목 fallback, detail AnimeRef 복원 계약.
2. GREEN: shared safe catalog projection과 composer deep-link 구현.
3. Library catalog-first adapter 연결. 0건/장애 시 기존 검색 fallback 유지.
4. 사용자용 결과 표시와 모바일 레이아웃 보정.
5. unit/catalog/build/guard/React Doctor/Preview E2E.

## 9. 테스트와 검증

- Unit: resolver dedupe, suspicious preferred title, safe detail source binding, Library compatibility projection.
- E2E: 한국어·영문 검색, 상세, cover, people, 상세→AnimeRef card, Archive, fallback.
- Responsive: 390×844와 desktop viewport에서 overflow·가독성.
- Regression: `npm run test:unit`, `npm run catalog:test`, `npm run build`, `npm run catalog:guard`, React Doctor.
- Security: client bundle service-role/secret 0, raw/localRef/checksum 미노출.

## 10. 보안·개인정보·권리 영향

- 브라우저에는 publishable key와 active read model만 둔다. RLS public read 범위는 변경하지 않는다.
- 검색어·note를 analytics/ordinary log에 추가하지 않는다.
- catalog cover는 Preview 표시 전용이며 Memory `VisualAsset`으로 저장하지 않는다.
- Production rights 범위로 확대하지 않는다.

## 11. 관찰 가능성·분석 이벤트

신규 원격 analytics 없음. E2E는 provider 결과 종류, fallback 여부, 오류 코드만 관찰하고 자유 검색어를 기록하지 않는다.

## 12. 롤백·복구

- Library의 catalog-first 호출을 제거하면 기존 AniList 경로가 그대로 복구된다.
- `PUBLIC_CATALOG_SUPABASE_*` 제거 시 composer는 기존 fallback으로 동작한다.
- schema/data rollback은 필요 없다.

## 13. 위험과 완화

- Library legacy UI shape 차이: 별도 compatibility adapter와 기존 callback 계약 테스트.
- Supabase N+1 detail 요청: 최대 8개 bounded 병렬 요청으로 시작하고 실제 latency를 측정; 필요 시 후속 batch RPC.
- 의심 제목 오탐: 강한 홍보성 prefix만 presentation에서 제외하고 canonical 원문은 보존.
- Preview 권한 혼동: feature branch와 전용 env 이름 유지, Production 병합 금지.

## 14. 필요한 사용자 결정

이번 범위는 2026-08-19 사용자 승인으로 진행한다. Production/master 병합과 표지 Production 권한은 별도 승인이다.

## 15. 진행 기록

```text
[2026-08-19] 시작: Supabase Preview catalog 완료 후 Web consumer 통합 승인.
[2026-08-19] 감사: 카드 작성만 Supabase 우선이고 Library는 AniList 직접 호출, detail→card는 title-only임을 확인.
[2026-08-19] 계획: schema 변경 없는 catalog-first compatibility adapter와 exact AnimeRef deep-link를 선택.
[2026-08-19] RED: unmatched Legacy 후보, 홍보성 대표 제목, detail source binding, AnimeRef 변환 계약의 실패를 확인.
[2026-08-19] GREEN: shared title-quality/Library compatibility adapter, catalog-first AddAnime, exact detail deep-link를 구현.
[2026-08-19] 보강: Library detail read를 상위 8개로 강제 제한하고 한 후보의 malformed detail은 정상 후보와 격리했다.
[2026-08-19] Preview 발견: `AddAnime.jsx`는 현재 import되지 않는 구형 컴포넌트이고 실제 상단 검색은 `TopNavGlobalSearch`→`quickActionRemote` 경로임을 확인. 실제 사용 경로로 cutover를 이동하고 catalog/fallback cache를 분리했다.
[2026-08-19] Preview 보강: exact AnimeRef가 선택된 deep-link에서 no-result 안내가 동시에 보이던 조건을 제거했다.
[2026-08-19] Preview 완료: `bfe02bb` immutable deployment에서 Supabase cover URL 기반 `나루토` 8개 결과, 홍보성 제목 부재와 clean alias, detail/people, exact AnimeRef 선택과 Archive 저장을 확인.
[2026-08-19] 반응형 완료: 390×844 메인 검색 sheet와 card composer의 document scroll width가 viewport 이하이며 browser warning/error가 0임을 확인.
[2026-08-19] 로컬 검증: unit 102/102, catalog 191 pass/1 skip, Memory Chromium 11/11, Library Chromium 7 pass/2 live skip, build와 guard 통과.
```

## 16. 발견 사항과 계획 변경

- 첫 Private Slice 문서의 완료 상태가 실제 구현보다 뒤처져 있어 이 slice 완료 시 상태 문서를 함께 동기화한다.

## 17. 완료 보고

상태: `COMPLETED — PREVIEW ONLY`

사용자 결과:

- 메인/Library와 Memory composer가 같은 Supabase active catalog를 우선 사용한다.
- catalog 결과가 있으면 unmatched Legacy 후보를 섞지 않고, 강한 홍보성 대표 제목은 clean alias로 표시한다.
- 작품 상세에서 카드 작성으로 이동해도 내부 `animeId`가 유지되어 PrivateTitle이 아닌 정확한 AnimeRef로 저장된다.
- 한 후보의 malformed detail은 나머지 정상 결과를 제거하지 않으며 상세 읽기는 상위 8개로 제한된다.

실제 변경 범위:

- catalog safe repository/consumer/title-quality projection.
- 실제 `TopNavGlobalSearch`의 `quickActionRemote` catalog-first 경로와 catalog/fallback cache 분리.
- Memory resolver dedupe·사용자용 배지·detail deep-link 복원.
- unit/Chromium 회귀와 기준 문서 갱신.

마이그레이션·의존성: 없음. Supabase schema/RLS/active release와 IndexedDB schema는 변경하지 않았다.

롤백: `a4c263a`, `a3e959e`, `bfe02bb`의 Web consumer 커밋을 revert하면 기존 AniList/Legacy 검색으로 복귀하며 DB rollback은 필요 없다.

다음 승인 게이트: Production/master 병합 및 Production 표지 권한. 이번 완료는 보호된 Vercel Preview에만 해당한다.
