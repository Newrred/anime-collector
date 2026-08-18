# 개발용 수집 카탈로그 Read Model ExecPlan

> **계획 상태: `COMPLETED`**
> 승인일: 2026-08-18
> 실행 범위: 개발 서버의 읽기 전용 TEST_ONLY 카탈로그 연결. production build·배포·카탈로그 승격은 포함하지 않는다.

## 1. 목적과 사용자 결과

현재 수집 중인 외부 TEST_ONLY workspace의 완성된 `ServiceProjection`을 Web 개발 화면의 작품 검색에서 바로 사용할 수 있게 한다. 수집이 진행되면서 새 projection이 생기면 개발 서버를 재빌드하지 않고 짧은 캐시 주기 뒤 검색 결과에 반영한다.

## 2. 관련 확정 결정

- `TECH-01`: Astro/React 공용 UI와 adapter 경계를 유지한다.
- `CATALOG-01/02`: 자체 정규화 결과와 provenance를 유지하고 없는 작품은 PrivateTitle로 계속 진행한다.
- `FULL3998-BATCH-CODE-01`: 수집 결과는 외부 TEST_ONLY workspace에만 둔다.
- `UI-SEQUENCE-01`: Web 내부 테스트 surface에서 공용 Memory UI를 먼저 검증한다.
- `06`의 Catalog provider 격리와 승인된 Web fake adapter production 비노출 원칙을 따른다.

## 3. 현재 상태와 저장소 증거

- `src/features/memory/runtime/platformTitleResolver.js`는 `aliases.json`과 브라우저 AniList 검색을 결합한다.
- `tools/catalog-lab/pipeline/service-projection.mjs`는 서비스 표시용 제목·검색 별칭·readiness와 canonical/projection hash를 생성한다.
- 외부 workspace에는 `manifests/full3998.json`, `service-projections/*.json`, `covers/*.json`, `images/covers/*`가 있고 수집 중 원자적으로 갱신된다.
- `astro.config.mjs`는 React integration만 가진 정적 build이며 개발 filesystem bridge는 없다.

## 4. 범위

### 포함

- `MOEMOA_CATALOG_LAB_DIR`로 지정한 branded TEST_ONLY workspace의 읽기 전용 개발 adapter.
- 완성된 projection의 hash·identity·schema를 검증한 bounded in-memory 검색 index.
- 개발 서버 same-origin 검색 endpoint와 검증된 cover preview endpoint.
- 수집 진행분을 다시 읽는 짧은 TTL cache.
- 기존 local legacy resolver와 결합하고 endpoint 불가 시 기존 AniList adapter fallback.
- production build에서 endpoint·외부 파일·테스트 표지가 포함되지 않는 검증.

### 제외

- raw/normalized/claim 파일의 브라우저 노출.
- 외부 workspace 쓰기·삭제·수집 프로세스 제어.
- production catalog import, DB migration, cloud upload, Git/Vercel/APK 데이터 포함.
- 카탈로그 schema 또는 `ServiceProjection` schema 변경.
- TEST_ONLY 표지를 사용자 `VisualAsset`으로 저장하거나 Public에 게시.

## 5. 아키텍처·데이터 흐름

```text
MOEMOA_CATALOG_LAB_DIR (read-only)
→ TEST_ONLY sentinel + full3998 manifest 검증
→ 완성된 ServiceProjection hash/identity 검증
→ bounded CatalogReadModel v1 index
→ loopback DEV middleware /__moemoa-dev/catalog/search
→ DEV catalog TitleResolver adapter
→ 기존 legacy resolver와 ID 기반 병합
→ MemoryTitleSelector

검증된 cover observation + bounded image bytes
→ loopback DEV middleware /__moemoa-dev/catalog/cover/:anilistId
→ 검색 후보의 개발 preview URL
```

브라우저 DTO에는 제목, 별칭, numeric AniList binding, readiness, 상대 preview URL만 허용한다. raw payload, source URL, official URL, localRef, checksum, 내부 절대 경로는 내보내지 않는다.

## 6. 변경 파일 지도

- `astro.config.mjs`: DEV 전용 integration 등록.
- `tools/dev-catalog/read-model.mjs`: 외부 projection/cover의 검증·검색·읽기.
- `tools/dev-catalog/astro-integration.mjs`: loopback-only DEV middleware.
- `src/features/memory/adapters/catalog/devCatalogTitleResolver.js`: browser DTO 검증과 fallback adapter.
- `src/features/memory/runtime/platformTitleResolver.js`: DEV일 때 로컬 수집 카탈로그 우선 사용.
- `tests/catalog-lab/dev-read-model.test.mjs`: hash/identity/path/refresh/cover 경계.
- `tests/unit/titleResolvers.test.mjs`: DEV adapter 성공·fallback·DTO redaction.
- `tests/catalog-lab/run-tests.mjs` 또는 자동 discovery 경로: 신규 테스트 포함 확인.
- `docs/moemoa/04_CATALOG_DATA_AND_INGESTION_SPEC.md`, `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`, 본 ExecPlan: 경계·증거 기록.

## 7. 데이터·스키마 마이그레이션

DB와 외부 수집 schema migration은 없다. 기존 `moemoa-memory-v1`, full3998 manifest, projection, cover 파일을 변경하지 않는다. 개발 index는 메모리에만 존재한다.

## 8. 마일스톤

1. Pure read model과 browser adapter의 실패 회귀를 먼저 추가한다.
2. branded workspace·projection integrity·safe cover 경계를 구현한다.
3. Astro DEV middleware와 TitleResolver composition을 연결한다.
4. active workspace의 현재 projection으로 검색 smoke를 수행한다.
5. unit/catalog/build/guard와 production artifact 비노출을 검증한다.

## 9. 테스트와 검증

- 유효 projection만 검색 후보가 되고 변조 hash·wrong target은 격리된다.
- 검색어는 길이 제한·정규화를 거치며 로그에 남지 않는다.
- endpoint 응답에 `rawPayloadRef`, source/local URL, localRef, checksum, 절대 경로가 없다.
- cover는 STORED observation, controlled relative ref, byte size, SHA-256, MIME signature와 dimensions가 모두 맞아야 제공된다.
- loopback이 아닌 요청과 GET 이외 method는 거부한다.
- endpoint 불가 시 기존 legacy/AniList 경로가 유지된다.
- `npm run test:unit`, `npm run catalog:test`, `npm run build`, `npm run catalog:guard`, `git diff --check`.
- production `dist`에 TEST_ONLY data/image와 DEV endpoint client가 포함되지 않는다.

## 10. 보안·개인정보·권리 영향

- 개발 서버의 loopback 요청만 허용하고 CORS를 열지 않는다.
- 절대 workspace 경로와 사용자 검색어를 응답 오류·로그에 기록하지 않는다.
- 표지는 로컬 개발 preview로만 스트리밍하며 복사·생성물·배포 artifact로 만들지 않는다.
- 외부 workspace는 읽기 전용으로 사용하고 mutation API를 호출하지 않는다.
- TEST_ONLY, production promotion 금지, redistribution 금지 상태는 유지한다.

## 11. 관찰 가능성·분석 이벤트

- 개발 서버 시작 시 경로가 아닌 `enabled/disabled`와 indexed projection 수만 기록할 수 있다.
- 검색어, 제목, source URL, localRef, hash는 로그·analytics에 남기지 않는다.
- endpoint 응답에는 현재 index item count와 캐시 timestamp를 포함하지 않아 수집 진행 상세 노출을 최소화한다.

## 12. 롤백·복구

- integration과 DEV resolver commit을 revert하면 기존 legacy+AniList resolver로 돌아간다.
- 외부 workspace와 IndexedDB에는 변경이 없어 데이터 rollback은 없다.
- DEV endpoint 실패는 UI를 막지 않고 기존 resolver/PrivateTitle fallback으로 복구한다.

## 13. 위험과 완화

- 수집 중 파일 동시 변경: atomic publication 파일만 읽고 invalid/partial artifact는 해당 refresh에서 제외한다.
- 3,998개 반복 scan 비용: 짧은 TTL과 projection 파일명/mtime cache를 사용한다.
- 로컬 개발 서버 LAN 노출: socket과 Host를 loopback으로 제한한다.
- TEST_ONLY 데이터 배포 혼입: build hook을 만들지 않고 production dist/guard 검증을 완료 조건으로 둔다.
- schema drift: schemaVersion/policyVersion/hash와 DTO allowlist를 fail-closed 검증한다.

## 14. 필요한 사용자 결정

- 2026-08-18 사용자 승인: 개발 중 현재 수집 workspace의 데이터를 테스트 데이터로 읽는다.
- production 사용·재배포·공개 표지 사용은 이번 승인에 포함되지 않으며 별도 gate다.

## 15. 진행 기록

```text
[2026-08-18] 승인: 수집 중인 외부 TEST_ONLY 데이터 경로를 개발 테스트 데이터로 사용.
[2026-08-18] 격리: active collection worktree는 유지하고 77f9e35 기반 별도 codex/web-catalog-dev-data worktree 생성.
[2026-08-18] 조사: full3998 manifest 3,998개와 증가 중인 ServiceProjection을 확인. 외부 workspace에는 쓰지 않음.
[2026-08-18] RED: read model·Astro middleware·browser adapter module 부재로 focused 0/2 실패를 확인.
[2026-08-18] GREEN: projection hash/identity, mtime cache, safe cover path/bytes, loopback endpoint, strict browser DTO와 resolver fallback을 구현. focused 9/9 통과.
[2026-08-18] 실데이터 발견/수정: 실제 cover ref가 `images/covers/<anime path key>/<checksum>.<ext>` 구조임을 smoke에서 확인. 해당 구조를 먼저 회귀 실패로 고정한 뒤 exact target 폴더 binding으로 수정.
[2026-08-18] 실데이터 smoke: 확인 시점 909개 완성 projection 중 exact 검색 성공, cover preview advertised/readable, JPEG/PNG/WebP allowlist 확인. 실제 Astro endpoint search 200, cover 200, no-store 확인.
[2026-08-18] 최종 검증: catalog 186 pass/1 Windows skip, unit 93/93, production build 성공, catalog guard no leaks, production dist DEV marker 0건.
```

## 16. 발견 사항과 계획 변경

- `ServiceProjection`은 제목·검색 별칭·readiness를 안전하게 제공하지만 canonical의 모든 서비스 필드 값을 복제하지 않는다. 이번 slice는 schema를 바꾸지 않고 작품 검색과 cover preview에 필요한 최소 DTO만 만든다.
- 현재 Memory `AnimeRef`는 provider cover를 영구 저장하지 않는다. DEV preview URL은 선택 후보 표시용이며 Card/VisualAsset 저장 입력에서 제외한다.

## 17. 완료 보고

상태: `COMPLETED`

- 사용자 결과: 수집과 Web 개발을 병행할 수 있다. 수집이 끝난 항목은 개발 서버 재빌드 없이 최대 TTL 뒤 작품 검색에 나타난다.
- 실행: repository root에서 `MOEMOA_CATALOG_LAB_DIR`를 외부 수집 폴더로 지정하고 `npm.cmd run dev`를 실행한다.
- 변경하지 않은 것: 수집 workspace, manifest/projection/cover schema, IndexedDB, dependency, production catalog, Card/VisualAsset 저장 계약.
- 알려진 제한: `ServiceProjection`이 아직 서비스 필드 값을 모두 싣지 않으므로 이 slice의 UI 사용 범위는 제목·별칭·readiness·개발용 cover preview다. 장르·제작사·성우 등 상세 표시 read model은 후속 UI 요구가 확정될 때 별도 projection 계약으로 추가한다.
