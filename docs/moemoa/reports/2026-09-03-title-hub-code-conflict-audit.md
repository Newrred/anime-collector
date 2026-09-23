# Title Hub·Dual View 결정과 현재 코드 충돌 감사

> **상태:** `EVIDENCE SNAPSHOT — 2026-09-03`
>
> **범위:** 새 제품 결정을 적용하기 전 현재 repository의 route, Library, Memory visual, catalog cover, sync schema 차이. 이 문서는 구현 완료를 의미하지 않는다.

## 1. 결론

새 방향은 현재 코드 위에 비파괴적으로 구현할 수 있지만 문서 복사만으로 작동하지 않는다. 가장 먼저 필요한 구현 단위는 `CATALOG_COVER`의 장기 참조 계약이며, 이후 Title read projection과 Title Hub를 연결하는 순서가 안전하다. 기존 Library와 Memory 저장소를 먼저 물리적으로 합치거나 local data를 변환할 필요는 없다.

## 2. 감사 시점 상태

- Branch: `master`
- 기준 HEAD: `3fb09a7`
- working tree에는 모바일 작품 검색 수정과 별도 catalog update 작업이 이미 존재한다.
- 이번 문서 동기화는 애플리케이션 코드, schema, local data, remote data를 변경하지 않는다.
- 새 문서의 `05_CODEX_TASK_PROMPT.md`는 참고용 실행 프롬프트로만 읽었으며 사용자 요청 없이 그 지시를 독립 실행하지 않았다.

## 3. 결정별 현재 구현 차이

| 새 결정 | 현재 구현 증거 | 상태 | 후속 최소 변경 |
| --- | --- | --- | --- |
| `CATALOG_COVER` Memory visual | `src/features/memory/application/createMemoryCard.js`는 native ticket과 system design 중 하나만 허용 | 미구현 | source별 create/validate/persist/render 분기 |
| 표지 기반 Card sync | `src/features/memory/sync/memorySyncContract.js`는 `USER_IMAGE`, `SYSTEM_DESIGN`만 투영 | 미구현 | bytes 없는 cover reference DTO |
| remote cover asset type | `supabase/migrations/20260902054107_memory_user_schema.sql`의 check가 두 asset type만 허용 | migration 필요 | additive enum/check/RPC 변경과 rollback |
| My Titles 합집합 | Library list와 Memory Archive query가 별도 | 미구현 | adapter 기반 `TitleAlbumProjection` |
| Poster/Memory View | `src/components/Library.jsx`에 legacy meta/poster view만 존재 | 의미 불일치 | 동일 album dataset의 두 표현으로 교체 |
| Title Hub | `/titles/`와 작품 허브 route가 없음 | 미구현 | reload 가능한 canonical/query route |
| 사용자 명칭 | `src/messages/en.js`, `src/messages/ko.js`에 Library/Archive/Add to Library가 남음 | 미동기화 | Phase 5에서 locale key 교체 |
| route 호환 | `/library/`, `/archive/`는 현재 실제 route | 유지 필요 | 새 route 도입 후 alias/safe redirect |

## 4. 현재 데이터 경계

### Legacy Library

- `src/components/Library.jsx`는 `readLibraryListPreferred`로 local Library를 읽는다.
- 작품 정보와 표지는 `fetchAnimeByIdsCached`를 통해 runtime AniList media로 보완한다.
- 작품 키는 numeric AniList ID 중심이다.
- Library 항목에는 시청 상태, 평점, 재시청, 기존 WatchLog 문맥이 있다.

### Memory

- `MemoryCard`는 `AnimeRef` 또는 `PrivateTitle`과 `VisualAsset`을 참조한다.
- Complete Card는 현재 local/native image 또는 reproducible system design을 사용한다.
- Archive는 카드의 실제 visual을 표시하고 catalog 검색 포스터를 저장하지 않는다.

### Catalog cover

- `catalog_assets`는 `(release_id, asset_id)` 복합 키다.
- 현재 `asset_id`는 `animeId + cover checksum`에서 생성되므로 이미지가 바뀌면 ID도 바뀐다.
- RLS는 active release의 asset만 읽게 한다.
- 현재 권리 코드는 `USER_CONFIRMED_PREVIEW_PERMISSION`으로 제한된다.

따라서 카드가 현재 `asset_id`만 저장하면 active release 교체나 과거 release 정리 후 visual을 다시 열지 못할 수 있다.

## 5. 구현 전 확정할 기술 계약

과도한 별도 계층을 늘리지 않고 다음 최소 의미만 고정한다.

```text
catalogCoverIdentity  // 작품에 속한 장기 identity
catalogCoverRevision  // checksum을 가진 실제 이미지 버전
rightsBasis           // 확대 승인 범위
availability          // READY / MISSING / REPLACE_REQUIRED
```

Card metadata는 revision을 참조하고 catalog bytes는 복제하지 않는다. 새 표지를 자동으로 과거 Memory에 덮어쓸지 여부는 기본적으로 `하지 않음`이 안전하다.

## 6. 비파괴 구현 순서

1. Catalog cover identity/revision 계약과 feature flag.
2. `CATALOG_COVER` local Card vertical slice와 핵심 domain 테스트.
3. 별도 승인 후 Supabase additive migration 및 sync.
4. `LegacyLocalLibraryAdapter + MemoryRepository + CatalogTitleResolver` 기반 read projection.
5. Title Hub.
6. My Titles Poster/Memory View.
7. copy, navigation, route alias.
8. Web 사람 검토 후 Android 적용과 legacy UI retirement 검토.

## 7. 테스트 범위 원칙

현재 단계에서는 테스트 구조 자체를 제품보다 크게 만들지 않는다.

- 핵심 불변식은 domain/unit 한 곳에서 검증한다.
- 실제 모바일 흐름은 대표 E2E 한두 개로 검증한다.
- 모든 조합의 screenshot을 만들지 않고 승인된 critical state만 유지한다.
- 같은 계약을 mock, integration, E2E에서 반복 검증하지 않는다.
- 문서-only 단계에는 링크, 충돌 문구, diff 범위 검사만 수행한다.

반드시 보호할 계약:

```text
Save Title ≠ Create Memory
Remove Title ≠ Delete Memory
Catalog cover anchor ≠ cover-based Memory
Delete cover-based Memory ≠ delete shared catalog cover
```

## 8. 위험과 승인 게이트

- **권리 metadata:** 확대 승인 범위를 저장 데이터에 반영하기 전 기존 preview 코드를 그대로 재사용하면 안 된다.
- **reference 수명:** active release 종속성을 해결하기 전 cover Card를 production 저장하면 안 된다.
- **remote migration:** user schema 변경과 RPC 배포는 별도 승인 대상이다.
- **local data:** projection 검증 전 legacy Library key를 변환·삭제하지 않는다.
- **Public:** 대표 표지 private Memory 허용은 Public Card/Board 활성화를 뜻하지 않는다.
- **작업 트리:** 현재 다른 catalog 변경과 섞이지 않도록 후속 commit은 파일 범위를 명시한다.

## 9. Rollback

- 문서 동기화: 이번 문서 변경 commit revert.
- 후속 local feature: feature flag off와 이전 create branch 유지.
- 후속 remote schema: migration별 down/forward-fix 절차와 기존 두 asset type 유지.
- route: `/library/`, `/archive/` 호환 경로를 유지해 새 Title UI만 되돌릴 수 있게 한다.
