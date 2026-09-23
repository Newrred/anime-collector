# 작품 식별 품질 1차 전수 감사 — 2026-09-07

현재 상태는 **자동 감사 완료, 근거 검토·교정 미완료**다. 운영 데이터 수정이나 배포는 수행하지 않았다.

## 범위와 결과

기존 full3998 3,998개와 increment-2026-09 226개의 최신 pointer, canonical, service projection을 대조했다. 원본 파일을 수정하지 않고 별도 디렉터리에 결과를 생성했다.

| 항목 | 작품 수 | 의미 |
| --- | ---: | --- |
| 감사 대상 / hash 확인 | 4,224 | 파일 무결성 확인이며 작품 내용의 진실성 검증은 아님 |
| 규칙상 구조적 차단 사유 | 0 | 검사한 ID·revision 계약 범위 |
| 검토 후보 | 568 | 확정 오류 아님 |
| 근거 공백 | 312 | 위 후보와 26개 중복 |
| 규칙상 무경고 | 3,370 | 독립 검증 완료 아님 |

상호 배타적인 검토 순서는 시즌/관계 제목 단서 32개 → 나머지 경고·근거 공백 822개 → 무경고 3,370개다. 모든 항목의 검토 상태는 PENDING_EVIDENCE_REVIEW이며 원본 revision hash와 연결했다.

다른 작품의 관계 제목과 seed 별칭이 일치하는 항목은 28개, 표시 제목의 시즌 신호가 관계 작품에서 발견되는 항목은 5개이며 일부 중복된다. 필드 충돌 219개에는 공식 URL 161건, 화수 52건, 시작일 7건이 있다. 필드 간 중복이 있으므로 합계를 작품 수로 해석하지 않는다.

## 교차 검토와 오탐

- ANILIST:103572는 자체 영문·일문 제목과 2019년 상세 정보가 1기인데 한국어 표시 제목에 2기의 ∫∫가 붙어 있다. 같은 canonical의 SEQUEL 관계가 ANILIST:109261 / Go-toubun no Hanayome ∫∫를 가리킨다. 따라서 2기 제목이 검색되는 사실과 1기 ID에 잘못 연결된 사실을 구분해야 한다.
- ANILIST:10030의 한국어 바쿠만 2기와 자체 원제 Bakuman. 2는 표기 방식이 다르다. 현재 규칙은 후자의 숫자를 명시적인 season:2로 해석하지 않아 관련 특별편의 2nd Season 표기에 반응한다. 이 항목은 일괄 교정하면 안 되는 오탐 사례다.
- 관계 제목 일치는 합병의 확정 증거가 아니다. 별칭만 혼입됐거나, 전후편을 통칭하거나, TV와 특별편이 공유하는 제목일 수 있다.

검토 근거: `src/data/aliases.json:18061`, `tools/catalog-lab/pipeline/service-projection.mjs:142-156`, 최신 canonical/관계 원본, 생성된 작품별 finding evidence. 이번 감사 구현은 `tools/catalog-lab/reports/identity-audit.mjs`를 참조한다.

## 다음 교정 절차와 완료 기준

1. 32개 우선 후보의 출처 ID, 원제, 한국어 제목, 시즌/파트/형식을 대조한다. 별칭 혼입과 대표 제목 오류, 작품 누락을 각각 판정한다.
2. 나머지 경고·근거 부족 항목을 확인하고, 무경고 항목도 출처 검토 대상으로 유지한다. 모델은 근거 정리와 후보 판정을 보조하며 응답만으로 VERIFIED를 만들지 않는다.
3. 작품별 수정 전후 값, 원본 revision hash, 증거 URL/로컬 출처, 판정자를 갖는 별도 교정 기록을 만든다. 재검토 시 입력 revision이 달라졌으면 기존 판정을 재사용하지 않는다.
4. 검증된 제목·별칭·ID 연결로 재생성하고 누락 시즌을 확인한다. 재유입을 막는 품질 검사와 검색 캐시 갱신을 포함한다.
5. 확인 완료 / 교정 완료 / 미확인을 별도 집계한다. 근거가 부족한 항목을 정상으로 숨기지 않는다. 운영 반영은 배포용 변경 목록과 복구 산출물이 준비된 시점에 처리한다.

기존 사용자 데이터 이관은 사용자 지시에 따라 제외한다. 원본 보존과 교정 추적은 유지한다. 현재 DB migration과 롤백 작업은 없고 공개 카탈로그의 로컬 사본만 처리했다. 개인 데이터, 이미지 bytes, 비밀 키를 보고서에 포함하지 않았다.

## 파일과 검증

- 계획: `docs/moemoa/plans/2026-09-07-catalog-identity-quality.md`
- 추가 구현: `tools/catalog-lab/reports/identity-audit.mjs`
- 테스트: `tests/catalog-lab/identity-audit.test.mjs`
- 별도 결과: `D:/hong/Web/Anime/.moemoa-catalog-identity-audit-2026-09-07/identity-audit.json`, `summary.json`, `review-queue-template.json`
- `node tests/catalog-lab/run-tests.mjs`: 230 통과, 2 skip, 실패 0. 이후 검토 양식 추가를 포함한 `node --test tests/catalog-lab/identity-audit.test.mjs`: 9 통과.

읽은 기준 문서: AGENTS.md, CODEX_START_HERE.md, 확정 결정 문서, catalog ingestion spec, 현재 ExecPlan. 공급자 수집 정책을 변경하거나 대규모 신규 외부 수집을 수행하지 않았다.
