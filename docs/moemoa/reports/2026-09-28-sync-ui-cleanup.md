# 카드·사진 동기화 UI 정리 — 2026-09-28

## 범위와 근거

사용자가 사진 동기화를 찾기 어렵다고 느낀 카드 상세/계정 화면을 우선 정리했다. 서비스 전체 UI 개편 완료를 의미하지 않는다.
AGENTS.md, CODEX_START_HERE.md, 확정 결정 문서와 제품 흐름, release-v2 실행 계획 및 관련 컴포넌트/메시지/브라우저 테스트를 확인했다. ExecPlan은 `../release-v2/01_RELEASE_EXECUTION_PLAN.md`의 2026-09-28 카드·사진 동기화 화면 정리 항목이다.

## 변경

- MemoryPrivateImageSync.jsx: 사진 상태와 명시적 전송 버튼을 한 구역으로 통합. 저장 용량/대기 전송 취소는 접힌 상세에 배치. 버튼 옆 설명으로 비공개 사본 전송을 고지하고 버튼 클릭 때만 전송한다. 오류 상태를 로컬 전용으로 단정하지 않는다.
- MemoryCardDetail.jsx / memory-card-detail.css: 사진 동기화 구역을 제목 아래로 이동하고 간격/보조 정보 표시 정리.
- MemoryAccountPanel.jsx: 결과·오류·일반 설명의 중복 제거. 사용자가 중지했을 때 중지 상태 표시 유지.
- ko.js / en.js: Guest 승격, namespace, metadata 등 계정 안내의 내부 용어를 기록 가져오기/기록 동기화/사진 동기화로 변경.
- private-image-sync.spec.ts / memory-account-sync.spec.ts: 새 접근성 이름과 문구로 기존 동작 검사 유지. 사진 전송 전 요청0건, 동일 요청 재시도, 원본 보존, 계정 전환, 390px 너비 검사 및 화면 캡처.

## 검증

- `npm run test:unit`: 400 PASS.
- `npm run test:e2e -- tests/private-image-sync.spec.ts tests/memory-account-sync.spec.ts --project=chromium --workers=1 --reporter=line --output=test-results-ux`: 12 PASS. 사진 관련 두 개발 플래그 활성화, 합성 사진/모의 API 사용.
- Windows WebKit 사진 검사4건 실패: 계정 확인 실패로 이미지 선택 UI 미노출, IndexedDB MEDIA_STORAGE_FAILED, 보관함 카드 미표시. 원인 미확정. 실제 Safari 통과를 의미하지 않음.
- `npm run build`: 19 pages PASS.
- `npx react-doctor@latest --verbose --diff`: 74/100 유지, 경고18. 기존 복잡도 등의 진단은 이번 범위 밖이며 모두 해소됐다고 주장하지 않음.
- 모바일 캡처 직접 확인, 가로 넘침 없음. 스크린샷은 test-results-ux에 보관(합성 데이터).

## 데이터·보안·복구·남은 확인

DB/서버 설정/권한/공개 기능 변경 없음. 원본 파일 보존과 계정 격리, 이미지 사용권 및 공개 동의는 유지. 버튼을 누르지 않은 자동 사진 업로드 없음. 비밀값/개인 데이터를 새로 기록하지 않음. 소스 변경을 되돌리면 복구 가능.
이번 수정은 로컬 작업 상태이며 push/배포하지 않았다. 배포 전 WebKit 실패 원인 확인 및 실제 iPhone에서 사진 동기화 버튼과 이미지 표시 확인이 남아 있다. 전체 서비스 문구/화면 정리는 후속 범위다.
`n후속: 사용자 요청으로 실기기 검증용 preview 배포를 진행한다. WebKit 검사 실패는 해결된 것으로 표시하지 않으며 운영 배포 범위는 아니다.
