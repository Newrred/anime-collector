# Pro 리뷰 후속 개선 ExecPlan

## 1. 목적과 사용자 결과
같은 작품에 기억을 누적하고 다시 찾으며 보관 범위를 이해할 수 있는 경험을 완성한다. 9월 11일 리뷰와 홈 재발견 보완서를 함께 적용한다.
## 2. 관련 확정 결정
9월 22일 사용자가 두 리뷰 후속 작업 진행을 지시했다. 기존 표지 갤러리·열 조절·태그·두 보기, 독립적인 작품 저장/Memory, private owner 경계를 유지한다.
## 3. 현재 상태와 저장소 증거
HEAD 3fb09a7 및 기존 미커밋 개발 상태. updateMemoryCard의 개인 신호 검증 누락, titleAlbumProjection null→0, TitleHub의 ANIME 전용 작성 CTA, Home의 legacy 활성 조건이 남아 있다.
## 4. 범위
### 포함
P0 정합성·개인 작품 재기록·오류 분리·백업 범위, 자체 카탈로그 시청 관리 검토. P1 홈 재발견, Memory 썸네일/보드 이미지, Archive 탐색. 각 묶음의 재현과 회귀 검증.
### 제외
운영 배포/DB 쓰기, 자동 데이터 병합·삭제, Public·이미지 cloud 활성화, 새 원격 시청 상태 sync, 고급 P2 분석. Web 작성 순서·저장 해제 의미 등 기존 결정을 바꾸는 선택지는 별도 기록한다.
## 5. 아키텍처·데이터 흐름
기존 domain/application/repository 경계 유지. 개인 작품 ID 명시 선택, owner-scoped 조회. 재발견은 Memory 원본의 읽기 모델이며 소수 이미지 후보만 로드한다.
## 6. 변경 파일 지도
src/features/memory, src/features/titles, src/components/home, src/domain/search, src/messages, tests/unit 및 브라우저 회귀, 본 계획과 보고서.
## 7. 데이터·스키마 마이그레이션
운영 마이그레이션 없음. 기존 로컬 데이터를 보존한다. 백업 기능은 검증 가능한 범위부터 명시하고 원본 파일 자동 업로드는 하지 않는다.
## 8. 마일스톤
1. 수정 시 신호 유지·미평가 유지·기존 개인 작품 선택. 2. 읽기 오류 구분·저장 범위. 3. 홈 재발견·썸네일·보드·탐색. 4. 단위/브라우저/build/React Doctor 및 기록.
## 9. 테스트와 검증
수정 전 재현→수정 후 회귀, owner 침범/마지막 신호 삭제/미평가 0 구분/동명 비병합/안정적 재발견·중복 제외. 격리 브라우저 390/1440 및 필요한 320 확인. npm run test:unit, npm run build, 관련 E2E, React Doctor.
## 10. 보안·개인정보·권리 영향
실제 사용자 브라우저/운영 DB 변경 없음. 기존 표지 참조 사용 계약 유지. 개인 기록 로그 출력 금지.
## 11. 관찰 가능성·분석 이벤트
기존 이벤트 유지. 재발견 원문을 analytics로 전송하지 않는다.
## 12. 롤백·복구
작업 직전 소스 사본을 상위 .moemoa-improvements-2026-09-22/baseline에 보존. 기존 미커밋 변경을 포함한 git reset은 사용하지 않는다.
## 13. 위험과 완화
리뷰의 인메모리 재현과 실제 브라우저 결과를 구분한다. OAuth/native 미검증을 완료로 올리지 않는다. 기존 테스트 fixture의 불완전한 domain 필드를 실제 계약에 맞게 보완한다.
## 14. 필요한 사용자 결정
후속 개선 구현 승인됨. 미정 제품 선택·운영 배포는 이번 승인으로 자동 확정하지 않는다.
## 15. 진행 기록
2026-09-22 착수. 현재 코드에서 R01/R02/R03 및 홈 분기를 재확인했다.
## 16. 발견 사항과 계획 변경
실제 IndexedDB에서 기존 PrivateTitle 재삽입 실패를 발견해 재사용 reservation/completion과 복구 경로까지 수정했다. 새 백업은 metadata만 지원하며, 기존 보관함 교체 대신 빈 로컬 보관함 복원으로 제한해 단일 transaction을 검증했다. 별도 저장소의 catalog-only 저장 상태는 독립 파일/transaction으로 처리한다. 카탈로그 실패를 오류로 분리하면서 로컬 저장 작품 fallback 회귀가 발생해 복구했다. 홈·보드의 작은 시스템 디자인은 장식 중심으로 바꿔 글자 잘림을 제거했다.
## 17. 완료 보고
핵심 개선 첫 묶음 완료. 단위 236/236, build PASS. 브라우저 통합 46개 중 45 PASS/1 FAIL 후 원인 수정, 영향 suite 2/2 PASS. React Doctor 49→49 및 기존 경고 수 유지. 격리 화면 10장, page error/가로 overflow 0. 전체 리뷰 완료나 배포가 아님. 상세 변경·남은 W05/W07/W08 및 실제 계정/native gate는 [결과 보고서](../reports/2026-09-22-pro-review-improvements.md)를 따른다.
