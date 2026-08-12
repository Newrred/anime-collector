# MOEMOA CODEX HANDOFF — 단일 인수인계본

> **문서 상태: `FROZEN_SNAPSHOT` — 2026-08-11 audit 이전**
> 이 합본은 당시 INSTALL, CODEX_START, 00~09, audit prompt 01을 묶은 배포본이며 현재 reports, 계획, 전체 prompt/template 상태를 포함하지 않는다. 현행 기준은 [`docs/moemoa/README.md`](docs/moemoa/README.md)와 분리된 Markdown 원본이다. **이 파일을 직접 편집해 최신화하지 않는다.** 다시 배포할 필요가 생기면 canonical 원본과 재생성 절차를 먼저 확정한다.

- 기준일: 2026-08-11
- 용도: 프로젝트 대화를 이동하지 못할 때 Codex에 제품·기술·작업 맥락을 한 번에 전달
- 주의: 실제 저장소 상태는 이 문서가 아니라 Codex 저장소 감사 결과로 확정

---

## MOEMOA Codex 인수인계 패키지 설치 안내

- 작성 기준일: 2026-08-11
- 목적: 현재 ChatGPT 세션을 프로젝트로 이동하지 못하더라도, 기존 MOEMOA 저장소에서 같은 제품 맥락과 작업 규칙을 유지하며 Codex 작업을 시작하게 한다.
- 권장 사용 방식: 이 패키지를 저장소에 복사한 뒤, Codex를 **저장소 루트**에서 시작한다.

## 1. 패키지에서 가장 중요한 파일

| 파일 | 역할 |
| --- | --- |
| `AGENTS.md` | Codex가 매 작업 전에 따라야 할 저장소 수준 규칙 |
| `CODEX_START_HERE.md` | 문서 지도, 작업별 필수 참조 문서, 최초 실행 순서 |
| `PLANS.md` | 여러 파일·마이그레이션·장기 작업에 사용할 ExecPlan 규격 |
| `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md` | 확정 결정과 아직 Codex가 임의로 결정하면 안 되는 항목 |
| `docs/moemoa/08_CODEX_PHASE_RUNBOOK.md` | 단계별 작업·산출물·검수·승인 게이트 |
| `prompts/moemoa/01_BOOTSTRAP_REPOSITORY_AUDIT.md` | Codex 첫 메시지로 사용할 복사·붙여넣기 프롬프트 |

## 2. 저장소에 복사하는 방법

### 저장소 루트에 `AGENTS.md`가 없는 경우

다음 파일과 폴더를 저장소 루트에 복사한다.

```text
AGENTS.md
CODEX_START_HERE.md
PLANS.md
docs/moemoa/
prompts/moemoa/
templates/moemoa/
```

### 저장소 루트에 기존 `AGENTS.md`가 있는 경우

기존 파일을 덮어쓰지 않는다.

1. 패키지의 `AGENTS.md`에서 `MOEMOA project instructions` 섹션을 기존 파일에 병합한다.
2. 기존 테스트·포맷·브랜치 규칙과 충돌하는 항목을 확인한다.
3. 충돌 시 기존 저장소의 실제 실행 규칙을 유지하되, 제품 결정과 안전 게이트는 삭제하지 않는다.
4. 병합 결과를 첫 Codex 감사 단계에서 보고하게 한다.

## 3. 최초 실행 순서

1. Codex를 저장소 루트에서 연다.
2. `prompts/moemoa/01_BOOTSTRAP_REPOSITORY_AUDIT.md` 내용을 첫 메시지로 전달한다.
3. 첫 단계에서는 코드 수정, 패키지 설치, 데이터 마이그레이션을 허용하지 않는다.
4. Codex가 작성한 다음 문서를 검토한다.
   - `docs/moemoa/reports/repository-audit.md`
   - `docs/moemoa/reports/implementation-gap-analysis.md`
   - `docs/moemoa/reports/architecture-options.md`
   - `docs/moemoa/reports/open-decision-questions.md`
5. 감사 결과를 승인한 뒤에만 `prompts/moemoa/02_ARCHITECTURE_AND_EXECPLAN.md`로 진행한다.

## 4. 문서를 저장소에 커밋하는 권장 방식

```text
docs/codex-handoff 또는 docs/moemoa 문서 추가
→ 별도 문서 커밋
→ 저장소 감사
→ 제품·기술 결정 갱신
→ 구현 브랜치 시작
```

권장 첫 커밋 메시지:

```text
docs: add MOEMOA Codex handoff and execution protocol
```

## 5. 이 패키지가 대체하지 않는 것

- 실제 저장소 감사
- 대상 국가의 법률 자문
- 외부 데이터 소스별 이용조건 검토
- 개인정보보호 영향평가
- 운영 인력과 예산 결정
- 프로덕션 배포 승인

문서에 적힌 현재 구현 상태는 2026-08-10 기준 기존 메모에서 가져온 역사적 기준이다. Codex는 반드시 실제 저장소 파일과 실행 결과로 다시 확인해야 한다.

---

## CODEX START HERE — MOEMOA

## 1. 목적

이 파일은 Codex가 기존 ChatGPT 세션 없이도 MOEMOA의 제품 맥락, 확정 결정, 금지사항, 참조 문서, 작업 순서를 재구성하게 하는 진입점이다.

Codex는 세션 대화를 추측하거나 이전 요약을 현재 코드 상태로 간주하지 않는다. 모든 구현 상태는 실제 저장소에서 확인한다.

## 2. 제품 기준점

> MOEMOA는 사용자가 애니를 보며 남기고 싶은 장면을 이미지 중심 Memory Card로 만들고, 이를 Archive와 Board에 수집·재구성하며, 준비된 범위 안에서 공유하는 서비스다.

핵심 구조:

```text
작품 검색 또는 개인 작품 생성
→ 사용자 이미지 또는 서비스 디자인 카드 선택
→ 선택적 기억 신호 추가
→ Memory Card 저장
→ Archive 자동 축적
→ Board 선택 분류
→ 로그인 후 Web·백업·다기기
→ 권리·UGC 게이트 통과 시 제한적 Public
```

## 3. 소스 계층

| 우선순위 | 자료 | 용도 |
| ---: | --- | --- |
| 1 | `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md` | 현재 확정 결정과 미정 게이트 |
| 2 | 실제 저장소 코드·설정·테스트·마이그레이션 | 현재 구현 상태의 유일한 기술적 사실 |
| 3 | `02`~`09` 실행 명세 | 구현·검수·운영 기준 |
| 4 | `references/2026-08-10-product-direction-research-integrated.md` | 시장·경쟁·제품 권고 배경 |
| 5 | `references/2026-08-06-product-direction-decision-draft.md` | 최초 방향과 과거 상태 기록 |

상위 자료와 하위 자료가 충돌하면 상위 자료를 우선한다. 실제 코드 상태와 제품 결정이 충돌하면 Codex가 임의로 화해시키지 않고 Gap으로 보고한다.

## 4. 작업별 필수 참조 문서

| 작업 종류 | 반드시 읽을 문서 | 보조 문서 |
| --- | --- | --- |
| 최초 저장소 감사 | `03_REPOSITORY_AUDIT_PROTOCOL.md` | `01`, 과거 references |
| 제품 흐름·UI | `01`, `02_PRODUCT_SCOPE_AND_USER_FLOWS.md` | `06` |
| Web/Android 구조 | `01`, `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md` | `03`, `07` |
| 작품 카탈로그·수집 | `01`, `04_CATALOG_DATA_AND_INGESTION_SPEC.md` | Source Registry 템플릿 |
| 이미지 저장·동기화 | `01`, `05_IMAGE_UGC_POLICY_MODERATION_SPEC.md` | `06`, `07` |
| 공개 UGC | `01`, `05`, `07` | UGC launch gate 템플릿 |
| 인증·로컬 승격·동기화 | `01`, `06`, `07` | `02` |
| DB 마이그레이션 | `03`, `06`, `09` + `PLANS.md` | 해당 도메인 명세 |
| QA·회귀 테스트 | `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md` | `09` |
| 베타·출시 | `07`, `08_CODEX_PHASE_RUNBOOK.md` | `05` |
| 코드 리뷰 | `09_CHANGE_CONTROL_AND_REPORTING.md` | `prompts/moemoa/06_CODE_REVIEW.md` |
| 결정 변경 | `01`, `09` | Decision Log 템플릿 |

## 5. 단계별 읽기 순서

### Phase 0 — 패키지 설치와 지침 확인

읽기:

1. `AGENTS.md`
2. 이 파일
3. `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`

행동:

- 기존 `AGENTS.md`, `README`, package manifest, build scripts를 확인한다.
- 기존 지침과 충돌을 보고한다.
- 코드 변경은 하지 않는다.

### Phase 1 — 저장소 감사

읽기:

- `03_REPOSITORY_AUDIT_PROTOCOL.md`
- 과거 reference 문서의 현재 프로젝트 상태 메모

행동:

- 프레임워크, 앱 구조, DB, 인증, 이미지, AniList 의존, aliases, 테스트, CI/CD를 증거 기반으로 확인한다.
- `reports/repository-audit.md` 등 4개 산출물을 작성한다.

### Phase 2 — 기술 방향과 ExecPlan

읽기:

- `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- `PLANS.md`
- 감사 산출물

행동:

- 현재 스택을 최대한 활용하는 옵션을 우선 제시한다.
- Web+Android를 완전히 별개로 재구축하지 않는다.
- 첫 Vertical Slice와 단계별 마이그레이션 ExecPlan을 작성한다.
- 승인 전 대규모 구현을 시작하지 않는다.

### Phase 3 — 카탈로그 기반

읽기:

- `04_CATALOG_DATA_AND_INGESTION_SPEC.md`
- Source Registry 템플릿

행동:

- 소스 승인 체계와 raw staging을 먼저 구현한다.
- 소규모 대표 표본으로 수집·정규화·중복·충돌·멱등성을 검증한다.
- 전체 대상 대량 수집은 표본 파이프라인과 승인 게이트 통과 후 진행한다.

### Phase 4 — Private Vertical Slice

읽기:

- `02_PRODUCT_SCOPE_AND_USER_FLOWS.md`
- `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`

행동:

```text
Android Share Target 또는 Photo Picker
→ 작품 검색/PrivateTitle
→ 이미지 우선 Memory Card
→ LOCAL_ONLY 저장
→ Archive
→ Board
→ 선택 로그인
→ Web에서 동기화된 카드 확인
```

### Phase 5 — 이미지 클라우드와 UGC 기반

읽기:

- `05_IMAGE_UGC_POLICY_MODERATION_SPEC.md`
- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`

행동:

- `LOCAL_ONLY / PRIVATE_CLOUD / PUBLIC`을 분리한다.
- 로그인만으로 이미지를 자동 업로드하지 않는다.
- Quarantine, 파일 검사, 권리 메타데이터, 신고·차단·심사·삭제·이의제기·감사 로그를 구현한다.
- Public 기능은 플래그 뒤에 둔다.

### Phase 6 — 제한적 Public 베타

행동:

- Generic UGC gate와 이미지 유형별 rights gate를 각각 확인한다.
- 시스템 디자인, 사용자 원본, 명확한 라이선스 이미지부터 검토한다.
- 애니 장면 캡처와 타인 팬아트는 별도 게이트 없이는 활성화하지 않는다.

### Phase 7 — QA, 베타, 운영

읽기:

- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`
- `08_CODEX_PHASE_RUNBOOK.md`

행동:

- 데이터 손실, 비공개 노출, 삭제 전파, 동기화, 신고 처리, kill switch를 E2E로 검증한다.
- 제품 지표와 안정성 지표를 분리해 계측한다.

## 6. Codex가 매 작업 전에 확인할 질문

1. 이 작업은 어떤 확정 결정과 연결되는가?
2. 필요한 참조 문서를 모두 읽었는가?
3. 현재 코드 상태를 파일과 실행 결과로 확인했는가?
4. 데이터 마이그레이션 또는 권리·개인정보 영향이 있는가?
5. 기능 플래그와 롤백 경로가 필요한가?
6. 어떤 테스트가 완료 조건을 증명하는가?
7. 이 작업이 새로운 제품 결정을 암묵적으로 만들고 있지 않은가?

## 7. 최초 사용자 행동

Codex에 다음 파일의 내용을 첫 프롬프트로 전달한다.

```text
prompts/moemoa/01_BOOTSTRAP_REPOSITORY_AUDIT.md
```

첫 결과를 검토하기 전에는 Phase 2 이후 프롬프트를 사용하지 않는다.

---

## 00. 세션 인수인계와 프로젝트 맥락

## 1. 문서 목적

이 문서는 현재 대화를 이동할 수 없는 상황에서, Codex가 제품 의도와 기술 작업의 경계를 잃지 않도록 최소한의 전체 맥락을 제공한다.

## 2. 제품의 현재 정의

> MOEMOA는 애니를 본 뒤 기억하고 싶은 장면을 이미지 중심 Memory Card로 저장하고, Archive와 Board를 통해 수집·재분류·재발견하며, 권리와 운영 체계가 준비된 범위 안에서 공유하는 서비스다.

MOEMOA가 우선 해결하려는 문제는 일반 애니 목록 관리가 아니다.

- 사용자는 장면 스크린샷과 짧은 감정을 여러 앱에 흩어 저장한다.
- 작품 목록만으로는 왜 그 작품이 남았는지 보존되지 않는다.
- 긴 리뷰보다 빠른 시각 기록과 다시 보는 경험이 필요하다.
- 카드가 쌓이며 수집 욕구와 개인 아카이브의 소유감을 형성해야 한다.

## 3. 핵심 제품 구조

```text
Anime / PrivateTitle
  1 ─ N MemoryCard

MemoryCard
  N ─ M Board         // BoardCard가 순서와 저장 시각 관리
  1 ─ 1 VisualAsset   // 사용자 이미지 또는 시스템 디자인 카드

Public reference
  원본 카드와 이미지 파일을 복제하지 않고 참조
```

## 4. 이번 세션에서 사용자가 확정한 내용

- Web + Android.
- Android는 이미지 수집, Share Target, 빠른 카드 작성의 주력 클라이언트.
- Web은 Archive, Board, 공개 페이지, 계정, 관리 기능의 공통 기반.
- 같은 백엔드와 데이터 모델 사용.
- 작품 제목 + 시각 요소가 카드 완료 조건.
- 사용자 이미지를 강력 권장하되 서비스 디자인 카드 허용.
- 작품 장르 태그는 카탈로그에서 자동 연결.
- 감상·감정·날짜·장면은 선택.
- Archive 자동, Board 선택, 카드 3개 이후 Board 제안.
- Board N:M.
- 모든 이미지 유형을 데이터 모델에서 구분 지원.
- Public은 이미지 유형별로 분리하고 기능 플래그로 제어.
- 로그인 없이 로컬 사용, 첫 카드 뒤 로그인 권장.
- 백업·Web·다기기·공개 기능은 로그인 필요.
- 다가오는 분기와 최근 2~3년 주요 작품부터 자체 카탈로그 구축.
- 없는 작품은 개인 전용으로 즉시 생성.
- 기존 데이터는 `legacy_unverified`.
- 여러 사이트에서 필요한 사실 필드를 raw data로 수집한 뒤 MOEMOA 구조로 정규화.
- 자유로운 이미지 사용을 지향하되 정책, 신고, 차단, 심사, 삭제, 이의제기, 반복 침해자 처리를 실제 구현한 뒤 공개 범위를 확대.

## 5. 카탈로그에 필요한 데이터 필드

- 원제
- 공식 영문 제목
- 공식 현지화 제목
- 방영 연도·분기
- 시작일·종료일
- 형식: TV, Movie, OVA, ONA, Special 등
- 화수
- 방영 상태
- 제작사 및 역할
- 공식 사이트
- 원작 유형
- 작품 관계
- 장르와 작품 속성 태그
- 등장 캐릭터
- 캐릭터별 성우 및 언어·배역 관계

태그는 외부 설명문·가중치·명명 체계를 복제하는 것이 아니라 raw candidate를 자체 태그 체계로 재구성한다.

## 6. 과거 문서에서 계승한 제품 원칙

- 작품 데이터는 카드 제작을 돕는 보조 인덱스이며 사용자가 만든 카드가 주인공이다.
- 같은 작품에서도 여러 장면과 시기마다 여러 Memory Card를 만들 수 있다.
- 공개 경쟁보다 개인 Archive의 수집감과 Board의 재해석을 우선한다.
- 공개 공유는 개인 경험과 운영 안전 장치가 검증된 뒤 단계적으로 연다.
- 데이터 내보내기·복원·삭제를 제공한다.
- 이미지가 없어도 시스템 디자인 카드로 완성 가능해야 한다.
- 다른 사용자의 카드를 Board에 저장할 때는 원본 참조와 작성자·출처를 유지한다.

## 7. 과거 구현 상태 메모 — 반드시 재검증

2026-08-10 기준 문서에는 다음이 기록되어 있었다.

- master에 동남아 출시·수익화 설계, 구현 계획, 제품 안정화 작업이 병합됨.
- 신규 사용자 빈 상태, 영어 UX, 퀵로그 원자적 저장, 저장·동기화·레거시 마이그레이션 안정화는 구현·검증 완료.
- 런타임 검색·상세·표지 이미지는 AniList 의존.
- 자체 카탈로그, `legacy_unverified` 마이그레이션, Memory Card·Archive·Board·제한적 공유는 구현 전.

Codex는 이 상태를 현재 사실로 간주하면 안 된다. 실제 브랜치·커밋·파일·테스트 결과로 다시 확인한다.

## 8. 리서치에서 얻은 핵심 제품 판단

- 일반 트래커 대체보다 개인 시각 기억 아카이브 포지셔닝이 유효하다.
- 첫 카드보다 두 번째·세 번째 카드와 Archive 재방문이 중요하다.
- 이미지 중심 수집 욕구를 유지하되 시스템 디자인 카드가 대체 경로여야 한다.
- Board는 데이터 구조상 P0이지만 첫 카드 흐름에서 강제하지 않는다.
- 공개 이미지 SNS를 첫 핵심으로 삼으면 저작권·모더레이션·스토리지·콜드스타트가 동시에 발생한다.
- 따라서 Private vertical slice와 UGC 기반을 구분해 단계적으로 구현한다.

## 9. 프로젝트에서 피해야 할 방향

- AniList 축소 복제처럼 보이는 작품 상세 중심 제품.
- 작품 제목만 추가해도 완성되는 일반 목록 앱.
- Web과 Android가 서로 다른 도메인 모델과 저장 개념을 갖는 구조.
- 로그인 시 사용자의 로컬 이미지를 자동 업로드하는 구조.
- 공개 UGC 정책 문서만 있고 실제 신고·차단·삭제 도구가 없는 구조.
- UGC 시스템을 구현했다는 이유로 애니 캡처나 타인 팬아트의 공개 권리가 자동 확보된다고 보는 구조.
- 외부 데이터를 스키마만 바꾸면 검증된 자체 데이터가 된다고 보는 구조.
- 전체 카탈로그 수집을 핵심 제품 흐름보다 먼저 끝내려는 접근.

## 10. 최우선 검증 질문

1. 사용자는 Android에서 이미지를 받아 90초 안에 카드를 완성할 수 있는가?
2. 이미지 중심 카드가 두 번째·세 번째 카드 작성으로 이어지는가?
3. Archive와 Board가 실제 재방문 이유가 되는가?
4. Web과 Android의 동기화 상태가 오해 없이 표시되는가?
5. 이미지가 `LOCAL_ONLY / PRIVATE_CLOUD / PUBLIC` 중 어디에 있는지 사용자가 이해하는가?
6. 공개 UGC가 신고·삭제·권리 요청에 실제로 대응 가능한가?
7. 카탈로그가 불완전해도 PrivateTitle로 기록을 계속할 수 있는가?

---

## 01. 확정 결정과 미정 게이트

## 1. 사용법

- `확정`: Codex가 구현 기준으로 사용한다.
- `작업 기준`: 아직 최종 사업 결정은 아니지만 기존 방향서의 기본값으로 유지한다.
- `게이트 미통과`: 구현 기반은 만들 수 있지만 기능 활성화나 대규모 실행은 금지한다.
- `미정`: Codex가 옵션과 근거를 제안하되 임의로 확정하지 않는다.

## 2. 확정 결정

### PLATFORM-01 — Web + Android

상태: **확정**

- Android는 이미지 수집, Share Target, Photo Picker, 빠른 카드 작성의 주력 클라이언트다.
- Web은 Archive, Board, 공개 페이지, 계정·데이터 관리, 관리자 기능의 공통 기반이다.
- 동일 백엔드, 인증 체계, 내부 ID, 도메인 모델을 사용한다.
- 두 플랫폼을 별개의 제품이나 별도 카탈로그로 만들지 않는다.
- 실제 구현 기술은 저장소 감사 후 현재 스택에 가장 적합한 방식을 선택한다.

### CARD-01 — 이미지 우선 Memory Card

상태: **확정**

완료 조건:

```text
Anime 또는 PrivateTitle
+ VisualAsset 1개
= Complete Memory Card
```

- 사용자 이미지를 강력 권장한다.
- 사용자가 이미지를 제공하지 못하면 서비스 디자인 카드를 생성한다.
- 작품 제목만 있으면 Draft다.
- 작품 장르 태그는 카탈로그에서 자동 연결한다.
- 감상, 감정, 날짜, 에피소드·장면, 재감상 의도는 선택 항목이다.
- 사용자 메모는 긴 리뷰가 아니라 짧은 기억 신호를 우선한다.

### BOARD-01 — Private Board P0

상태: **확정**

- Archive는 모든 완성 카드를 자동으로 포함한다.
- Board는 사용자가 선택해서 만든다.
- 카드가 3개 이상일 때 Board 생성 제안을 노출한다.
- 하나의 카드가 여러 Board에 들어갈 수 있다.
- Board에서 카드를 제거해도 원본 카드가 삭제되지 않는다.
- 공개 불가능 카드가 포함된 Board는 Public 전환할 수 없다.

### IMAGE-01 — 이미지 유형 전체를 데이터 모델에서 구분

상태: **확정**

지원 대상:

- 사용자 기기 이미지
- 시스템 디자인 카드
- 텍스트 중심 디자인 카드
- 애니 장면 캡처
- 사용자 원본 사진·그림
- 사용자가 직접 만든 팬아트
- 타인 팬아트
- 라이선스 이미지

각 이미지에는 최소한 다음을 기록한다.

```text
imageType
storageScope
visibility
rightsBasis
creator/source
license/permission
moderationStatus
spoiler/content rating
```

### IMAGE-02 — 유형별 Public 제어

상태: **정책 확정 / 활성화 게이트 별도**

- Android 외부 공유는 P0 범위다.
- MOEMOA 서비스 내 Public은 유형별 기능 플래그로 제어한다.
- 시스템 디자인, 사용자 원본, 명시적 허가·라이선스 이미지를 우선 후보로 둔다.
- 일반 UGC 운영 게이트와 이미지 유형별 권리 게이트를 분리한다.

### ACCOUNT-01 — 로컬 우선 + 선택 로그인

상태: **확정**

- 로그인 없이 Private 카드, Archive, Board를 사용할 수 있다.
- 첫 카드 저장 후 로그인을 권장한다.
- 로그인은 백업, Web 동기화, 다기기, Public 기능에 필요하다.
- 로그인 시 기존 로컬 데이터를 계정에 안전하게 승격한다.
- 카드 메타데이터 동기화와 이미지 클라우드 백업 동의를 분리한다.

### CATALOG-01 — 제한된 자체 카탈로그

상태: **확정**

- 다가오는 분기와 최근 2~3년 주요 작품부터 구축한다.
- 없는 작품은 PrivateTitle로 즉시 생성한다.
- 반복 요청되는 PrivateTitle은 공용 승격 후보가 된다.
- 기존 혼합 출처 데이터는 `legacy_unverified`로 격리한다.
- 초기 범위가 제품 출시를 막지 않도록 한다.

### CATALOG-02 — 필요한 사실 필드의 자체 정규화

상태: **확정**

수집·정규화 대상:

- 제목 계열
- 방영·형식·화수·상태
- 제작사와 역할
- 공식 사이트
- 원작 유형
- 작품 관계
- 장르·태그 후보
- 캐릭터와 성우 관계

MOEMOA는 자체 내부 ID, 관계 타입, 중복 판별, 검증 상태를 운영한다.

## 3. 작업 기준으로 유지할 항목

### PRODUCT-01 — 제품 포지셔닝

- 일반 애니 트래커를 대체하는 것이 아니라 이미지 중심 개인 기억 아카이브다.
- 작품 DB보다 Memory Card, Archive, Board가 우선이다.

### MARKET-01 — 초기 시장

- 영어 우선.
- 필리핀은 사용자 확보·메시지 검증.
- 싱가포르는 품질·지불 의향 교차 검증.
- 실제 집행 전 재확인한다.

### MONETIZATION-01 — 초기 무료·무광고

- 핵심 기록, Archive, 기본 Board, 내보내기·삭제는 무료 유지.
- 반복 사용 검증 전 제품 내 광고·구독을 핵심 개발 범위로 넣지 않는다.

## 4. 게이트 미통과 항목

### UGC-GATE-01 — 일반 공개 UGC 운영 게이트

상태: **미통과**

통과 조건:

- 최신 약관과 업로드 정책 동의
- 금지 콘텐츠 정의
- 게시 권한 확인
- 인앱 콘텐츠 신고
- 인앱 사용자 신고·차단
- 운영자 검토 큐
- 노출 제한·삭제
- 업로더 통지
- 이의제기·복구
- 반복 침해자 경고·정지
- 원본·파생본·CDN 삭제 전파
- 감사 로그
- 전역 Public·이미지 kill switch
- 담당자·SLA
- E2E 테스트

Codex는 기반을 구현할 수 있지만 이 게이트가 통과되지 않으면 Public 기능 기본값을 켜면 안 된다.

### SCREENSHOT-PUBLIC-GATE-01 — 애니 장면 캡처 Public

상태: **비활성화**

일반 UGC 시스템과 별도로 다음이 필요하다.

- 대상 국가 기준 법률·정책 검토
- 허용·금지 범위 명문화
- 권리자 요청 즉시 차단
- 광고·프로모션에서 사용 금지 여부 구분
- 운영 부담 승인

### THIRD-PARTY-FANART-GATE-01 — 타인 팬아트 재업로드

상태: **비활성화**

- 작가의 명시적 허가 또는 라이선스 증빙
- 원작 IP의 2차 창작 정책 검토
- 작가·원문 URL·허가 상태 기록
- 허가 철회 처리

### FULL-CATALOG-INGESTION-GATE-01

상태: **미통과**

다음 전에는 전체 대상 수집을 실행하지 않는다.

- Source Registry 승인
- raw staging과 provenance
- 대표 표본의 정규화·중복·충돌 검증
- 멱등성·재실행·롤백 테스트
- 요청 제한과 오류 복구
- 데이터 품질 대시보드

## 5. 아직 사용자가 결정해야 할 항목

Codex는 저장소 감사 후 옵션을 제안하되 선택하지 않는다.

| ID | 미정 항목 | 필요한 제안 |
| --- | --- | --- |
| TECH-01 | Web/Android 실제 기술 방식 | 현재 스택 활용안 2~3개, 비용·재사용·네이티브 기능 비교 |
| BACKEND-01 | API·DB·오브젝트 스토리지 | 기존 구성 확인, 변경 필요성, 비용·운영 비교 |
| AUTH-01 | 인증 공급자와 익명→계정 승격 | 기존 인증과 충돌 여부, 계정 병합 규칙 |
| SYNC-01 | 동기화 충돌 정책 | 카드 본문, Board 순서, 삭제 대 수정의 규칙 |
| IMAGE-SYNC-01 | Private 이미지 백업 | 수동 동의, 용량·포맷·보관·삭제 기준 |
| AGE-01 | 공개 UGC 연령 | 18+ 베타 또는 미성년자 지원 시 추가 요건 |
| MODERATION-01 | 사전 심사 대 사후 심사 | 초기 베타 권장안과 운영량 추정 |
| SOURCE-01 | 출처별 사용 등급 | 직접 적재, 공식 검증, 대조 전용, 금지 |
| TAG-01 | MOEMOA 태그 체계 | core genre, catalog tag, memory tag 분리 |
| STORAGE-01 | 이미지 제한 | 포맷, 크기, 해상도, 파생본, 무료 용량 |
| PRIVACY-01 | 운영 주체·리전·보관 | 법적 주체, 데이터 위치, 수탁자, 삭제 기간 |
| BETA-01 | 베타 규모와 성공 기준 | 활성화, D7, 품질, UGC 처리 기준 |

## 6. 결정 변경 규칙

- 확정 결정을 바꾸는 구현은 먼저 Decision Log를 수정한다.
- Codex는 `제안`과 `확정`을 분리해 표시한다.
- 사용자 승인 전에는 새로운 선택지를 코드에 영구 고정하지 않는다.
- 임시 선택은 feature flag, adapter, configuration으로 격리한다.

---

## 02. 제품 범위와 사용자 흐름

## 1. P0 목표

P0의 목표는 공개 SNS를 완성하는 것이 아니라 다음 핵심 루프를 안정적으로 만드는 것이다.

```text
이미지를 확보한다
→ 작품과 연결한다
→ 카드를 만든다
→ Archive에 쌓인다
→ Board로 묶는다
→ 필요할 때 계정과 Web으로 확장한다
```

## 2. P0 포함

### 작품

- 공용 작품 검색
- 검색 실패 시 PrivateTitle 생성
- 공용 작품과 PrivateTitle의 시각적 구분
- 작품 장르 자동 연결

### Memory Card

- 한 작품에 여러 카드
- 사용자 이미지 강력 권장
- 시스템 디자인 카드 대체
- 짧은 감상·감정·날짜·장면 선택
- 스포일러
- Draft/Complete 상태
- 수정·삭제

### Archive

- 최근 카드
- 작품별 카드
- 날짜별 카드
- 장르·개인 태그 필터
- 같은 작품의 여러 카드
- 카드 상세와 수정

### Board

- Private Board 생성·수정·삭제
- N:M 카드 배치
- 순서 변경
- 카드 3개 이후 제안

### 계정·동기화

- 비로그인 로컬 사용
- 익명 소유자 ID
- 첫 카드 후 로그인 권장
- 로컬 데이터 계정 승격
- 메타데이터 동기화 상태 표시
- Web에서 카드·Archive·Board 확인

### 데이터 소유권

- JSON 내보내기
- 복원
- 카드·이미지·계정 삭제
- 동기화 실패와 로컬 저장 상태 구분

### 운영 기반

- 오류 추적
- 최소 분석 이벤트
- 기능 플래그
- 개인정보·약관·신고 경로

## 3. P0에서 기반만 준비하고 기본 비활성화

- `PRIVATE_CLOUD` 이미지 백업
- Public 카드·Board
- 다른 사용자 카드의 원본 참조 저장
- 관리자 UGC 검토 큐
- 신고·차단·이의제기

이 기능들은 스키마와 플래그를 준비할 수 있지만 게이트 통과 전 활성화하지 않는다.

## 4. P0 제외

- 댓글, DM, 멘션, 채팅
- 무한 추천 피드
- 팔로워 수 경쟁
- 애니 캡처 무제한 Public
- 타인 팬아트 무허가 Public
- AI 감상 분석
- 광고·구독
- 전체 역사 카탈로그 완성
- iOS 동시 구현
- 스트리밍 앱 화면을 직접 캡처하는 기능

## 5. 핵심 사용자 흐름

### Flow A — Android Share Target

```text
사용자가 갤러리/다른 앱에서 이미지 공유
→ MOEMOA 선택
→ 임시 Draft 화면
→ 이미지 미리보기와 변경
→ 작품 검색 또는 PrivateTitle
→ 자동 장르 확인
→ 선택적 기억 신호
→ LOCAL_ONLY 저장
→ Archive
→ 로그인/백업 권장
```

수용 기준:

- 공유받은 이미지를 바로 확정 저장하지 않는다.
- 사용자가 작품과 이미지를 검토한다.
- 취소하면 빈 카드가 남지 않는다.
- 네트워크가 없어도 저장 가능하다.
- 중복 탭으로 카드가 중복 생성되지 않는다.

### Flow B — Android Photo Picker

```text
앱에서 카드 만들기
→ 작품 선택
→ Photo Picker
→ 앱 전용 저장소로 안전하게 복사
→ 선택적 기억 신호
→ 저장
```

### Flow C — 시스템 디자인 카드

```text
작품 선택
→ 이미지 없음
→ 시스템 디자인 생성
→ 제목·장르·패턴·타이포그래피
→ 카드 저장
```

이미지 중심 제품이지만 이미지 확보 실패가 기록 실패로 이어지지 않게 한다.

### Flow D — 첫 로그인과 로컬 승격

```text
로컬 카드 존재
→ 로그인 권장
→ 인증
→ 로컬 데이터를 계정에 연결할지 확인
→ 메타데이터 동기화
→ 이미지 백업은 별도 선택
→ Web에서 확인
```

### Flow E — Board

```text
카드 3개 생성
→ Board 제안
→ 제목 입력
→ 카드 선택
→ 순서 지정
→ Private Board 저장
```

### Flow F — Public 게시 요청

```text
로그인
→ 카드 공개 요청
→ 이미지 유형·권리·출처 확인
→ 정책 동의
→ Quarantine/검토
→ 승인 또는 반려
→ Public URL
```

게이트 미통과 상태에서는 UI가 노출되어도 실제 Public 전환은 불가능해야 한다.

## 6. 상태 모델

### MemoryCard

| 상태 | 의미 |
| --- | --- |
| `DRAFT` | 작품 또는 VisualAsset이 미완성 |
| `COMPLETE_PRIVATE` | 작품 + VisualAsset, 개인 Archive 저장 가능 |
| `PUBLISH_PENDING` | Public 요청, 검토 중 |
| `PUBLIC` | 공개 승인 |
| `RESTRICTED` | 신고·권리·안전 문제로 노출 제한 |
| `DELETED` | 사용자 삭제 또는 운영 삭제 |

### ImageAsset storageScope

- `LOCAL_ONLY`
- `PRIVATE_CLOUD`
- `PUBLIC`

### ImageAsset rightsBasis 예시

- `USER_ORIGINAL`
- `USER_CREATED_FANART`
- `THIRD_PARTY_PERMISSION`
- `OPEN_LICENSE`
- `ANIME_SCREENSHOT`
- `THIRD_PARTY_FANART_UNKNOWN`
- `SYSTEM_GENERATED`
- `UNKNOWN`

## 7. UX 원칙

- Private가 기본값이다.
- 저장 위치와 공개 상태를 문구로 명확히 표시한다.
- 로그인 유도는 첫 카드 전에 막지 않는다.
- 이미지 권한 거부가 서비스 사용 불가로 이어지지 않는다.
- 사용자가 입력한 메모 원문은 분석 이벤트에 보내지 않는다.
- Board는 첫 카드 작성 성공보다 앞에 나오지 않는다.
- 공개할 수 없는 이유를 이미지 유형과 권리 상태에 따라 설명한다.

## 8. 주요 분석 이벤트

```text
card_creation_started
image_selected
system_design_selected
anime_selected
private_title_created
first_memory_card_saved
second_memory_card_saved
third_memory_card_saved
archive_revisited
first_board_created
card_added_to_board
login_prompt_shown
sync_enabled
private_image_backup_enabled
publish_requested
publish_approved
publish_rejected
report_submitted
user_blocked
backup_exported
account_deletion_requested
```

이벤트 속성에는 자유 텍스트, 이미지, 개인 Board 제목을 포함하지 않는다.

---

## 03. 저장소 감사 프로토콜

## 1. 목적

개발 전에 현재 저장소의 사실을 확인하고, 과거 문서의 상태 메모와 현재 제품 결정을 비교한다.

첫 감사에서는 코드 수정, 의존성 설치, 데이터 마이그레이션, 포맷 전체 변경을 하지 않는다.

## 2. 필수 산출물

```text
docs/moemoa/reports/repository-audit.md
docs/moemoa/reports/implementation-gap-analysis.md
docs/moemoa/reports/architecture-options.md
docs/moemoa/reports/open-decision-questions.md
```

각 주장은 파일 경로, 설정 키, 코드 심볼, 명령 결과 등 검증 가능한 근거를 포함한다.

## 3. 감사 순서

### 3.1 저장소 기본 정보

- Git root
- 현재 브랜치와 status
- 최근 커밋
- monorepo 여부
- package manager
- 언어와 프레임워크
- 앱·패키지·서버 디렉터리 구조
- README와 기존 AGENTS/CONTRIBUTING/architecture 문서

### 3.2 실행·테스트

- 설치 명령
- 개발 서버 명령
- production build
- unit/integration/E2E test
- lint/typecheck/format
- CI workflow
- 환경 변수 예시

위험한 명령은 실행하지 않고 문서만 확인한다. 안전한 상태에서 가능한 검증만 실행한다.

### 3.3 Web

- 라우팅
- 상태 관리
- API client
- 반응형 모바일 UX
- PWA/service worker 여부
- Archive·Library·Tier·Board 관련 기존 화면
- 인증·계정 화면
- 공개 페이지·SEO 구조
- 관리자 기능

### 3.4 Android

- Android 프로젝트 존재 여부
- native, hybrid, wrapper, cross-platform 여부
- Share Target/Intent filter
- Photo Picker 또는 갤러리 권한
- 로컬 DB
- 파일 저장
- offline queue
- deep link/App Link
- push notification

Android 코드가 없으면 현재 Web 스택과 재사용 가능한 경로를 비교한다.

### 3.5 백엔드

- API framework
- DB와 ORM
- migrations
- object storage
- auth/session
- queues/jobs
- rate limiting
- admin authorization
- background processing
- deployment configuration

### 3.6 작품 데이터

- AniList API 호출 위치
- 검색·상세·이미지 의존
- provider abstraction 여부
- aliases 또는 legacy data 파일
- 데이터 모델과 내부 ID
- 캐시와 영구 저장 구분
- source/provenance 필드
- admin import/edit tools

특히 다음을 확인한다.

```text
src/data/aliases.json 또는 동등 파일
anilistId 의존 관계
외부 이미지 URL 저장 방식
기존 migration 안정화 코드
```

### 3.7 Memory Card·Archive·Board

- 현재 Log/QuickLog/Library 엔터티
- 원자적 저장 보장
- 작품당 하나의 기록으로 제한되는지
- 이미지 연결 구조
- Board 또는 Tier 구조
- N:M 관계 가능성
- 데이터 export/restore/delete

### 3.8 계정·동기화

- 비로그인 식별자
- 로그인 시 로컬 데이터 처리
- sync source of truth
- conflict resolution
- offline state
- status UI
- logout·account deletion

### 3.9 이미지

- 이미지 입력 경로
- local URI/reference/copy 방식
- server upload
- thumbnail/resize
- EXIF 처리
- public/private storage
- CDN
- delete propagation
- external image kill switch

### 3.10 UGC 운영

- terms acceptance
- content report
- user report/block
- moderation queue
- takedown/appeal
- strike/suspension
- audit log
- feature flags
- admin roles

### 3.11 분석과 로그

- analytics provider
- crash/error tracking
- event schema
- PII redaction
- user note/image logging 위험
- version/release tagging

### 3.12 보안·개인정보

- secrets handling
- access control
- object storage ACL
- signed URLs
- data retention
- account deletion
- backups
- third-party processors

## 4. Gap 분류

| 등급 | 의미 |
| --- | --- |
| `KEEP` | 새 방향에서도 그대로 유지 |
| `ADAPT` | 기반은 유지하되 도메인·UX 수정 |
| `MIGRATE` | 데이터/구조를 단계적으로 이전 |
| `ISOLATE` | adapter 또는 feature flag 뒤에 격리 |
| `DEPRECATE` | 사용 중단 예정, 즉시 삭제 금지 |
| `REMOVE` | 승인된 마이그레이션 후 제거 |
| `UNKNOWN` | 증거 부족, 추가 확인 필요 |

## 5. 구현 Gap 표 형식

| 요구사항 | 현재 상태 | 근거 | Gap | 권장 조치 | 위험 | 승인 필요 |
| --- | --- | --- | --- | --- | --- | --- |

## 6. 아키텍처 옵션 보고 형식

각 옵션에 다음을 포함한다.

- 현재 코드 재사용 범위
- Web/Android 공유 방식
- native 기능 지원
- offline/local storage
- 배포 복잡도
- 테스트 전략
- 예상 마이그레이션
- 주요 장점·단점
- 권장안과 이유

## 7. 감사 단계 금지사항

- package lock 변경
- 자동 formatter 전체 실행
- DB migration 실행
- 코드 삭제
- legacy data 변환
- 전체 catalog scrape
- production credential 사용
- public feature enable

## 8. 감사 완료 조건

- 실행 가능한 앱·서버 단위를 식별했다.
- 기존 테스트와 실제 통과 여부를 확인했다.
- AniList와 외부 이미지 의존을 파일 단위로 추적했다.
- `legacy_unverified` 후보를 식별했다.
- Web+Android 구현 옵션을 현재 스택 근거로 비교했다.
- 첫 vertical slice를 시작하기 전에 필요한 사용자 결정 목록을 만들었다.
- 모든 불확실성을 사실처럼 표현하지 않았다.

---

## 04. 카탈로그 데이터와 수집 파이프라인 명세

## 1. 목적

여러 출처에서 필요한 raw facts를 수집하되, MOEMOA가 자체 내부 ID·스키마·정규화·검증·변경 이력을 운영할 수 있게 한다.

핵심 원칙:

- raw source record와 public catalog record를 분리한다.
- 사실 필드와 표현물·이미지를 분리한다.
- 출처·이용조건·수집 방법을 Source Registry에서 승인한다.
- 외부 값은 스키마를 바꿨다는 이유만으로 verified가 되지 않는다.
- 태그 어휘 후보와 작품별 태그 판단을 분리한다.
- 전체 수집 전에 대표 표본으로 파이프라인을 검증한다.

## 2. 수집 대상 필드

### Anime 기본

```text
id
nativeTitle
officialEnglishTitle
localizedTitles[]
releaseYear
season
startDate
endDate
format
episodeCount
status
officialSiteUrl
sourceMaterialType
```

### 조직·관계

```text
studios[]
animeRelations[]
```

### 분류

```text
coreGenres[]
catalogTags[]
```

### 인물

```text
characters[]
voiceActors[]
castings[]
```

## 3. 권장 엔터티

```text
Anime
AnimeTitle
AnimeRelation
Organization
AnimeOrganizationRole
Genre
CatalogTag
AnimeTag
Character
Person
Casting
SourceRegistry
SourceRecord
FieldClaim
CatalogRevision
PrivateTitle
LegacyIdentifier
```

## 4. Source Registry

모든 자동 수집 소스는 코드 작성 전에 Registry 항목을 가진다.

```text
sourceId
sourceName
baseUrl
sourceRole              // direct_import, official_verify, crosscheck_only, blocked
licenseOrTerms
termsUrl
allowedMethod           // api, dump, feed, crawl, manual
allowedFields
commercialUseStatus
persistentStorageStatus
redistributionStatus
rateLimit
robotsReviewedAt
termsReviewedAt
reviewedBy
status                  // approved, pending, blocked
notes
```

### 소스 역할

- `direct_import`: 명시적 재사용 범위 안에서 raw 적재 가능.
- `official_verify`: 공식 사이트의 사실 확인. 소개문·이미지 복사와 분리.
- `crosscheck_only`: 누락·오류·후보 발견. 프로덕션 값 자동 승격 금지.
- `blocked`: 자동 접근 또는 재사용 금지·불명확.

## 5. 파이프라인 단계

```text
Source fetch
→ Raw immutable staging
→ Parse
→ Normalize
→ Entity resolution / deduplication
→ Field claims
→ Conflict detection
→ Automated validation
→ Human review where required
→ Publish catalog revision
→ Incremental refresh
→ Audit and rollback
```

### 5.1 Raw staging

- 소스 원문/응답의 최소 필요 부분과 fetch metadata를 보존한다.
- public schema로 바로 overwrite하지 않는다.
- source record ID와 retrieval time을 기록한다.
- 재현 가능한 parser version을 기록한다.

### 5.2 Normalize

- 문자열 trim/Unicode normalization
- 날짜 표준화
- format/status mapping
- 조직·인물 이름 alias 처리
- locale별 title 구분
- null과 zero 구분

### 5.3 Entity resolution

작품 중복 판별 후보:

- native title
- release year
- format
- official site/domain
- source identifiers
- sequel/relation context
- studio and start date

자동 병합은 높은 신뢰도에서만 허용하고, 애매한 경우 review queue로 보낸다.

### 5.4 Field claims

한 필드에 여러 출처의 값이 있을 수 있다.

```text
FieldClaim
- entityType
- entityId
- fieldName
- normalizedValue
- sourceId
- sourceRecordId
- confidence
- status
- retrievedAt
- verifiedAt
- verifiedBy
```

상태:

```text
RAW
NORMALIZED
PENDING_REVIEW
VERIFIED
PUBLISHED
CONFLICTED
DEPRECATED
```

### 5.5 Publish

- public record는 승인된 FieldClaim으로 구성한다.
- 값 변경은 CatalogRevision에 남긴다.
- 이전 값을 복구할 수 있어야 한다.

## 6. 정규화 규칙

### 6.1 Format

권장 enum:

```text
TV
MOVIE
OVA
ONA
SPECIAL
MUSIC
WEB_SHORT
OTHER
UNKNOWN
```

외부 `TVA`, `TV Series`, `Web` 등은 raw 값을 보존하고 enum에 매핑한다.

### 6.2 Status

```text
ANNOUNCED
UPCOMING
AIRING
FINISHED
PAUSED
CANCELLED
UNKNOWN
```

미정 화수는 `null`이다. `0`으로 대체하지 않는다.

### 6.3 Season

- `WINTER / SPRING / SUMMER / FALL`
- 국가별 방송 분기와 일본 애니 분기 기준을 혼동하지 않는다.
- 날짜로 계산한 분기와 출처 표기를 구분할 수 있다.

### 6.4 작품 단위

명시해야 할 사례:

- 시즌 1·2
- 분할 2쿨
- TV와 감독판
- TV와 총집편 영화
- OVA·Special
- Web 선행 공개와 TV 방영
- 리메이크
- 같은 세계관의 독립 작품

### 6.5 Relation

```text
SEQUEL
PREQUEL
SIDE_STORY
SPIN_OFF
ADAPTATION
REMAKE
RECAP
ALTERNATIVE_VERSION
SHARED_UNIVERSE
CHARACTER_CROSSOVER
OTHER
```

관계는 directed edge로 저장하고, reciprocal edge 생성 규칙을 명시한다.

### 6.6 제작사 역할

```text
ANIMATION_PRODUCTION
CO_PRODUCTION
PRODUCTION_ASSISTANCE
PLANNING
PRODUCTION_COMMITTEE
DISTRIBUTOR
BROADCASTER
OTHER
```

### 6.7 Source material

```text
ORIGINAL
MANGA
LIGHT_NOVEL
NOVEL
WEB_NOVEL
GAME
VISUAL_NOVEL
WEBTOON
OTHER
MIXED
UNKNOWN
```

### 6.8 Characters and casting

```text
Character
- canonicalName
- localizedNames

Person
- canonicalName
- localizedNames

Casting
- animeId
- characterId
- personId
- language
- roleType
- creditedName
- verificationStatus
```

같은 캐릭터의 시즌별 성우 변경과 다국어 더빙을 구분한다.

## 7. 태그 체계

### 7.1 Core Genre

작은 고정 목록을 MOEMOA가 관리한다.

예:

```text
Action, Adventure, Comedy, Drama, Fantasy, Horror,
Mystery, Romance, Sci-Fi, Slice of Life, Sports,
Supernatural, Thriller
```

### 7.2 Catalog Tag

설정·주제·서사 속성.

```text
Setting: School, Historical, Space
Theme: Coming of Age, Revenge, Found Family
Narrative: Time Travel, Reincarnation, Body Swap
```

### 7.3 Memory Tag

사용자 개인 기억 태그.

```text
Comforting, Bittersweet, Made Me Cry, Quiet, Rewatch
```

### 7.4 외부 태그 처리

```text
external raw tag
→ TagCandidate
→ canonical mapping 제안
→ 관리자 승인
→ AnimeTag
```

외부 설명문, 가중치, 스포일러 판정은 자동 복제하지 않는다.

## 8. Legacy data

- 삭제하지 않는다.
- `legacy_unverified`로 격리한다.
- title matching, duplicate candidate, user search fallback에만 사용한다.
- public verified catalog로 자동 승격하지 않는다.
- migration은 source/provenance와 rollback을 포함한다.

## 9. PrivateTitle → public catalog 승격

```text
PrivateTitle 생성
→ 동일·유사 요청 집계
→ candidate 생성
→ 중복 검색
→ source claims 추가
→ 관리자 검토
→ public Anime 생성/병합
→ 기존 MemoryCard 연결 재지정
```

사용자의 원본 입력과 개인 alias는 손실하지 않는다.

## 10. 첫 표본 파이프라인

전체 수집 전에 다음 사례를 포함한 작은 표본을 사용한다.

- 다가오는 분기 신작
- 최근 인기 TV 시리즈
- 시즌·분할 2쿨
- Movie·OVA·ONA·Special
- 리메이크·총집편
- 다국어 제목 충돌
- 복수 제작사
- 다국어 성우
- 관계가 복잡한 프랜차이즈

표본 규모는 저장소와 소스 상황에 따라 정하되, 모든 정규화 예외를 포함하는 것이 목적이다.

## 11. 멱등성·오류·재시도

- 같은 source record를 재수집해도 중복 entity를 만들지 않는다.
- parser version 변경을 추적한다.
- 부분 실패를 전체 성공으로 표시하지 않는다.
- rate limit과 backoff를 적용한다.
- source unavailable 시 기존 published 값은 유지한다.
- conflict 자동 overwrite를 금지한다.

## 12. 데이터 품질 지표

- 필수 필드 완성률
- source coverage
- conflict rate
- duplicate candidate rate
- manual review backlog
- stale record count
- import failure rate
- source별 오류율
- PrivateTitle 검색 실패·승격 수

## 13. 관리자 기능 최소 범위

- source record 확인
- field claim 비교
- 승인·반려
- 작품·조직·인물 병합
- relation 편집
- tag mapping
- revision history
- CSV/JSON import preview
- rollback

## 14. 완료 조건

- Source Registry가 구현되어 승인되지 않은 소스가 실행되지 않는다.
- 표본 수집이 재실행 가능하고 멱등적이다.
- raw와 published 데이터가 분리된다.
- 필드별 출처가 추적된다.
- conflict가 자동으로 사라지지 않는다.
- legacy data가 안전하게 격리된다.
- PrivateTitle이 카탈로그 부족을 우회한다.
- 전체 수집 전 사용자 승인 게이트가 있다.

---

## 05. 이미지 UGC 정책·신고·관리 구현 명세

## 1. 목적

Pinterest처럼 시각적 수집과 공유의 자유도를 제공하되, 모든 이미지가 동일한 저장·공개·권리 상태를 갖는다고 가정하지 않는다.

정책 문서와 실제 시스템은 함께 구현한다.

## 2. 핵심 분리

### 입력 허용과 공개 허용

- 다양한 이미지를 카드에 연결하는 기능과 서비스 내 Public 권한을 분리한다.
- 사용자가 업로드했다는 사실은 공개 권리를 자동 증명하지 않는다.

### 일반 UGC 게이트와 이미지 권리 게이트

- 신고·차단·삭제 체계가 있어도 애니 캡처나 타인 팬아트의 권리가 자동 확보되지 않는다.
- `UGC-GATE-01`, `SCREENSHOT-PUBLIC-GATE-01`, `THIRD-PARTY-FANART-GATE-01`을 별도로 운영한다.

## 3. 이미지 유형

```text
SYSTEM_DESIGN
TEXT_DESIGN
USER_ORIGINAL
USER_CREATED_FANART
ANIME_SCREENSHOT
THIRD_PARTY_FANART
OPEN_LICENSE
PERMISSION_GRANTED
UNKNOWN
```

## 4. 저장 상태

```text
LOCAL_ONLY
PRIVATE_CLOUD
PUBLIC
```

### LOCAL_ONLY

- 기기에 저장.
- 비로그인 가능.
- Web에는 이미지 대신 디자인 카드 또는 로컬 전용 표시.
- 계정 로그인만으로 자동 업로드하지 않는다.

### PRIVATE_CLOUD

- 로그인 필요.
- 사용자의 명시적 백업 선택 필요.
- private object ACL/signed URL.
- Public 검색·피드에 포함하지 않는다.

### PUBLIC

- 로그인, 권리 메타데이터, 정책 동의, 게이트 통과 필요.
- 공개 파생본과 원본 수명주기를 분리한다.
- 신고·삭제·복구 대상이다.

## 5. ImageAsset 최소 모델

```text
ImageAsset
- id
- ownerId
- imageType
- storageScope
- visibility
- rightsBasis
- creatorName
- sourceUrl
- licenseType
- permissionEvidenceRef
- contentRating
- spoilerLevel
- moderationStatus
- exactHash
- perceptualHash
- originalObjectKey
- derivativeGroupId
- createdAt
- publishedAt
- restrictedAt
- deletedAt
```

## 6. 업로드·게시 흐름

```text
이미지 선택
→ 카드 Draft
→ 이미지 유형 선택/추론 보조
→ 출처·권리 입력
→ 정책 동의
→ PRIVATE quarantine upload
→ MIME·크기·해상도·악성 파일 검사
→ EXIF/GPS 제거
→ 안전한 포맷으로 재인코딩
→ exact/perceptual hash
→ 파생 이미지 생성
→ 자동 규칙
→ 필요 시 운영자 검토
→ 승인
→ PUBLIC object/CDN
```

Public 승인 전 원본을 공개 버킷에 두지 않는다.

## 7. 파일 처리

초기 권장:

- JPEG, PNG, WebP
- SVG 비허용
- 영상 비허용
- animated GIF는 후속 검토
- 실제 MIME 확인
- 확장자 불일치 차단
- 최대 크기·해상도 설정
- EXIF/GPS 제거
- 재인코딩
- 악성 파일 검사
- 썸네일·중간·공개용 파생본

구체 수치는 `STORAGE-01` 결정 후 설정한다.

## 8. 사용자 동의와 라이선스

업로드 시 최소 확인:

```text
[ ] 이 콘텐츠를 저장·게시할 권한이 있습니다.
[ ] 출처와 라이선스 정보를 정확히 입력했습니다.
[ ] 제3자의 개인정보·초상권을 침해하지 않습니다.
[ ] 콘텐츠 정책과 신고·삭제 절차에 동의합니다.
```

서비스 약관은 사용자의 권리 소유를 유지하면서, 사용자가 선택한 범위에서 저장·복제·포맷 변환·썸네일 생성·표시·전송하는 데 필요한 비독점적 라이선스를 정의한다.

서비스 홍보 활용은 별도 동의를 기본으로 한다.

## 9. 금지·제한 콘텐츠 범주

최소 정책 범주:

```text
COPYRIGHT_OR_LICENSE_VIOLATION
PRIVACY_OR_PERSONAL_DATA
IMPERSONATION
NON_CONSENSUAL_IMAGE
CHILD_SAFETY
SEXUAL_CONTENT
GRAPHIC_VIOLENCE
HATE
HARASSMENT
SELF_HARM
ILLEGAL_CONTENT
SPAM_OR_MANIPULATION
SPOILER_POLICY
OTHER
```

실제 문구와 연령 정책은 법률·스토어 검토 후 확정한다.

## 10. 신고 모델

```text
ContentReport
- id
- reporterId or contact
- targetType
- targetId
- reason
- jurisdiction
- description
- evidenceRefs
- priority
- status
- assignedTo
- resolution
- createdAt
- resolvedAt
```

### 신고 상태

```text
RECEIVED
TRIAGED
TEMP_RESTRICTED
UNDER_REVIEW
ACTIONED
REJECTED
APPEALED
RESTORED
CLOSED
```

## 11. 사용자 차단

- 차단한 사용자의 공개 카드·Board를 숨긴다.
- 차단 관계와 신고를 혼동하지 않는다.
- 차단이 원본 삭제를 의미하지 않는다.
- 관리자·안전 조사에는 필요한 범위에서 접근 가능하다.

## 12. ModerationAction

```text
ModerationAction
- id
- targetType
- targetId
- actionType
- policyVersion
- reasonCode
- actorType
- actorId
- userNotificationStatus
- appealAvailable
- createdAt
```

Action 예시:

- restrict visibility
- remove public derivative
- delete asset
- warning
- upload limit
- temporary suspension
- permanent suspension
- restore

## 13. 반복 침해자

```text
UserStrike
- userId
- strikeType
- severity
- sourceReportId
- status
- expiresAt
```

자동 영구 정지 규칙은 법률·운영 검토 없이 단순 횟수로 고정하지 않는다. 운영자가 근거와 이력을 볼 수 있어야 한다.

## 14. 이의제기

- 업로더에게 조치 사유와 정책 버전을 알린다.
- 이의제기 가능 여부와 기한을 표시한다.
- 원본 evidence와 action log를 보존한다.
- 복구 시 모든 파생 상태를 일관되게 복원한다.

## 15. 삭제 전파

한 이미지의 제한·삭제는 다음에 전파된다.

```text
원본 object
썸네일·리사이즈
CDN cache
Public MemoryCard
Public Board reference
검색 색인
추천 캐시
공유 미리보기
SavedReference
```

다른 사용자의 Board에는 파일을 복제하지 않고 원본 카드 참조만 저장한다.

## 16. 기능 플래그와 kill switch

최소 플래그:

- public publishing globally
- public image by imageType
- private cloud upload
- public Board
- public SavedReference
- new uploads pause
- public media hide all
- source/provider image disable
- country/region restriction

전역 이미지 숨김은 앱 업데이트 없이 동작해야 한다.

## 17. 초기 Public 권장 매트릭스

| 이미지 유형 | Private | Public v1 | 추가 게이트 |
| --- | ---: | ---: | --- |
| SYSTEM_DESIGN | 허용 | 후보 | generic UGC gate |
| TEXT_DESIGN | 허용 | 후보 | generic UGC gate |
| USER_ORIGINAL | 허용 | 후보 | 권리 동의·UGC gate |
| OPEN_LICENSE | 허용 | 후보 | 라이선스 표시·UGC gate |
| PERMISSION_GRANTED | 허용 | 후보 | 증빙·UGC gate |
| USER_CREATED_FANART | 허용 | 제한 후보 | 원작 IP 정책·국가 검토 |
| ANIME_SCREENSHOT | 허용 후보 | 비활성화 | screenshot rights gate |
| THIRD_PARTY_FANART | 로컬도 주의 | 비활성화 | 작가 허가·IP 정책 |
| UNKNOWN | LOCAL_ONLY | 금지 | 권리 상태 해결 |

## 18. 연령과 소셜 범위

초기 공개 베타 권장안:

- 18+ 검토
- 댓글·DM·멘션·채팅 제외
- Public 카드·Board 열람과 저장 참조만 제공
- 성인·폭력·스포일러 가림

최종 연령 정책은 `AGE-01`로 사용자 확정이 필요하다.

## 19. 관리자 도구

### Queue

- 신고 우선순위
- 이미지 미리보기
- 권리 메타데이터
- 작성자 이력
- 동일 이미지 그룹
- 관련 Board·SavedReference

### Actions

- temporary restrict
- approve/reject publish
- delete derivatives
- warn/suspend
- request evidence
- resolve appeal
- audit log

### Operational dashboard

- report volume
- response time
- repeat violation rate
- appeal/restoration rate
- queue age
- public upload count
- storage/egress cost

## 20. 개인정보·보안

- signed URL과 least privilege.
- private object를 public URL로 추측할 수 없어야 한다.
- 자유 텍스트와 이미지 bytes를 일반 로그에 남기지 않는다.
- 관리자 접근을 role-based로 제한한다.
- 신고자 정보와 피신고자 정보를 필요한 기간만 보관한다.
- 계정 삭제와 법적·감사 보존을 구분한다.

## 21. UGC 게이트 완료 조건

- 약관·정책 버전 동의 기록.
- 신고·차단·심사·삭제·이의제기 E2E.
- 원본·파생본·CDN 삭제 검증.
- 비공개 이미지 무단 접근 테스트.
- public kill switch 테스트.
- 운영 담당자와 SLA.
- 스토리지·전송 비용 측정.
- generic UGC gate와 별도 rights gate 상태가 UI와 관리자 화면에 표시.

---

## 06. 아키텍처와 첫 Vertical Slice 계획

## 1. 아키텍처 원칙

- 하나의 도메인 모델과 백엔드.
- Web과 Android의 역할은 다르지만 데이터 의미는 동일.
- 기존 안정화 코드와 기술 스택을 최대한 재사용.
- native 기능은 adapter/bridge로 격리.
- offline/local-first와 cloud sync를 분리.
- public 기능은 private core 위에 추가.
- 외부 catalog provider와 image provider는 인터페이스 뒤에 격리.

## 2. 목표 논리 구조

```text
Web Client
Android Client
   │
   ├── Shared API contract / domain types
   │
Backend API
   ├── Auth and account linking
   ├── Catalog
   ├── Memory Card / Archive / Board
   ├── Sync
   ├── Image/UGC
   ├── Moderation/Admin
   └── Analytics event gateway

Data
   ├── relational database
   ├── local Android database
   ├── object storage
   ├── search/index as needed
   └── raw catalog staging
```

실제 디렉터리와 기술 선택은 저장소 감사 후 확정한다.

## 3. 도메인 경계

### Catalog domain

- Anime
- PrivateTitle
- Titles/Aliases
- Organization
- Character/Person/Casting
- Relation/Genre/Tag
- Source/FieldClaim/Revision

### Memory domain

- MemoryCard
- MemorySignal
- Archive queries
- Board/BoardCard
- SavedReference

### Identity/sync domain

- DeviceIdentity
- User
- AccountLink
- SyncOperation
- Conflict
- Export/Restore/Delete

### Media/UGC domain

- ImageAsset
- UploadSession
- Derivative
- PublishRequest
- Report/Block/ModerationAction/Appeal/Strike

## 4. 첫 Vertical Slice

목표:

> Android에서 이미지를 받아 Private Memory Card를 저장하고, Archive와 Board에서 확인한 뒤 선택 로그인으로 Web에서도 같은 카드를 볼 수 있게 한다.

### Slice 단계

1. Android image intake
2. 작품 검색/PrivateTitle
3. MemoryCard Draft/Complete
4. LOCAL_ONLY storage
5. Archive
6. Private Board
7. 로그인과 local account promotion
8. metadata sync
9. Web Archive/Board
10. export/delete

### Slice에서 제외

- Public publishing
- private cloud image backup
- full catalog ingestion
- complex recommendation
- comments/follows

## 5. 데이터 모델 최소안

```text
Anime(id, ...)
PrivateTitle(id, ownerId, title, ...)
MemoryCard(id, ownerId, animeId?, privateTitleId?, status, note?, ...)
ImageAsset(id, ownerId, imageType, storageScope, localRef?, ...)
Board(id, ownerId, title, visibility, ...)
BoardCard(boardId, memoryCardId, position, ...)
DeviceIdentity(id, ...)
User(id, ...)
SyncOperation(id, entityType, entityId, version, ...)
```

MemoryCard는 Anime 또는 PrivateTitle 중 정확히 하나에 연결된다.

## 6. Local-first 저장

### 원칙

- UI 성공 표시 전에 로컬 트랜잭션이 완료되어야 한다.
- 이미지 파일과 DB 레코드가 불일치하지 않도록 실패 보상 처리를 한다.
- sync는 저장 성공과 별도 상태다.

### 권장 상태

```text
LOCAL_SAVED
SYNC_PENDING
SYNCED
SYNC_FAILED
CONFLICT
```

## 7. 로그인 승격

- 비로그인 owner identity를 유지한다.
- 로그인 후 기존 로컬 entity ID를 가능한 한 유지한다.
- server ID와 local ID 관계를 명시한다.
- 중복 업로드 방지용 idempotency key를 사용한다.
- 이미지 백업은 별도 opt-in.

## 8. 동기화 충돌

최종 규칙은 `SYNC-01`에서 확정한다. Codex는 다음 옵션을 비교한다.

### Card scalar fields

- version + last-write-wins
- field-level merge
- explicit conflict UI

### Board order

- position token/lexicographic ordering
- operation log
- server canonical list

### Delete versus edit

- tombstone 우선
- grace period 복구
- conflict prompt

어떤 규칙을 선택하든 삭제된 카드가 다른 Board나 Web에서 재생성되지 않아야 한다.

## 9. Web/Android 코드 공유

저장소 감사 후 다음을 비교한다.

- 기존 responsive Web + native Android shell
- cross-platform UI reuse
- shared TypeScript/domain package + native Android UI
- PWA + native bridge

평가 기준:

- 현재 코드 재사용
- Share Target/Photo Picker
- local DB/offline
- file lifecycle
- Web SEO/public pages
- build/release complexity
- tests

Codex는 저장소 근거 없이 특정 프레임워크를 확정하지 않는다.

## 10. Catalog provider 격리

```text
CatalogProvider interface
- searchTitles
- getTitleCandidate
- fetchUpdates
```

외부 provider 결과는 raw/candidate로 취급한다. public catalog write는 ingestion pipeline을 통과한다.

AniList 런타임이 남아 있다면:

- provider adapter 뒤에 격리
- failure fallback
- new code에서 직접 호출 금지
- 제거 계획과 테스트

## 11. 이미지 추상화

```text
MediaRepository
- importLocalImage
- createSystemDesign
- uploadPrivate
- requestPublish
- deleteAsset
- getDisplaySource
```

Web은 LOCAL_ONLY 원본을 가정하면 안 된다.

## 12. feature flags

- new catalog
- private title
- new memory card
- board
- sync
- private image backup
- public publishing
- image type public permissions
- provider cutover

## 13. 마이그레이션 원칙

- 기존 데이터를 즉시 삭제하지 않는다.
- dual-read/dual-write가 필요하면 기간과 종료 조건을 계획한다.
- migration version과 rollback을 둔다.
- user-visible data count를 전후 비교한다.
- backups와 dry-run을 사용한다.

## 14. 첫 Slice 수용 기준

- Android에서 이미지를 받아 저장 전 검토 가능.
- 검색 실패 시 PrivateTitle로 계속 진행.
- 작품 + visual이 없으면 Complete가 되지 않음.
- 네트워크 없이 카드·Archive 저장.
- 카드 3개 후 Board 제안.
- 같은 카드를 여러 Board에 추가.
- 로그인 실패에도 로컬 데이터 유지.
- metadata sync 후 Web에서 동일 카드 확인.
- LOCAL_ONLY 이미지는 Web에서 오해 없는 대체 표시.
- export와 deletion 기본 동작.
- analytics에 note/image가 포함되지 않음.

## 15. 구현 순서

```text
observability/feature flags
→ domain model and local persistence
→ Android image intake
→ catalog search/private title
→ MemoryCard
→ Archive
→ Board
→ account promotion/sync
→ Web surfaces
→ export/delete
→ private cloud image
→ UGC foundation
```

## 16. 완료 보고

각 milestone 후 다음을 기록한다.

- 사용자 흐름 데모
- 변경 파일
- schema/API 변경
- 테스트 결과
- analytics events
- migration status
- known limitations
- next gate

---

## 07. QA·분석·출시·운영 기준

## 1. QA 계층

```text
Unit
→ Integration
→ Contract
→ Migration tests
→ E2E
→ Device/browser matrix
→ Alpha
→ Closed beta
→ Limited public beta
```

## 2. 핵심 E2E 시나리오

### Private card

- Share Target success/cancel
- Photo Picker permission/path
- image missing after selection
- system design fallback
- offline save
- duplicate submit
- app restart

### Catalog

- public search
- no result → PrivateTitle
- duplicate candidate
- source conflict
- provider failure

### Board

- add one card to multiple Boards
- reorder
- remove reference
- delete original card

### Login/sync

- guest → login
- login failure
- duplicate account link
- offline edit then sync
- conflict
- logout
- account deletion

### Image

- LOCAL_ONLY
- explicit PRIVATE_CLOUD opt-in
- public publish request
- delete original and derivatives
- signed URL expiration
- unauthorized access

### UGC

- report content
- report user
- block user
- temporary restrict
- appeal
- restore
- repeat violation
- kill switch

## 3. 출시 차단 결함

- 데이터 손실
- 계정 간 데이터 혼합
- Private 이미지/카드의 잘못된 공개
- 계정 삭제 불능
- 신고된 이미지 파생본 잔존
- 동기화가 로컬 기록을 덮어씀
- public kill switch 실패
- analytics/logs에 사용자 note 또는 이미지 노출

## 4. 내부 품질 기준

정확한 수치는 베타 계획에서 확정하되 최소한 다음을 측정한다.

- card save success
- crash-free users/sessions
- sync success/failure/conflict
- export/restore success
- account deletion completion
- report processing time
- public asset deletion propagation
- app start and card creation latency

## 5. 제품 지표

### Activation

- 카드 작성 시작 → 첫 Complete 카드 저장
- 첫 카드 작성 시간
- public search failure
- PrivateTitle completion
- image type split
- Android Share Target completion

### Retention

- D1/D7/D30 meaningful behavior
- second/third card
- Archive revisit
- Board create/use
- same anime previous card open

### UGC

- publish request/approval/rejection
- report rate
- repeat violation
- appeal and restoration
- moderation queue age

### Cost

- image storage per active user
- derivative count
- egress
- catalog ingestion cost
- moderation time per report

## 6. Meaningful behavior

다음 중 하나 이상:

- Memory Card 작성
- 과거 카드 열람
- Board 추가·정렬
- 회고/재발견
- 다시 보고 싶은 카드 확인

단순 앱 실행과 로그인만으로 리텐션을 계산하지 않는다.

## 7. 이벤트 개인정보 규칙

보내지 않는 데이터:

- note 원문
- image bytes/URI/object key
- private Board title/description
- 자유 검색어 전체
- 개인 이름·장소

허용 가능한 구조화 속성:

- platform
- app version
- entry route
- image type/storage scope
- public/private title
- field count
- duration
- result/error code

## 8. 베타 게이트 작업 기준

초기 내부 목표 예시:

| 지표 | 작업 기준 |
| --- | ---: |
| first card completion | 55% 이상 |
| median first card time | 90초 이하 |
| D7 second card | 30% 이상 |
| D7 meaningful retention | 25% 이상 |
| D14 3 cards | 25% 이상 |
| 3+ card users Board create | 35% 이상 |
| search failure abandonment | 20% 미만 |

이는 업계 표준이 아니라 MOEMOA의 초기 판단 기준이며, 실제 코호트 크기와 데이터 품질을 함께 본다.

## 9. 릴리스 단계

### Ring 0

- CI, unit, integration, migration.

### Ring 1

- 내부 alpha.
- 실제 기기와 브라우저.

### Ring 2

- 관찰형 사용자 테스트.
- 첫 카드와 Board 이해.

### Ring 3

- closed beta.
- 반복 사용과 비용.

### Ring 4

- limited public beta.
- UGC 운영량과 게이트.

## 10. Public UGC 출시 게이트

- 일반 UGC gate 통과.
- 허용 imageType 목록 승인.
- 신고·차단·삭제·이의제기 E2E.
- moderator account와 access control.
- kill switch.
- privacy/security review.
- account deletion Web 경로.
- operating hours and SLA.
- cost alert.

애니 캡처·타인 팬아트는 별도 gate를 확인한다.

## 11. 모니터링 주기

| 주기 | 항목 |
| --- | --- |
| 매일 | 저장 오류, crash, private exposure, reports, queue |
| 릴리스 2h/24h/72h | 버전별 오류·퍼널 비교 |
| 매주 | activation, second card, D7, Board, catalog failures |
| 격주 | user interview, support taxonomy |
| 매월 | D30, country/channel, cost, UGC operations |

## 12. 장애 등급

### P0

- data loss
- cross-account access
- private/public leak
- auth bypass
- deletion failure

즉시 flag off/rollback.

### P1

- card save failure spike
- app start failure
- sync/export failure
- Share Target crash

당일 대응.

### P2

- Board ordering UI
- alias missing
- minor layout/copy

다음 릴리스.

## 13. 운영 문서

- incident runbook
- release checklist
- moderation handbook
- catalog editorial guide
- source registry
- event dictionary
- data retention map
- decision log
- experiment log

## 14. 배포 승인 전 Codex 보고

- exact version/commit
- migrations
- feature flags
- tests
- known issues
- rollback commands
- data backup status
- monitoring links/config
- UGC gates
- user-visible policy changes

---

## 08. Codex 단계별 행동 지침

## Phase 0 — 문서 설치와 지침 충돌 확인

### 참고 문서

- `AGENTS.md`
- `CODEX_START_HERE.md`
- `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`

### 행동

- 기존 저장소 지침을 찾는다.
- 패키지 지침과 충돌을 표로 만든다.
- 기존 빌드·테스트 명령은 보존한다.

### 산출물

- `reports/instruction-merge-report.md`

### 금지

- 코드 수정
- 기존 AGENTS 덮어쓰기

### 승인 게이트

- 지침 병합 확인

---

## Phase 1 — Repository Audit

### 참고 문서

- `03_REPOSITORY_AUDIT_PROTOCOL.md`
- `00_SESSION_HANDOFF_AND_CONTEXT.md`

### 행동

- read-only 조사.
- 앱·서버·데이터·이미지·인증·테스트 지도.
- 과거 상태 메모를 재검증.

### 산출물

- repository audit
- gap analysis
- architecture options
- open decisions

### 완료 조건

- 모든 핵심 주장에 repository evidence.
- 현재 실행 가능한 테스트 확인.

### 금지

- package install/upgrade
- migration
- mass format

### 다음 프롬프트

- `02_ARCHITECTURE_AND_EXECPLAN.md`

---

## Phase 2 — Architecture Decision and ExecPlan

### 참고 문서

- 감사 결과
- `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- `PLANS.md`

### 행동

- 2~3개 기술 옵션 비교.
- 현재 스택 재사용을 기본으로 권장.
- 첫 vertical slice ExecPlan.
- schema/API/migration/test/rollback 포함.

### 산출물

- `reports/architecture-decision-proposal.md`
- `plans/first-vertical-slice.md`

### 승인 게이트

- 사용자 기술안 선택
- migration 범위 승인

### 금지

- 대규모 구현
- 새 production dependency 확정

---

## Phase 3 — Catalog Foundation

### 참고 문서

- `04_CATALOG_DATA_AND_INGESTION_SPEC.md`
- Source Registry template
- approved ExecPlan

### 행동

1. Source Registry.
2. raw staging.
3. internal IDs.
4. normalization enums.
5. FieldClaim/revision.
6. sample ingestion.
7. dedupe/conflict/idempotency tests.
8. legacy isolation.

### 산출물

- schema/migrations
- sample import tool
- catalog quality report
- source registry entries

### 완료 조건

- sample rerun without duplicates.
- source provenance available.
- provider failure does not block PrivateTitle.

### 승인 게이트

- full ingestion gate.

### 금지

- unapproved source automation
- full catalog crawl
- legacy deletion

---

## Phase 4 — Private Vertical Slice

### 참고 문서

- `02_PRODUCT_SCOPE_AND_USER_FLOWS.md`
- `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`

### 구현 순서

1. domain model/local DB.
2. Android image intake.
3. catalog search/PrivateTitle.
4. Draft/Complete MemoryCard.
5. LOCAL_ONLY image lifecycle.
6. Archive.
7. Board N:M.
8. account promotion.
9. metadata sync.
10. Web Archive/Board.
11. export/delete.

### 각 milestone 보고

- files changed
- demo flow
- tests
- events
- known limitations

### 완료 조건

- offline card.
- no data loss on login.
- Web sees synced metadata.
- local image state not misrepresented.

---

## Phase 5 — Private Cloud Image

### 참고 문서

- `05_IMAGE_UGC_POLICY_MODERATION_SPEC.md`
- architecture ExecPlan

### 행동

- explicit opt-in.
- quarantine/private storage.
- signed URL.
- derivatives.
- deletion propagation.
- quota and cost metrics.

### 완료 조건

- login alone never uploads.
- unauthorized access tests pass.
- delete removes all objects.

### 승인 게이트

- storage limits/cost.

---

## Phase 6 — UGC Foundation

### 참고 문서

- `05_IMAGE_UGC_POLICY_MODERATION_SPEC.md`
- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`
- UGC launch gate template

### 행동

- terms acceptance.
- rights metadata.
- publish request.
- report content/user.
- block.
- moderation queue.
- action/notification.
- appeal/restore.
- strike/suspension.
- audit log.
- kill switch.

### 완료 조건

- all E2E gate scenarios.
- public off by default.

### 승인 게이트

- UGC-GATE-01.

---

## Phase 7 — Limited Public

### 행동

- allowlisted imageTypes only.
- initially small tester group.
- optional pre-moderation.
- public card/Board URL.
- SavedReference points to original.
- report and takedown operations.

### 금지

- anime screenshot public without gate.
- third-party fanart public without permission gate.
- comments/DM.

### 완료 조건

- deletion propagates.
- public/private transitions are correct.
- moderation capacity measured.

---

## Phase 8 — QA and Closed Beta

### 참고 문서

- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`

### 행동

- matrix tests.
- migration rehearsal.
- performance.
- privacy/security.
- activation/retention dashboards.
- user observation.

### 산출물

- beta readiness report
- known issue register
- rollback rehearsal report

### 승인 게이트

- closed beta launch.

---

## Phase 9 — Launch and Operations

### 행동

- release checklist.
- flag configuration.
- monitoring.
- moderator coverage.
- incident response.
- cohort review.

### Codex 역할

- release evidence 정리.
- 자동화·대시보드·runbook 지원.
- 사업·법적 최종 승인 대신하지 않음.

---

## Phase 10 — Post-launch Iteration

우선순위:

1. card creation friction.
2. second/third card.
3. Archive revisit.
4. Board retention.
5. catalog failures.
6. image cost.
7. report operations.

Public feed, follows, AI, ads, subscription은 core retention이 확인된 뒤 별도 Decision Log와 ExecPlan으로 시작한다.

## 공통 작업 규칙

### 작업 시작

```text
- 이번 작업의 결정 ID
- 읽은 문서
- current repository evidence
- scope/exclusions
- test plan
```

### 작업 중

- plan progress 업데이트.
- 예상 밖 발견 기록.
- 결정 충돌 시 중지.

### 작업 종료

```text
- user-visible outcome
- changed files
- commands/tests
- migrations/rollback
- privacy/rights/security
- analytics
- remaining risks
- next gate
```

---

## 09. 변경 통제와 보고 규칙

## 1. 문서의 Source of Truth

- 제품 결정: `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`
- 구현 계획: 승인된 ExecPlan
- 현재 기술 사실: repository code/tests/config
- 데이터 수집 규칙: `04_CATALOG_DATA_AND_INGESTION_SPEC.md`
- 이미지·UGC: `05_IMAGE_UGC_POLICY_MODERATION_SPEC.md`

## 2. Decision Log

새 결정을 만들거나 변경할 때:

```text
ID
status
context
options
chosen option
reason
consequences
files/modules affected
migration impact
review date/trigger
approved by/date
```

Codex가 제안한 결정은 `PROPOSED`로 작성한다. 사용자 승인 후 `CONFIRMED`로 변경한다.

## 3. ADR와 Decision Log 구분

- 제품·정책·범위: Decision Log.
- 기술 선택과 trade-off: ADR.
- 둘이 연결되면 상호 참조한다.

## 4. 변경 크기

### Small

- 한 모듈, schema 없음, behavior 제한.
- 간단한 task plan 가능.

### Medium

- 여러 파일, API 변화, feature flag.
- 짧은 ExecPlan 필요.

### Large

- DB migration, cross-client, provider replacement, UGC, security.
- 전체 ExecPlan과 승인 필수.

## 5. 커밋 원칙

- docs/decision 먼저.
- schema/migration과 application change를 추적 가능하게 분리.
- generated bulk data를 코드 변경과 같은 커밋에 섞지 않음.
- destructive cleanup은 cutover 검증 뒤 별도 커밋.

권장 예:

```text
docs: record catalog provenance decision
feat(catalog): add raw source and field claim schema
feat(catalog): add sample importer
migrate(catalog): mark legacy aliases unverified
```

## 6. Pull request / 변경 보고

필수 항목:

- why
- related decision/plan
- what changed
- screenshots/demo if UI
- schema/API
- tests
- migration/rollback
- feature flags
- analytics
- security/privacy/rights
- known limitations

## 7. 테스트 증거

단순히 “테스트 통과”라고 쓰지 않는다.

```text
Command:
Environment:
Result:
Coverage/scenario:
Failure or skipped reason:
```

## 8. 마이그레이션 보고

- before counts
- after counts
- unmatched/conflicts
- duration
- backup reference
- rollback result
- user-visible impact

## 9. 문서 갱신 조건

| 변경 | 갱신 문서 |
| --- | --- |
| 카드 필드·상태 | `01`, `02`, API/schema docs |
| catalog field/source | `04`, Source Registry |
| image state/public | `01`, `05`, policy |
| architecture | `06`, ADR, ExecPlan |
| event/KPI | `07`, event dictionary |
| phase/gate | `08`, gate checklist |

## 10. Codex 리뷰 규칙

리뷰 시 우선순위:

1. data loss/private exposure/security.
2. confirmed decision violations.
3. migration correctness.
4. offline/sync correctness.
5. report/delete propagation.
6. tests and observability.
7. maintainability/performance.
8. style.

각 finding은 severity, evidence, impact, fix path를 포함한다.

---

## Codex 최초 프롬프트 — 저장소 감사

이 저장소에서 MOEMOA 작업을 시작한다.

먼저 `AGENTS.md`, `CODEX_START_HERE.md`, `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`, `docs/moemoa/03_REPOSITORY_AUDIT_PROTOCOL.md`를 읽어라. 그 다음 저장소 루트와 기존 프로젝트 지침, README, package/build/test 설정을 확인하라.

이번 단계에서는 코드, lockfile, 설정, 데이터 파일을 수정하지 마라. 의존성을 설치·업그레이드하지 말고, DB migration이나 전체 formatter를 실행하지 마라. 안전한 read-only 명령과 이미 준비된 비파괴 검증만 사용하라.

다음을 증거 기반으로 감사하라.

1. Web, Android, backend, database, auth, local storage, sync 구조.
2. 현재 프레임워크와 재사용 가능한 코드.
3. AniList runtime search/detail/image dependency.
4. aliases/legacy data와 internal ID/provenance 상태.
5. 현재 log/library/tier/card/board 모델.
6. image intake, local file lifecycle, upload/public state.
7. analytics, crash/error logs, PII 위험.
8. unit/integration/E2E, CI/CD, build status.
9. 기존 문서의 2026-08-10 상태 메모와 현재 코드의 차이.
10. Web + Android, image-first Memory Card, Archive, Board, local-first account 모델을 구현하기 위한 Gap.

모든 핵심 주장에 파일 경로와 가능한 경우 line range 또는 code symbol을 포함하라. 확인되지 않은 사실은 UNKNOWN으로 표시하라.

다음 문서만 새로 작성하라.

- `docs/moemoa/reports/repository-audit.md`
- `docs/moemoa/reports/implementation-gap-analysis.md`
- `docs/moemoa/reports/architecture-options.md`
- `docs/moemoa/reports/open-decision-questions.md`

`architecture-options.md`에는 현재 스택을 최대한 재사용하는 안을 포함해 2~3개 옵션을 비교하라. 아직 권장안을 구현하지 마라.

마지막 응답에는 읽은 지침, 실행한 명령, 생성한 문서, 가장 큰 5개 Gap, 사용자 결정이 필요한 항목을 요약하라.

---
