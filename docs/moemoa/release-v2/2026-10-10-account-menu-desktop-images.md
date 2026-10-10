# 계정 메뉴 통합 · 데스크톱 이미지 입력

> **후속 운영 반영 완료:** 아래 본문은35d88ab의 로컬 완료 시점 기록이다. 이후 사용자 배포 승인으로 f428c60의 전체 CI 성공·master Git·Vercel Ready·실제 www 소스/새 UI 확인을 마쳤다. [최신 배포 결과](2026-10-10-latest-production-release.md)를 우선한다. DB/국가/Public 조건은 변경하지 않았다.

상태: 로컬 구현·회귀 검증 완료. 운영 배포/DB 변경 없음. 작업 브랜치 `codex/simple-signup-preview`, 시작 소스 `cc11aa4`.

## 1. 읽은 문서와 코드

`CODEX_START_HERE.md`, 확정 결정, 제품 흐름(02), 이미지 정책(05), 아키텍처(06), QA/운영(07), 변경 보고(09), Title Hub spec, PLANS 및 현 release-v2 계획을 확인했다. 메뉴는 `src/components/TopNavDataMenu.jsx`와 `auth/AuthSheet.jsx`, 데이터 화면은 `DataCenter.jsx`를 대조했다. 이미지 경로는 Web/native adapter, runtime ticket release, composer/detail/replacement, 기존 이미지·owner 회귀를 확인했다.

## 2. 가정과 미확인

- 계정 설정과 계정 및 데이터는 모두 기존 `/data/`로 가므로 새 화면 없이 한 진입점으로 합친다. 백업/복원/동기화/탈퇴는 삭제하지 않는다.
- 붙여넣기는 사용자가 발생시킨 브라우저 paste의 실제 File만 받는다. 일반 텍스트/HTML/URL에서 이미지를 다운로드하지 않는다.
- Windows/macOS 실제 캡처 앱→클립보드 왕복은 미실행이다. Chromium 합성 ClipboardEvent 검증을 OS 실기기 PASS로 확대하지 않는다. Safari/Firefox 실기기 검증도 이번에 하지 않았다.

## 3. ExecPlan

[단일 ExecPlan](01_RELEASE_EXECUTION_PLAN.md)의 「2026-10-10 — 계정 메뉴 통합과 데스크톱 이미지 입력」. 코드 변경 전에 작성했다. 기존 색/선/글자 기준을 유지하는 impeccable 간소화 기준으로 중복 메뉴·반복 상태를 줄였고 hero나 별도 디자인 체계를 추가하지 않았다.

## 4. 변경 파일과 이유

- `TopNavDataMenu.jsx`, `auth/AuthSheet.jsx`, `top-nav-readiness.css`, `messages/ko.js`, `messages/en.js`: 계정 및 데이터 진입점 1개, 같은 페이지 제목, 이름/이메일 중복 제거, 실제 의미에 맞는 계정 상태, 짧은 설명. 기존 로그인·로그아웃·관리자·백업/복원·탈퇴 유지.
- `features/memory/adapters/platform/webImageIntake.js`: `ingestFile(file)`로 검증/로컬 ticket 생성을 공유하고 기존 picker도 위임. 20MB/24MP, 실제 bytes/MIME, 정적 JPEG/PNG/WebP 검사 유지.
- `application/imageTransferFiles.js`, `components/useImageFileTransfer.js`: 실제 파일 추출, 한 장 제한, editable/화면 범위 guard, drop 피드백. 클립보드 권한 요청·백그라운드 읽기 없음.
- `MemoryCardComposer.jsx`, `useMemoryCardComposer.js`, `MemoryImageReplacement.jsx`, `MemoryCardDetail.jsx`: 새 이미지/교체 모두 연결. 연속 입력 잠금, 계정 변경·언마운트 후 늦은 ticket 정리, 이미지 교체 시 권리 확인 초기화. 제출 후 복구 journal 소유 ticket은 새 unmount 정리에서 제외한다. native claim 수명은 변경하지 않았다.
- `ImageInputHint.jsx`, `image-input.css`, `memory-card-composer.css`: drop/paste·캡처 단축키 안내, 키보드 포커스/드래그 표시, 이미지 영역의 과한 둥근 테두리/미리보기 바탕 여백 축소.
- 새 account-menu/desktop-image-input/desktop-image-lifecycle 및 단위/시각 테스트, `scripts/run-desktop-image-e2e.mjs`: 자격 증명을 넘기지 않는 재현 가능한 합성 검사.
- `tests/memory-card-discovery.spec.ts`: 새 계정 메뉴명, 이미 적용된 기록 시작 페이지 경로, 중복 status 선택자를 현행 계약과 일치시킴. 제품 경로 자체는 변경하지 않았다.
- `tests/unit/privateImages.test.mjs`, `publicImages.test.mjs`: Windows 제외 포트 EACCES도 기존 EADDRINUSE와 같이 최대16회 제한 재시도. OS 설정/검증 assert/skip은 변경하지 않았다.

## 5. 데이터·마이그레이션·복귀

DB/schema/data release 없음. 기존 IndexedDB ticket/assets 경로를 재사용한다. 이번 소스만 되돌리면 입력/메뉴가 원복되며 기존 이미지·카드·계정 기록을 삭제할 필요가 없다. 실제 운영/테스트 계정·사진을 변경하거나 삭제하지 않았다.

## 6. 검증 결과

- `npm run test:unit`: **585/585 PASS**, fail0/skip0. 초기 2회는 서로 다른 HTTP 테스트의 Windows random port EACCES로 실패했다. 제한 재시도 수정 후 전체 PASS. focused42는 전체585에 포함하며 합산하지 않는다.
- `node scripts/run-desktop-image-e2e.mjs`: **Chromium 51/51 PASS**, 1.5분. 계정 메뉴8, 새 drop/paste6, 경합4, 기존 composer19, discovery8, owner3, Web picker3. 이전 부분 실행21/24 등을 중복 합산하지 않는다.
- `npm run build`: **32 pages PASS**. `git diff --check` PASS.
- 시각 확인 1묶음: PC1280·390·320px. 메뉴/입력 영역 가로 넘침 없음. 합성 계정만 사용. `.cache/account-desktop-input/`에 `account-menu-{width}.png`, `image-input-{width}.png` 저장(로컬, Git 미포함).
- 검사 중 발견한 실제 오류: native details의 닫힘과 React onToggle 사이에 늦은 이미지를 채택할 수 있었다. DOM 가시성과 닫힌 details를 채택 직전에 검사하고 삭제된 이전 선택을 지우도록 수정했다. 지연 정리/접기/재열기 회귀 PASS.
- 초기 새 테스트의 중복 backup selector와 JPEG로 잘못 가정한 서버 최적화 형식은 실제 계약(WebP)에 맞게 수정했다. 원본 bytes 보존은 별도로 대조했다.

## 7. 보안·개인정보·권리·관찰

drop/paste는 로컬 미리보기만 만든다. 테스트에서 Save 전 업로드0, Save 후 기존 private 최적화 업로드, 원본 bytes/hash 보존을 확인했다. 로그인/flags·권리 확인·비공개 저장·Public off 유지. 파일명/이미지/클립보드 텍스트/키의 로그와 새 analytics 없음. DB·권한·의존성·외부 계약 변경0.

공식 참고: [MDN clipboardData](https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent/clipboardData), [getAsFile](https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/getAsFile), [paste](https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event), [Microsoft 화면 캡처](https://support.microsoft.com/en-us/office/copy-the-window-or-screen-contents), [Apple 화면 캡처](https://support.apple.com/guide/mac-help/take-a-screenshot-mh26782/mac). Windows는 Win+Shift+S 후 Ctrl+V, Mac은 Control+Shift+Command+4 후 Command+V. 사용자 이미지 영역/비편집 body에서만 처리하며 메모/input/contenteditable 붙여넣기는 가로채지 않는다.

## 8. 잔여와 다음 게이트

- 로컬 구현/자동 회귀는 완료. 이번 기능 운영 배포는 아직 하지 않았다. 운영 source/master는 앞선 가입 배포 `6a2beff` 상태를 유지하며 이 보고가 새 운영 적용을 뜻하지 않는다.
- Windows/macOS 실제 캡처→붙여넣기 확인은 별도 수동 점검. 특히 Mac 지원 구현과 Mac 실기기 검증은 구분한다.
- 운영 반영 승인 후에는 이 검토 소스를 master Git 배포하고 Vercel Ready와 실제 source SHA를 대조해야 한다. DB/국가 가입 조건/Public을 다시 변경할 필요는 없다.
