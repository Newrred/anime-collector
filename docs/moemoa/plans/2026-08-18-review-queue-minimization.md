# 대규모 수집용 검토 큐 최소화 ExecPlan

> **계획 상태: `COMPLETE`**
> 승인일: 2026-08-18
> 적용 범위: ServiceProjection 자동화 정책과 sample100 오프라인 재검증
> 전체 3,998개 수집 상태: `FULL-CATALOG-INGESTION-GATE-01` 미통과

## 1. 목적과 사용자 결과

표본에서 발견한 모든 불확실 후보를 사람이 검토하는 기존 보수 정책을 대규모 수집에 맞게 바꾼다. 구현 후에는 낮은 신뢰도 후보를 자동으로 사용하지 않되 수동 검토에도 올리지 않고, 작품 식별·필수 필드·무결성 문제만 실제 검토 대상으로 남긴다.

## 2. 관련 확정 결정

- `SAMPLE100-SEMANTIC-HARDENING-01`의 canonical/ServiceProjection 분리를 유지한다.
- 2026-08-18 사용자 승인: 아주 작은 자동 분류 오류를 감수하고 수동 검토를 최소화한다.
- TEST_ONLY, 권리 등급, 전체 수집 및 production 승격 gate는 변경하지 않는다.

## 3. 현재 상태와 증거

- sample100은 구조/service gate PASS지만 `READY_WITH_REVIEW`가 26개다.
- 원인은 한국어 후보 격리 작품 17개, 공식 링크 다중 후보 11개, 두 사유 중복 3개, 불완전 legacy 제목 1개다.
- 이들 대부분은 서비스 필수 데이터 오류가 아니라 선택 후보의 불확실성이다.

## 4. 범위

포함:

- 유사 한국어 후보의 검색 별칭 자동 허용.
- 낮은 유사도 후보의 조용한 격리와 비차단 warning.
- 불완전 legacy 제목 감지 시 비한국어 제목 fallback.
- 공식 링크 후보 자동 우선순위와 보조 링크 보존.
- report에서 수동 review와 자동 warning 분리.

제외:

- 네트워크 재수집, 전체 3,998개 실행, 사용자 신고 UI, 관리자 검토 UI.
- canonical/raw/cover 삭제 또는 source policy 변경.

## 5. 아키텍처·데이터 흐름

```text
CanonicalAnime + CoverRecord
→ preferred title anomaly check
→ high-confidence Korean alias auto-accept
→ low-confidence candidate silent quarantine
→ official link deterministic ranking
→ ServiceProjection warnings / hard blockers 분리
→ quality report
```

## 6. 변경 파일 지도

- `tools/catalog-lab/pipeline/service-projection.mjs`
- `tools/catalog-lab/config/semantic-review-overrides.mjs`
- `tools/catalog-lab/reports/quality-report.mjs`
- `tests/catalog-lab/service-projection.test.mjs`
- `tests/catalog-lab/runner-cli-report.test.mjs`
- `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`
- `docs/moemoa/04_CATALOG_DATA_AND_INGESTION_SPEC.md`
- 본 ExecPlan

## 7. 데이터·스키마 마이그레이션

ServiceProjection policy version을 올리고 저장된 SourceRecord로 offline rebuild한다. raw·claim·canonical·cover는 변경하지 않는다. projection/report는 재생성 가능한 파생 데이터다.

## 8. 마일스톤

1. 자동 별칭·silent quarantine·fallback·link ranking RED 회귀.
2. ServiceProjection policy 구현.
3. report review/warning 분리.
4. sample100 두 번 rebuild와 전체 검증.

## 9. 테스트와 검증

- focused service projection, runner, CLI/report tests.
- `npm run catalog:test`, `npm run test:unit`, `npm run build`, `npm run catalog:guard`.
- sample100 rebuild/validate/report.
- 전후 raw/image/cover/current/canonical/claim tree digest 불변.
- 두 번째 rebuild에서 모든 growth 0.

## 10. 보안·개인정보·권리 영향

네트워크 없이 승인된 외부 TEST_ONLY workspace만 사용한다. 보고서에는 raw payload, 외부 URL, 절대 workspace path를 기록하지 않는다. 기존 distribution/rights 상태를 바꾸지 않는다.

## 11. 관찰 가능성

수동 review 수, 자동 warning 대상 수, 자동 승인 별칭 수, 조용히 격리된 후보 수, 자동 선택 링크 수, title fallback 수를 집계한다.

## 12. 롤백·복구

코드 commit revert 후 offline rebuild하면 이전 정책 projection을 복구할 수 있다. canonical pointer와 원본 tree는 유지한다.

## 13. 위험과 완화

- 잘못된 검색 별칭 자동 허용: 높은 문자열 유사도와 최소 길이를 요구한다.
- 유용한 별칭 과격리: 증거는 삭제하지 않고 사용자 검색 실패/신고 기반으로 후속 승격한다.
- 대표 공식 링크 오선택: 모든 후보를 보조 링크로 보존하고 링크는 서비스 핵심 기능으로 취급하지 않는다.
- 불완전 제목 오탐: 강한 형태 이상과 비한국어 fallback 존재를 함께 요구한다.

## 14. 필요한 사용자 결정

자동 처리와 수동 검토 최소화 원칙은 승인됐다. 3,998개 실행 및 production 승격은 별도 승인 대상이다.

## 15. 진행 기록

```text
[2026-08-18] 사용자 승인: 낮은 위험 후보는 자동 처리하고 수동 검토를 필수/식별 오류로 제한.
[2026-08-18] 시작: sample100 26% review queue를 기준선으로 고정.
[2026-08-18] RED: silent quarantine, alias auto-accept, link auto-select, title fallback 4개 회귀 실패 확인.
[2026-08-18] 실데이터 보정: 정상 장식형 제목 2개가 fallback되는 오탐을 발견하고 RED 회귀 후 수정.
[2026-08-18] 링크 보정: 작품명 도메인이 studio 하위 경로보다 우선하도록 회귀 추가.
[2026-08-18] 전체 검증: catalog 173 pass / 0 fail / 기존 Windows skip 1, unit 91/91, build 성공, guard no leaks.
```

## 16. 발견 사항과 계획 변경

- 최초 휴리스틱은 `~`, `-`로 끝나는 정상 한국어 제목 2개를 불완전 제목으로 오탐했다. 장식용 종결 기호는 이상 신호에서 제거하고 known anomaly·짧은 조사형·괄호 불균형 등 강한 조건만 유지했다.
- 자동 승인된 한국어 별칭 15개를 표본 점검했고 극장판 표기, 띄어쓰기, 한 글자 음역 차이 범위였다. `카논`, `유곽 편`, `@장판` 같은 낮은 유사도 값은 격리됐다.
- 공식 링크 자동 선택 11개를 점검하고 작품명과 일치하는 host가 studio 하위 페이지보다 우선하도록 ranking을 보강했다.

## 17. 완료 보고

- sample100 수동 review 대상은 `26 → 0`, `READY_WITH_REVIEW 26 → 0`이다.
- 최종 readiness는 `READY 95`, `READY_WITH_GAPS 5`, `BLOCKED 0`이다.
- 자동 승인 검색 별칭 15, 조용히 격리한 제목 21, 공식 링크 자동 선택 작품 11, title fallback 1(`ANILIST:204432 → CHOPPER's`)이다.
- warning 대상 작품은 26개지만 사용자가 검토할 작업 큐가 아니라 자동 처리 관찰 통계다.
- 두 번째 rebuild의 SourceRecord/claim/canonical/image/ServiceProjection growth는 모두 0이다.
- raw 200, image 100, cover 100, current 100, canonical 200, claim 9,490의 tree digest는 이전 정책 적용 전과 동일하다.
- ServiceProjection 100개의 최종 tree digest는 `d4f643e7583b43fca387e31065c7e285df02ce91d02a2935b0a77d059626d744`다.
- quality report에는 raw payload reference, 외부 URL, 절대 workspace path가 없다.
- `FULL-CATALOG-INGESTION-GATE-01`은 여전히 미통과다.
