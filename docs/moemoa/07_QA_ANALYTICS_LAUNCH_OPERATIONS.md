# 07. QA·분석·출시·운영 기준

> **문서 상태: `CURRENT QA/OPERATIONS SPEC`**
> 테스트·privacy-safe analytics·운영 안전 기준은 현행이다. 베타 규모와 성공 수치는 `BETA-01` 승인 전 제안값이다.

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

> **상태: `PROPOSED INTERNAL TARGET`**
> 아래 수치는 `BETA-01` 승인 전 판단 예시이며 출시 약속이나 확정 KPI가 아니다.

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
