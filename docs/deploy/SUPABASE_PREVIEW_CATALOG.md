# Supabase Preview 카탈로그 배포

이 문서는 Production이 아닌 별도 Supabase Preview 프로젝트에 Service Projection v2 메타데이터와 검증된 AniList 표지를 배포하는 절차다. raw/normalized/claim/canonical 원본과 사용자 이미지는 업로드하지 않는다. 표지 권한 근거는 2026-08-19 사용자가 확인한 Preview 저장·표시 허가이며 Production 권한으로 확대 해석하지 않는다.

## 저장소에서 재현되는 구성

- `supabase/config.toml`: 로컬 Preview 설정.
- `supabase/migrations/20260819000100_catalog_preview_read_model.sql`: additive catalog schema, RLS, 검색 RPC, release activation.
- `npm run catalog:preview:export -- --profile full3998`: 외부 TEST_ONLY canonical에서 immutable v2 release 생성.
- `npm run catalog:preview:validate -- --profile full3998`: 전체 count/hash/reference 재검증.
- `npm run catalog:preview:upload -- --profile full3998`: 기본 dry-run.
- `npm run catalog:preview:upload -- --profile full3998 --allow-upload`: 모든 외부 gate 충족 시에만 실제 적재.

## 필요한 로컬 환경변수

```text
MOEMOA_CATALOG_LAB_DIR=<external TEST_ONLY workspace>
MOEMOA_SUPABASE_ENV=preview
MOEMOA_SUPABASE_URL=https://<preview-project-ref>.supabase.co
MOEMOA_SUPABASE_PREVIEW_PROJECT_REF=<preview-project-ref>
MOEMOA_SUPABASE_SERVICE_ROLE_KEY=<local secret; never PUBLIC_*>
MOEMOA_CATALOG_CLOUD_PERMISSION=approved_metadata_and_covers_preview
```

`MOEMOA_CATALOG_CLOUD_PERMISSION`은 출처별 metadata cloud 저장·Preview 제공 권한을 확인한 뒤에만 설정한다. 현재 AniList 허가는 로컬 TEST_ONLY 저장 범위이므로 권한 확대 확인 전 실제 3,998개 업로드를 실행하지 않는다.

## Supabase migration

공식 CLI workflow를 사용한다.

```text
supabase login
supabase link --project-ref <preview-project-ref>
supabase db push --dry-run
supabase db push
```

`db reset --linked`는 원격 데이터를 삭제하므로 이 프로젝트 절차에서 사용하지 않는다. 기존 사용자 sync 테이블과 새 catalog 테이블은 독립적이다.

## Vercel Preview 환경변수

Preview 범위에만 다음 두 값을 둔다.

```text
PUBLIC_CATALOG_SUPABASE_URL=https://<preview-project-ref>.supabase.co
PUBLIC_CATALOG_SUPABASE_ANON_KEY=<preview publishable/anon key>
```

Service-role key는 Vercel과 브라우저 bundle에 넣지 않는다. 표지는 service-role 로컬 업로더가 `catalog-covers-preview` bucket에 checksum 경로로 올리고, 브라우저는 공개 읽기 URL만 사용한다. 환경변수 변경은 기존 deployment에 소급되지 않으므로 새 Preview deployment를 만든다. Google OAuth를 시험한다면 Supabase Auth redirect allowlist에 Preview callback URL을 추가한다.

## 배포 검증

1. `catalog_releases`의 active release count가 1인지 확인한다.
2. active release의 search/detail/assets count가 각각 3,998인지 확인한다.
3. people page count가 release manifest와 같은지 확인한다.
4. anon key로 SELECT/search RPC는 성공하고 INSERT/UPDATE/DELETE는 거부되는지 확인한다.
5. Vercel Preview에서 한국어·영문 검색, detail, people pagination을 확인한다.
6. 시스템 디자인을 사용해 LOCAL_ONLY 카드를 저장하고 Archive에서 다시 연다.
7. 로그인 전후 카드가 자동 업로드되거나 소실되지 않는지 확인한다.

## 롤백

- Web: Vercel Preview의 두 `PUBLIC_CATALOG_SUPABASE_*` 값을 제거하고 새 deployment를 만든다.
- Catalog: 이전 release를 다시 `activate_catalog_release`로 활성화한다.
- 실패한 STAGING release 삭제는 참조 count와 active pointer를 확인한 뒤 별도 승인 하에 수행한다.
- 외부 TEST_ONLY canonical과 로컬 Memory IndexedDB는 이 배포로 변경되지 않는다.
