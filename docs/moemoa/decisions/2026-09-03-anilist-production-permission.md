# AniList Production 보강 사용 승인 기록

- ID: `ANILIST-PROD-01`
- Status: `CONFIRMED`
- Date: 2026-09-03
- Owner/Approver: 사용자
- Source discussion: 2026-09-03 Codex 대화에서 사용자가 AniList 자료의 Production 배포까지 승인받았다고 재확인
- Permission evidence: 원문은 사용자 보관, 저장소에는 사용자 확인과 적용 범위만 기록
- Related ExecPlan: `../plans/2026-09-03-anilist-increment-enrichment.md`

## Context

AniList Source Registry와 코드 정책에는 2026-08-17의 로컬 테스트 전체 목록 저장 허가만 남아 있어, AniList claim과 표지가 `PROHIBITED`로 고정돼 있었다. 사용자는 이번 대화에서 이전 승인 사항이 반영되지 않았음을 지적하고 AniList 자료의 Production 배포까지 승인됐다고 다시 확인했으며, `increment-2026-09` 신규 작품의 비어 있는 필드를 AniList로 보강해 달라고 요청했다.

## Options considered

1. 기존 `LOCAL_TEST_ONLY` 정책을 유지하고 AniList를 대조에만 사용한다.
2. 승인 범위를 Production 저장·표시·배포로 기록하되, 작품 매칭과 필드 검토를 거친 claim만 게시 후보로 만든다.
3. AniList 검색 결과를 자동으로 기존 작품에 병합하고 즉시 게시한다.

## Decision

옵션 2를 채택한다.

- AniList API의 등록된 작품 정보와 대표 표지를 Production 보강 출처로 사용할 수 있다.
- raw 응답을 그대로 공개하지 않고 `SourceRecord → FieldClaim → CanonicalAnime → ServiceProjection` 경계를 유지한다.
- AniList claim은 `FIELD_REVIEW_REQUIRED`로 기록하고, 작품 식별과 데이터 품질 검토를 통과한 값만 Production release 후보가 된다.
- 기존 AniLife 값은 덮어쓰지 않는다. 단일값은 비어 있을 때만 AniList로 채우고, 컬렉션 값은 provenance를 유지한 채 추가한다.
- AniList ID는 MOEMOA 내부 ID를 대체하지 않는 선택적 외부 식별자다.
- 같은 AniList ID가 여러 MOEMOA 대상에 연결되거나 제목·연도·표지 증거가 모호하면 자동 병합하지 않고 검토 대상으로 남긴다.
- 공개 API의 현재 제한과 `Retry-After`를 준수하며, 장애·403 상태를 우회하지 않는다.

## Rationale

- 사용자가 확인한 승인 범위를 실제 Source Registry와 claim 정책에 반영한다.
- 기존 226건의 내부 ID와 AniLife 증거를 보존하면서 제작사·원작 유형·관계·캐릭터·성우·방영일 등 누락 필드를 보강할 수 있다.
- 후보 검색과 실제 상세 수집을 분리해 잘못된 작품 연결이 정식 데이터로 들어가는 것을 막는다.

## Consequences

- AniList Source Registry, 고정 정책, 표지 권리 상태를 Production 승인 값으로 갱신한다.
- `ANILIFE:<id>` 대상에 선택적 AniList binding을 연결할 수 있는 별도 검토 산출물이 필요하다.
- 보강 수집은 기존 값 보존 규칙과 중복 binding 검사를 포함해야 한다.
- Production release 생성·업로드·활성화는 이번 보강 수집과 별도 검증 단계로 유지한다.

## Affected files/modules/docs

- `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`
- `docs/moemoa/04_CATALOG_DATA_AND_INGESTION_SPEC.md`
- `tools/catalog-lab/config/source-registry.json`
- `tools/catalog-lab/contracts/catalogContracts.mjs`
- AniList matching/binding/collection pipeline과 catalog-lab tests

## Migration/rollback impact

앱 DB나 Supabase schema migration은 없다. 외부 catalog workspace에 AniList binding·SourceRecord·canonical revision이 추가되며 기존 immutable AniLife 기록은 삭제하지 않는다. 문제가 있으면 새 binding을 비활성화하고 이전 canonical pointer로 복구할 수 있다.

## Review trigger/date

- AniList의 승인 범위가 변경·철회·만료됨.
- 같은 AniList ID의 중복 binding 또는 오매칭이 발견됨.
- API 정책·rate limit·응답 schema가 변경됨.
- Production release 검토에서 필드별 게시 범위를 더 제한해야 함.
