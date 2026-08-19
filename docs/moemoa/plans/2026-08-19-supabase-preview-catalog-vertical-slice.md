# Supabase Preview 카탈로그 Vertical Slice ExecPlan

> 계획 상태: `SCHEMA READY / REMOTE DATA UPLOAD CREDENTIAL PENDING`
> 승인 근거: 2026-08-19 사용자 요청 — Canonical → Service Projection v2 → DB 변환·검증 → Supabase Preview → Vercel Preview → 검색·상세·카드 작성 검증.

## 1. 목적과 사용자 결과

외부 TEST_ONLY workspace의 3,998개 `CanonicalAnime`에서 서비스에 필요한 검색·상세·인물 read model을 결정론적으로 생성하고 검증한다. 동일한 데이터 계약을 로컬 개발과 Supabase Preview에서 사용하며, Vercel Preview에서 작품 검색, 작품 상세 확인, 기존 LOCAL_ONLY Memory Card 작성을 하나의 흐름으로 시험한다.

## 2. 관련 확정 결정

- `TECH-01`: Astro/React 공용 UI와 adapter 경계를 유지한다.
- `ACCOUNT-01`: 로그인 없이 LOCAL_ONLY 카드를 작성할 수 있고, 로그인은 Preview 인증·향후 동기화에 사용한다.
- `CATALOG-01/02`: canonical provenance는 보존하고 서비스 read model은 별도 파생한다.
- `CARD-01`, `STORAGE-LOCAL-01`: Complete Card의 visual과 로컬 영구 저장 계약을 유지한다.
- `IMAGE-01/02`, `IMAGE-SYNC-01`: 사용자 이미지는 cloud에 업로드하지 않는다. 수집 표지는 2026-08-19 확인된 Preview 허가 범위에서만 별도 bucket에 업로드한다.
- `BACKEND-01`, `AUTH-01`: 이번 선택은 Supabase direct/RLS의 Preview vertical slice로 제한한다. Production 공급자와 guest→account 승격 정책을 최종 확정하지 않는다.

## 3. 현재 상태와 저장소 증거

- `tools/catalog-lab/pipeline/service-projection.mjs`는 제목·링크·readiness 중심 schema v1을 생성하지만 실제 화수·제작사·장르·인물 값을 서비스 DTO에 포함하지 않는다.
- `tools/dev-catalog/read-model.mjs`는 외부 TEST_ONLY projection/cover를 loopback 개발 서버에서만 읽고 production build에는 포함하지 않는다.
- 외부 `MOEMOA_CATALOG_LAB_TEST`에는 full3998 manifest, 3,998 current pointers, canonical records, v1 projections와 표지가 있다.
- `src/lib/supabaseClient.js`와 `src/repositories/authRepo.js`에는 Supabase PKCE/Google OAuth 연결이 있으나 저장소에 재현 가능한 Supabase migration/config는 없다.
- `docs/deploy/supabase-*.sql`은 과거 사용자 sync 테이블을 수동 설치하는 SQL이며 카탈로그 schema와 Preview 배포 절차를 제공하지 않는다.
- `astro.config.mjs`는 정적 Vercel build다. Preview 환경변수는 아직 저장소에서 확인할 수 없다.

## 4. 범위

### 포함

- CanonicalAnime에서 파생하는 Service Projection v2.
- 검색 summary, 한 작품 detail, paginated people, opaque catalog asset metadata의 분리.
- 3,998개 전체를 offline으로 변환하는 exporter와 해시/count/reference 검증.
- Supabase migration: catalog release/anime/title/studio/genre/character/person/casting/relation/asset 테이블, 검색 RPC, read-only RLS.
- 로컬 service-role 전용 idempotent Preview uploader와 `--dry-run` 기본값.
- Supabase catalog adapter와 기존 DEV/local/AniList fallback 경계.
- catalog detail 화면과 기존 Memory Card 작성 진입 연결.
- Vercel Preview용 공개 환경변수 계약과 실제 브라우저 E2E 체크리스트.

### 제외

- AniList/AniLife/Wikidata 재수집.
- raw, normalized, claim, canonical 원본의 cloud upload.
- Production 표지 배포. 이번 작업은 사용자가 확인한 Supabase Preview 저장·표시 범위로만 제한한다.
- 사용자 LOCAL_ONLY 이미지 자동 업로드 또는 PRIVATE_CLOUD/Public 활성화.
- Production Supabase cutover, master production 배포, Public UGC.
- guest→account 데이터 승격 및 sync conflict 정책의 최종 확정.

## 5. 아키텍처·데이터 흐름

```text
external TEST_ONLY canonical/current/manifest
→ offline Projection v2 builder
→ service-projections-v2/{search,details,people,assets}
→ release manifest + aggregate hash/count/reference validator
→ deterministic DB row bundles
→ local service-role uploader (dry-run default)
→ Supabase Preview Postgres
→ public read-only RLS + bounded search/detail/people queries
→ Supabase catalog adapter
→ Astro/React Web
→ existing LOCAL_ONLY Memory Card repository
```

Search 응답은 최대 12개 summary만, detail은 한 작품만, people은 30개 단위로 전송한다. 브라우저는 canonical hash, localRef, source URL, service-role key를 받지 않는다.

## 6. 변경 파일 지도

- `tools/catalog-lab/pipeline/service-projection-v2.mjs`: v2 pure projection builders와 validators.
- `tools/catalog-lab/pipeline/service-export-v2.mjs`: 외부 workspace offline export와 release manifest.
- `tools/catalog-preview/*`: DB row bundle 생성·검증·Supabase REST uploader.
- `supabase/config.toml`, `supabase/migrations/*`: 재현 가능한 Preview schema/RLS/RPC.
- `src/features/memory/adapters/catalog/supabaseCatalogTitleResolver.js`: production-safe catalog search adapter.
- `src/features/catalog/*`, `src/pages/catalog/*`: detail/people read UI.
- `src/features/memory/runtime/platformTitleResolver.js`: Supabase configured 시 새 adapter 사용, 실패 시 기존 provider/PrivateTitle 경로 유지.
- `tests/catalog-lab/*`, `tests/unit/*`, `tests/e2e/*`: projection, export, uploader, RLS contract, UI flow 회귀.
- `package.json`, `.gitignore`, deployment docs: 명령·secret boundary·Preview 절차.

실제 파일 지도는 구현 중 현재 구조와 최소 변경 원칙에 맞춰 갱신한다.

## 7. 데이터·스키마 마이그레이션

- 새 catalog schema는 기존 user sync 테이블을 수정하거나 삭제하지 않는다.
- 모든 catalog row는 `release_id`를 갖는다. 새 release를 먼저 적재·검증한 뒤 단일 active release pointer만 전환한다.
- uploader는 같은 release hash 재실행 시 중복을 만들지 않는다.
- 실패 시 미활성 release를 삭제할 수 있고 기존 active release는 유지한다.
- 실데이터 upload 전 count/hash/reference 검증과 dry-run을 통과해야 한다.

## 8. 마일스톤

1. v2 계약 테스트를 RED로 만들고 search/detail/people/asset projection을 구현한다.
2. full3998 offline export와 aggregate validator를 구현하고 실제 3,998개에서 검증한다.
3. Supabase migration/RLS/search RPC와 service-role uploader를 구현한다.
4. Supabase catalog adapter, detail UI, card composer 진입을 연결한다.
5. unit/catalog/build/guard/react-doctor/E2E를 통과한다.
6. 별도 Supabase Preview project가 제공되면 migration apply, metadata+cover upload, count/hash 검증을 수행한다.
7. Vercel Preview 환경변수를 연결하고 실제 URL smoke/E2E를 수행한다.

## 9. 테스트와 검증

- v2 projection: exact schema, deterministic hashes, bounded arrays, target/canonical/current binding.
- export: 3,998 targets/search/detail, people pagination completeness, 모든 reference 무결성, aggregate release hash.
- DB bundle: primary/foreign key uniqueness, no raw/localRef/source URL, deterministic rerun.
- uploader: dry-run 기본, explicit `--allow-upload`, Preview project allowlist, batch retry/idempotency, secret redaction.
- RLS contract: anon/authenticated는 catalog SELECT/RPC만 가능하고 mutation은 불가.
- UI: 검색 최대 12개, 한 작품 detail, people pagination, 실패 fallback, PRIVATE/LOCAL_ONLY 카드 작성.
- `npm run catalog:test`, `npm run test:unit`, `npm run build`, `npm run catalog:guard`, relevant Playwright E2E, `npx react-doctor@latest --verbose --diff`, `git diff --check`.

## 10. 보안·개인정보·권리 영향

- browser에는 `PUBLIC_SUPABASE_URL`과 publishable/anon key만 둔다. service-role key는 로컬 uploader 환경변수에서만 사용하고 로그·Git·Vercel client bundle에 넣지 않는다.
- catalog RLS는 공개 read-only이며 mutation policy를 만들지 않는다.
- 사용자 카드 note, 이미지, 검색 원문은 ordinary analytics/log에 넣지 않는다.
- 수집 표지는 사용자 확인에 따라 Preview bucket에 checksum 기반 immutable object로 올린다. 이 결정은 Production 배포 허가가 아니다.
- 실데이터 metadata도 출처별 cloud 저장/재배포 권한이 확인되기 전에는 실제 remote upload gate를 통과하지 않는다.

## 11. 관찰 가능성·분석 이벤트

- 허용: query length bucket, result count, latency, error code, release id, detail/people request success.
- 금지: 자유 검색어 원문, canonical/raw payload, absolute path, service key, 사용자 note/image.
- uploader report에는 row count, aggregate hash, elapsed time, classified error만 기록한다.

## 12. 롤백·복구

- Web: Supabase catalog flag/env를 제거하면 기존 DEV local projection + AniList/PrivateTitle fallback으로 복귀한다.
- DB: active release pointer를 이전 release로 되돌린 뒤 실패 release를 삭제한다.
- migration은 기존 user tables를 변경하지 않으므로 catalog schema drop은 별도 승인 없이는 실행하지 않는다.
- 외부 TEST_ONLY workspace와 LOCAL_ONLY Memory DB는 exporter/uploader가 수정하지 않는다.

## 13. 위험과 완화

- 권리 범위 초과: metadata와 image upload를 별도 gate로 분리하고 remote uploader는 권한 metadata 없으면 fail closed.
- 한국어 부분검색 품질: title table + normalized searchable text + trigram index/RPC를 사용하고 실제 query set으로 검증한다.
- 사람 데이터 payload 과다: summary/detail과 people pages를 분리한다.
- partial upload 노출: immutable release 적재 후 active pointer 전환.
- Preview/Production 혼동: project ref allowlist와 `MOEMOA_SUPABASE_ENV=preview`를 함께 요구한다.
- 기존 sync schema drift: 새 catalog migration은 additive-only이고 user table과 이름을 분리한다.

## 14. 필요한 사용자 결정

- 이미 승인됨: Supabase Preview를 사용한 이번 vertical slice 진행.
- 외부 실행 전 필요: 별도 Supabase Preview project ref/URL/publishable key/service-role key와 Vercel Preview project 접근.
- 별도 게이트: AniList 기반 metadata와 표지를 cloud에 저장·재배포할 권한. 확인 전 remote에는 synthetic/허용 데이터만 사용한다.
- Production backend/auth provider 확정은 이번 Preview 결과 후 결정한다.

## 15. 진행 기록

```text
[2026-08-19] 시작: 사용자 요청으로 Supabase Preview catalog vertical slice 범위 확정.
[2026-08-19] 확인: 기존 Supabase PKCE/Google login과 split sync code는 있으나 repository-managed Supabase migration/config와 catalog schema는 없음.
[2026-08-19] 결정: 기존 LOCAL_ONLY 카드 작성은 유지하고, catalog metadata read + 표지만 Preview Supabase에 연결. 사용자 이미지는 upload 제외.
[2026-08-19] RED→GREEN: Service Projection v2 module 부재를 확인한 뒤 search/detail/people/system-design asset 분리 계약 4개를 구현하고 통과.
[2026-08-19] 실데이터 export: full3998 전체를 immutable release `catalog-v2-52487fc3ef22eb9df3ca0a78`로 생성. 3,998 targets, 4,899 people pages, 20,893 files, 약 128.75 MiB.
[2026-08-19] 실데이터 validate: 모든 canonical/v1 identity, row hash, bundle hash, DB row equivalence, count/reference를 재검증. release hash `52487fc3ef22eb9df3ca0a78d6e3b0b43cfdebaf7395f78f9110af4f3be4f556`.
[2026-08-19] Supabase: additive migration, read-only active-release RLS, bounded trigram search RPC, service-role-only activation, dry-run-default uploader 구현.
[2026-08-19] Web: Supabase search adapter, 작품 상세, people pagination, detail→LOCAL_ONLY card title prefill 연결. Supabase 미설정/실패 시 기존 resolver 경로 유지.
[2026-08-19] 검증: focused 12/12, unit 95/95, catalog 190 pass/1 Windows skip, build 성공, system-design card E2E 1/1, React Doctor changed 100/100, 외부 과거 test-results를 보존한 임시 격리 상태에서 catalog guard no leaks.
[2026-08-19] 해소: 사용자가 AniList metadata와 표지의 cloud Preview 저장·표시 허가를 확인함. Newrred 조직의 Singapore `moemoa-preview` 프로젝트를 생성하고 migration을 적용함.
[2026-08-19] 발견: Vercel의 기존 인증용 `PUBLIC_SUPABASE_*`가 빌드 환경에서 `.env.production`보다 우선되어 Preview 검색이 과거 프로젝트로 향함. 인증 연결은 유지하고 카탈로그를 `PUBLIC_CATALOG_SUPABASE_*` 전용 client로 분리함.
```

## 16. 발견 사항과 계획 변경

- `BACKEND-01/AUTH-01`은 Production 기준 미정이므로 이번 Supabase 선택은 Preview adapter로 격리한다.
- v1 `ServiceProjection`의 policy 이름에는 V2 문자열이 있으나 schemaVersion은 1이고 상세 값이 없다. 혼동을 피하기 위해 새 schemaVersion 2 계약을 별도 모듈·폴더로 만든다.
- 표지 권리 게이트 해소 후 3,998개 모두 `COVER_IMAGE` asset으로 재생성했다. 원본 localRef는 내보내지 않고 checksum·크기·MIME·서비스 object path만 Projection v2에 포함한다.
- Supabase Preview 프로젝트 `okchpyagfucpzpyrfgol`에 schema/RLS/bucket을 적용했다. service-role secret은 대화·Git·Vercel client env에 넣지 않는다.

## 17. 완료 보고

표지 포함 full3998 변환·검증과 Supabase schema 적용은 완료됐다. 원격 완료 조건은 service-role 로컬 주입 후 upload/activate, Vercel Preview env 연결, 실제 URL의 검색·상세·LOCAL_ONLY 카드 E2E다.
