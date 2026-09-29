# Windows PC 작업 재개 — 2026-09-29

## 최신 소스
저장소 https://github.com/Newrred/anime-collector 의 `codex/phone-test`가 최신이다. 마지막 기능 변경은5d07217(2026-09-28 16:51 KST), 이후 본 인계 문서 커밋도 함께 받는다. master는 운영 배포 브랜치이므로 이전 목적으로 임의 병합하지 않는다.

새 checkout:
```powershell
git clone --branch codex/phone-test https://github.com/Newrred/anime-collector.git
cd anime-collector
npm ci
```

기존 checkout은 먼저 `git status`로 미커밋 작업을 확인·보존한다. 깨끗한 상태에서:
```powershell
git fetch origin
git switch codex/phone-test
git pull --ff-only origin codex/phone-test
npm ci
```
브랜치가 로컬에 없다면 `git switch --track origin/codex/phone-test`. 분기/변경이 있으면 강제 reset/clean 대신 비교한다.

## 재개 범위
AGENTS.md → CODEX_START_HERE.md → 확정 결정 → release-v2 실행 계획/진행판을 읽되9/28 후속 기록과 본 인계를 최신 상태로 반영한다.

- 완료: Safari 저장 수정, 테스트 metadata 불일치 복구, 사진 동기화 UI 정리, 홈/작품 상세/보관함/보드 및 `/titles/` Memory View의 원격 사진 연결, 계정별 탭 캐시, Vercel sin1 배치. 실제 PC 프리렌 사진 표시 확인.
- 사용자 확인: 아이폰 저장→PC 동기화/사진 표시, Android Chrome, 사진 선택 취소, 키보드 버튼 가림 문제없음. operations/2026-09-27-phone-web-check.md 참조.
- 미완료: ‘선택한 이미지 준비’ 클릭 후 변화를 모르겠다는 보고. MemoryPublicationPanel.jsx는 처리 결과를 버튼 옆이 아닌 상단에 표시한다. 해당 서버 요청의 실제 성공 여부는 미확인이며 UI 개선도 아직 구현하지 않았다. 공개 미리보기→게시→익명 열람→철회 실기기 검증은 남아 있다.
- 최신 사용자 방향: UI/레이아웃/폰트 위계/디자인 통일 및 장황하고 개발용인 문구 전반 정리. 참고 사이트를 요청했으나 아직 링크/시안 확정은 없다. 기존 갤러리 태그 검색·열 조절을 유지한다.
- 초기 다운로드/화면 준비 지연은 남는다. PC 반복 정책 요청214~244ms, 뒤로가기 사진 준비574ms. reports/2026-09-28-private-photo-latency.md 참조.

## 환경 및 검증
- Preview: https://anime-collector-git-codex-phone-test-newrreds-projects.vercel.app
- 테스트 DB: moemoa-test (`nmgkhknponvzcwliajyk`). 운영과 분리.
- **24시간 만료:** 사용량 관측은2026-09-28 07:11:52 UTC에 갱신. 이후24시간이 지나면 사진 정책이 다시 거부될 수 있다. 실제 사용량을 확인하고 tools/private-images/refresh-phone-test-observation-20260928.sql의 조건을 검토하여 갱신한다. 자동화 미완료. 관측시각을 무조건 연장하거나 제한을 제거하지 않는다.
- Git에는 로컬 env 비밀값·브라우저 로그인·원본 사진/IndexedDB·개인 Codex 설정이 없다. 필요한 개발 환경은 별도 구성한다. Vercel 환경 설정은 PC 이전으로 사라지지 않는다. 로그인/동기화로 받을 수 있는 사진은 서버에 연동된 사본이다.
- 상위 workspace 카탈로그 원본/checkpoint는 별도 자료다. UI 작업에는 불필요하나 전체 카탈로그 재생성 전 확보해야 한다.
- 마지막 검사: unit407 PASS, Chromium private-image-sync/title-collection8 PASS, build19 PASS, React Doctor72/100·20warnings(기존 동일). Windows WebKit 사진 검사의 기존 IndexedDB/계정 초기화 실패를 전체 PASS로 보고하지 않는다.

```powershell
npm run test:unit
npm run build
npx playwright install chromium
$env:PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1='1'
$env:PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1='1'
npm run test:e2e -- tests/private-image-sync.spec.ts tests/title-collection.spec.ts --project=chromium --workers=1 --reporter=line
```

배포는 Git 경로만 사용한다. 운영 master/DB/public 활성화는 별도 승인 범위. 이번 이전은 테스트 종료가 아니므로 서버 정리·데이터 삭제는 하지 않았다.
