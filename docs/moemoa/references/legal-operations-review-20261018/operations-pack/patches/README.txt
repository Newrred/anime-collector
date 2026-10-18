# 관리자 한도 적용 범위 라벨 수정 후보

2026-10-18. 원본 검토 패키지는 수정하지 않았다. 이 문서와 `admin_quota_scope_labels.patch`는 적용 전 검토물이다.

## 문제와 근거

`src/components/AdminDashboard.jsx` 113–119행은 모든 항목의 한도를 계정별이라고 설명한다. 실제 `IMAGE_DELIVERY`, `IMAGE_DELIVERY_BYTES`는 전역이다. `supabase/migrations/20260924115258_memory_resource_controls.sql` 125–128행은 두 소비량을 전역 actor `00000000-0000-0000-0000-000000000000`에 기록하고, 142행은 개인 사용량 응답에서 이 두 항목을 제외한다. 최신 `docs/moemoa/release-v2/02_ACCEPTANCE_CONTRACTS.md` 59–62행에도 2,000 GET/UTC일 및 64,000,000 B/UTC일의 전역 한도가 명시돼 있다.

현재 숫자가 작아 보이는 문제가 아니라 운영자가 사용자 한 명당 허용량으로 오해할 수 있는 표시 오류다.

## 패치의 정확한 범위

- 사용량의 UTC 일자 기준을 유지한다.
- `한도 적용 범위 / Limit scope` 열을 추가한다. 위 두 scope에는 `서비스 전체 / Service-wide`, 나머지 현재 항목에는 `계정별 / Per account`를 표시한다.
- `일일 한도 / Daily limit`, `보유 한도 / Live limit`로 열 이름을 수정한다.
- 기존 영문 UI 검사의 열 이름 기대값 한 곳을 함께 맞춘다. 새로운 테스트 묶음은 만들지 않는다.

계산·quota 값·서버 호출·권한·활성화·삭제 로직·백업·배포 설정은 패치에 없다. 향후 새로운 전역 scope가 추가되면 표시 분류도 함께 추가해야 한다.

## 확인 결과

- 원본 `AdminDashboard.jsx` SHA-256: `9265dfcb86d8d7f53d5af3625cc6c0ef2874372bd9778c18afa66e6e0cff574b`.
- 원본 파일을 읽어 변경 후보를 만든 뒤 원본 내용 동일성을 확인했다.
- 원본 저장소 위치에서 `git apply --check`를 실행했고 종료 코드 0으로 적용 가능성을 확인했다. 실제 적용은 하지 않았다.
- 패치에는 `src/components/AdminDashboard.jsx`, `tests/admin-ui.spec.ts` 두 파일의 29줄 unified diff만 들어 있다.
- 브라우저 검사·build·배포는 실행하지 않았다. 따라서 화면 검증 PASS라고 주장하지 않는다.

## 구현 담당자의 최소 검증

실제 개발 checkout에 적용한 후 기존 격리 mock 검사 중 관리자 한글·영문 사용량 표와 320px 가로 스크롤 사례만 먼저 확인한다. 기존 `scripts/run-admin-e2e.mjs`는 실제 Supabase 설정을 지우고 로컬 mock URL을 사용한다. `tests/admin-ui.spec.ts` 92–134행에 필요한 기존 시나리오가 있다.

```sh
node scripts/run-admin-e2e.mjs --grep 'admin works with Public off|English labels keep'
```

보이는 두 전역 행과 개인 행의 범위, 기존 MiB 표기, 키보드로 표 영역 접근, 좁은 화면에서 페이지 전체가 넘치지 않는지만 확인하면 된다. DB·실제 계정·실제 사용량을 건드릴 이유는 없다. 실행에 필요한 로컬 의존성이 없으면 먼저 그 상태를 알리고, 이 문서의 소스 확인을 브라우저 검사로 확대해서 기록하지 않는다.

예상 작업은 적용·기존 화면 확인까지 약 0.25 집중일이다. 실제 배포는 검토자가 이 패치가 포함된 정확한 commit과 배포 대상을 승인한 뒤 진행한다.
