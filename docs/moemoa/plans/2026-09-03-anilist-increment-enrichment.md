# AniList 증분 카탈로그 보강 ExecPlan

> **계획 상태: `COMPLETE`**
> 작성일: 2026-09-03
> 관련 결정: `CATALOG-01`, `CATALOG-02`, `ANILIST-PROD-01`, `ANILIFE-PROD-01`

## 1. 목적과 사용자 결과

`increment-2026-09`의 226개 MOEMOA 작품 ID와 기존 AniLife 자료를 유지하면서, 정확히 연결할 수 있는 AniList 작품의 누락 필드를 추가 수집한다. 기존 단일값은 덮어쓰지 않고, 애매하거나 중복된 연결은 자동 반영하지 않은 채 검토 결과로 남긴다.

## 2. 관련 확정 결정

- 사용자는 AniList 자료의 Production 배포까지 승인됐다고 2026-09-03 재확인했다.
- MOEMOA 내부 ID가 주 식별자이며 AniList ID는 선택적인 외부 binding이다.
- 외부 자료는 provenance·immutable raw·field claim·revision 경계를 통과한다.
- 불명확한 identity merge는 자동 실행하지 않는다.

## 3. 현재 상태와 저장소 증거

- 신규 226건은 모두 `ANILIFE:<contentId>` target과 고유 MOEMOA ID를 가진다.
- AniLife 상세·표지 226/226이 완료됐고 모두 `READY_WITH_GAPS`다.
- 누락은 source material·studio·character·casting·relation·season·dates·official link 등에 집중돼 있다.
- 현재 AniList adapter는 target에 AniList external ID가 있을 때만 상세 수집할 수 있다.
- 작업 시작 시 Source Registry와 고정 정책은 AniList를 `PROHIBITED/LOCAL_TEST_ONLY`로 남겨 사용자 확인과 불일치했다. 현재는 `FIELD_REVIEW_REQUIRED/PERMISSIONED`로 교정됐다.

## 4. 범위

### 포함

- AniList Production 승인 metadata와 field promotion 정책 갱신.
- `increment-2026-09` 전용 AniList 후보 검색·검토·binding 산출물.
- exact title, 연도·형식·화수, 대표 표지 유사도 등 보수적 증거를 이용한 자동 승인.
- 승인된 binding의 상세 API 수집과 빈 필드 우선 병합.
- offline rebuild, 품질 보고서, 멱등성·중복·오매칭 검사.

### 제외

- 모호한 작품의 강제 병합.
- 기존 3,998건의 전면 재수집.
- Supabase Production release 업로드·활성화와 Web/Android 배포.
- 사용자 데이터·사용자 이미지 변경.

## 5. 아키텍처·데이터 흐름

```text
approved increment manifest + current AniLife cover/metadata
→ AniList public GraphQL candidate search
→ deterministic match evidence
→ exact/high-confidence binding only
→ AniList detail adapter
→ missing-scalar-only + collection-additive FieldClaims
→ canonical revision + existing AniLife cover reuse
→ ServiceProjection + quality report
```

## 6. 변경 파일 지도

- Source Registry와 contract: AniList 승인·필드 승격·권리 상태.
- AniList source/matcher: 후보 조회, binding 검증, 상세 수집.
- artifact store/CLI: 외부 workspace의 binding·검토 결과 저장과 재개.
- identity/claim merge: `ANILIFE:<id>` + 검토된 AniList binding, 빈 필드 우선 규칙.
- tests/docs: 정책·매칭·중복·재개·병합·보고 계약.

## 7. 데이터·스키마 마이그레이션

앱 DB와 Supabase schema migration은 없다. 외부 catalog workspace에 새 binding과 immutable AniList source artifacts만 추가한다. 기존 target key, MOEMOA ID, AniLife raw/cover/current revision은 보존한다.

## 8. 마일스톤

1. 승인 상태와 보강 계약을 문서·Registry·고정 정책에 반영한다.
2. 네트워크 재개 가능한 후보 매칭 스크립트와 보수적 자동 승인 규칙을 구현한다.
3. 승인 binding만 AniList 상세 수집하고 기존 값 보존 병합을 수행한다.
4. 품질·중복·멱등성·Production 후보 상태를 검증하고 결과를 기록한다.

## 9. 테스트와 검증

- `npm run catalog:test`
- AniList live 최소 query 및 현재 rate-limit header 확인.
- `increment-2026-09` 후보 매칭 실행과 승인/보류/중복 집계.
- 승인 binding 대상 AniList 상세 수집.
- `npm run catalog:rebuild -- --profile increment-2026-09`
- `npm run catalog:validate -- --profile increment-2026-09`
- `npm run catalog:report -- --profile increment-2026-09`
- 동일 입력 재실행 시 source/claim/canonical/image 성장량 0 확인.

## 10. 보안·개인정보·권리 영향

공개 GraphQL endpoint와 승인된 cover origin만 사용한다. 인증정보·사용자 데이터·검색 telemetry는 저장하지 않는다. 사용자 보유 허가 원문은 저장소에 복사하지 않고 확인 metadata만 기록한다. raw bulk 응답은 서비스에 직접 노출하지 않는다.

## 11. 관찰 가능성·분석 이벤트

profile별 candidate count, exact/high-confidence/pending/duplicate 수, request count, source stage, error code, 신규 claim과 readiness 변화를 외부 workspace report로 기록한다. 서비스 analytics는 추가하지 않는다.

## 12. 롤백·복구

binding은 별도 파일로 유지해 비활성화할 수 있다. 상세 수집은 checkpoint에서 재개한다. 새 canonical pointer에 문제가 있으면 이전 pointer로 복구하며 immutable source record는 감사 증거로 유지한다.

## 13. 위험과 완화

- 한국어 제목 검색 누락: 표지·연도·형식·화수를 보조 증거로 사용하되 낮은 신뢰도는 보류.
- 동일 작품 중복 target: 같은 AniList ID가 둘 이상이면 자동 승인 금지.
- 기존값 충돌: 단일값은 기존 VALUE를 우선하고 AniList는 빈 필드만 보강.
- API degraded/rate limit: 응답 header와 `Retry-After`, 단일 동시성, checkpoint를 준수.
- 표지 변경·오탐: 이미지 유사도 하나만으로 승인하지 않고 metadata와 유일성 조건을 함께 요구.

## 14. 필요한 사용자 결정

이번 대화에서 AniList Production 배포 승인과 신규 226건의 AniList 보강 수집이 명시적으로 승인됐다. 모호한 identity merge와 실제 Production release 활성화는 자동 실행하지 않는다.

## 15. 진행 기록

```text
[2026-09-03 16:28 KST] 승인: 사용자가 AniList Production 배포 승인과 신규 226건 누락 필드 보강을 요청.
[2026-09-03 16:28 KST] 확인: AniList live GraphQL 최소 query HTTP 200, 현재 degraded limit 30 requests/minute.
[2026-09-03 16:28 KST] 발견: Registry와 고정 정책은 여전히 2026-08-17 LOCAL_TEST_ONLY 승인만 기록.
[2026-09-03 16:28 KST] 발견: 한국어 제목 검색은 일부 AniList Korean synonym에서만 동작하므로 cover/metadata 보조 매칭과 보류 큐가 필요.
[2026-09-03 17:24 KST] 최종 검증: catalog test 224개 중 222 pass, Windows 권한 관련 2 skip, fail 0.
[2026-09-03 16:49 KST] 1차 매칭: 55 approved, 171 pending. `Movie/MOVIE` 표기와 방영 중 현재 화수/예정 총화수를 오탐 식별 근거로 쓴 규칙 문제를 발견.
[2026-09-03 16:56 KST] 2차 매칭 V2: 439 candidates, 38 GraphQL requests, 115 approved, 111 pending. 승인 ID 115개는 모두 고유.
[2026-09-03 17:17 KST] 상세 수집: 115 COMPLETED, 111 ANILIST_BINDING_REQUIRED/PENDING_REVIEW, failed 0.
[2026-09-03 17:20 KST] 완료: 226건 offline rebuild network 0, artifact validation pass, quality/service gate pass.
```

## 16. 발견 사항과 계획 변경

- 초기 3건 확인에서 한국어 제목 검색 결과가 없었고, 다른 2건은 Korean synonym exact 검색으로 반환됐다. 제목 검색 성공 여부만으로 작품 존재 여부를 판단하지 않는다.
- AniLife의 `Movie`와 AniList의 `MOVIE`를 같은 정규화 형식으로 본다.
- 방영 중 AniLife 화수는 현재 공개분, AniList 화수는 예정 총화수일 수 있어 강한 표지·연도·형식 근거가 있으면 identity 필수 조건에서 제외했다. 수집 병합에서는 기존 화수를 그대로 유지했다.
- 중복 판정은 `APPROVED` 후보끼리만 적용해, 근거가 약한 보류 후보가 강한 승인 연결을 무효화하지 않게 교정했다.

## 17. 완료 보고

- 승인 binding/상세 수집: 115/115, 응답·binding ID 불일치 0.
- 보류: 근거 부족 70, 증분 중복 ID 30, 기존 3,998 ID 중복 11.
- 보강: 시즌 113, 시작일 115, 종료일 72, 화수 10, 원작 유형 114, 공식 링크 110, 제작사 113, 관계 111, core genre 110, 캐릭터 114, casting 112.
- 총 entity: AniList ID 115, MAL ID 113, title 1,081, studio 130, relation 222, source genre 521, core genre 296, character 1,888, casting 1,829.
- 보존 검증: 기존 populated scalar 408개 변경 0, AniLife cover 226개 교체 0.
- 완성도: `READY` 72, `READY_WITH_GAPS` 154; quality gate·service gate pass.
- 멱등성: 수집 후 offline rebuild에서 source/claim/canonical/image/service projection 추가 생성 0.
- 롤백: `bindings/anilist/increment-2026-09.json`을 비활성화하고 offline rebuild하면 이전 AniLife-only canonical로 복귀할 수 있으며 immutable 원본은 감사 증거로 유지한다.
