# 자체 ID 카탈로그 지원 결과

> 후속 상태: 사용자의 검토·배포 승인으로 Web 운영 반영 완료. 아래는 구현 당시 기록이며 최신 배포/검토 결과는 [운영 보고서](2026-09-07-source-independent-production.md)를 따른다. DB migration과 226개 추가는 여전히 미실행이다.

## 결과

로컬 구현 완료. AniList ID가 없는 작품도 검색 결과, Title Hub, 작품 저장/해제, 내 작품, Memory 선택에서 처리한다. AniList 외부 이동 버튼 두 개를 제거했다. 출처 원본과 선택적 AniList ID는 보존한다. 운영 DB·웹·APK는 이번 작업에서 변경하지 않았다.

226건은 저장된 canonical과 표지 bytes를 읽어 현재 ServiceProjection/V2를 생성하고 업로드 직전 표지 검증까지 수행했다. **226 PASS, 게시 0건**. 작품/시즌/중복의 개별 승인과 동일한 의미가 아니다. 전체 결과는 저장소 밖 `D:/hong/Web/Anime/source-independent-increment-audit-2026-09-07.json`에 있다.

## 근거와 변경

- 읽은 기준: AGENTS, CODEX_START_HERE, 확정 결정 01, catalog 사양 04, 변경 관리 09, PLANS 및 React Doctor skill. 실제 catalogRepository/catalogConsumer, resolver, Memory domain, Title services/projection, Library/IndexedDB, sync 계약, 검색 UI, cover export/uploader와 SQL을 대조했다.
- 결정: `../decisions/2026-09-07-source-independent-catalog.md`; 계획: `../plans/2026-09-07-source-independent-catalog.md`.
- catalogRepository/resolver: 외부 binding 선택화, UUID collection 조회 추가. Consumer는 자체 ID 후보를 숫자로 변환하지 않는다.
- Memory domain/selector/resolver: sourceBinding 없이 유효 UUID와 PROVIDER_CANDIDATE 상태를 가진 참조 허용. 출처 없음이 SOURCE_REVIEWED로 승격되지 않는다. 서로 다른 UUID 후보가 합쳐지지 않는다.
- Title Hub/collection/projection: 자체 ID 저장과 Memory 표시, 나중에 선택적 binding이 생겼을 때 기존 UUID 저장 행 연결. 기존 AniList 기록 호환.
- titleLibraryRepo: 기존 Library 숫자 키 저장소는 유지하고, 자체 ID 저장만 기존 IndexedDB meta에 `moemoa:catalog-saved-titles:v1`로 추가한다. localStorage는 복구 mirror다. 기존 Library 데이터 재작성/삭제 없음.
- 전역 검색/기존 추가 UI: UUID 검색·저장·Title Hub 이동, 로컬 저장 검색, 숫자 전용 WatchLog 버튼 제한. 신규 작품 표시는 catalog 대표 제목을 보존한다.
- cover exporter: 승인된 ANILIFE provider 지원, source-provider 일치, controlled path, SHA-256, dimensions, MIME 검증 유지. V2 policy version을 변경해 구버전 릴리스와 구분한다.

## 검증

- Node unit suite (`node tests/unit/run-tests.mjs`): 230/230 통과. 두 UUID의 검색→선택→저장→로컬 검색→Memory album 분리 및 binding 추가 호환을 포함한다.
- catalog suite: 247건 중 245 통과, 기존 2개 skip, 실패 0. AniLife 유지와 UNKNOWN provider 거부 검사 포함.
- Chromium: `source-independent-title.spec.ts`, `title-hub.spec.ts`, 4개 통과. 실제 IndexedDB 저장→새로고침→해제→새로고침, 기존 Hub/작성 이동, 320px, 전역 검색. 처음에는 해제 비동기 완료 전에 새로고침해 실패했으며 UI 완료를 기다리도록 테스트를 수정한 뒤 통과했다.
- Node 24 Astro build: 15페이지 성공.
- React Doctor: 72/100, 기존 6개 경고/5개 파일과 동일. 이번 작업이 만든 경고 2개는 수정했다.

## migration과 복구

- 새 SQL `20260907193000_catalog_optional_source_provider.sql`은 catalog_assets provider check를 ANILIST/ANILIFE로 확장한다. **SQL 파일 준비만 완료, DB 실행 및 실제 DB 적용 검증은 미실행**. 운영 적용 때 기존 constraint 확인 후 staging 데이터와 함께 검증해야 한다.
- 검색 DB의 anilist_id는 기존부터 nullable이므로 변경하지 않는다. 사용자 DB migration은 없다.
- 롤백은 이번 코드 변경만 되돌리고 추가 meta/localStorage 저장은 남긴다. 전체 working tree reset 금지. 기존 uncommitted 작업이 많다.
- provider constraint를 되돌릴 때 ANILIFE 행이 존재하면 먼저 이전 릴리스를 활성화하고 데이터 보존 전략을 정한다. 행을 삭제해 강제로 constraint를 복원하지 않는다.

## 보안·권리·남은 범위

사용자 이미지 업로드, Public UGC, 인증 권한, 분석 이벤트를 바꾸지 않았다. AniLife의 2026-09-03 사용자 확인 권리는 source-registry에 이미 기록되어 있다. bytes 검증은 권리/작품 검토를 대신하지 않는다.

자체 ID의 작품 저장 상태는 로컬이다. legacy Library export 및 remote sync에는 새 영역을 포함하지 않는다. 작품 상태 remote sync는 기존 TITLE-STATE-SYNC-01 미정 범위이며, Memory metadata sync와 구분한다. Android는 공유 코드 반영 대상이지만 새 APK/실기기 검증은 이번에 실행하지 않았다.

다음 단계는 226건의 작품/시즌/중복 검토, DB migration 적용 검증, 검증된 릴리스만 운영 반영이다. 현재 운영 수량 3,999개는 이번 작업으로 늘어나지 않는다.
