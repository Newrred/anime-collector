# 디자인 작업의 다른 PC 재개 ExecPlan

## 1. 목적과 사용자 결과

사용자가 현재 작업과 기록을 Git에 업데이트해 다른 PC에서 바로 이어가도록 요청했다. 최신 `codex/phone-test` 개발 체크포인트를 원격에 보존하고, PC 바깥에 있던 필름 시안을 저장소 안에서 실행할 수 있게 한다.

## 2. 관련 확정 결정

SHELF-ROW-PREVIEW-01, NO-HERO-UI-01, FILM-ARCHIVE-DIRECTION-01 유지. 이 요청은 개발 브랜치 commit/push 승인이지 master 병합·운영 배포·Public 활성화 승인이 아니다.

## 3. 현재 상태와 저장소 증거

시작 HEAD `5bd1b3f`, 브랜치 `codex/phone-test`, origin `Newrred/anime-collector`. 기존 UI 소스·문구·테스트 변경 및 interface-rebuild 계획이 미커밋 상태다. V8 시안은 Git 밖의 Codex visualizations 디렉터리에 있으며 기존 localhost4348 서버는 그 PC에만 존재한다. 기존 작업은 되돌리거나 덮어쓰지 않는다.

## 4. 범위

포함: 현 UI 작업/문서/테스트 체크포인트, 생성된 시안·로고·비교/검증 근거의 이식 가능한 사본, 의존성 없는 로컬 미리보기 명령, 새 PC 재개 문서, 원격 SHA 확인.

제외: 환경변수/인증 세션/원본 사용자 사진/DB dump/카탈로그 원본/빌드 산출물, 운영배포·DB·앱 기능 추가, 자동 이미지 공개. 원본 시안 폴더는 보존한다.

## 5. 아키텍처·데이터 흐름

선별한 기존 시안 → `design/prototypes/film-archive/` → Node built-in loopback 정적 서버 → 최신 V8/이전 시안 비교. 실제 Astro 앱과 별도이며 `public/`에 넣지 않는다. 절대 PC 경로 의존성을 제거하고 문서에 원래 위치/시점과 이전 상태를 구분한다.

## 6. 변경 파일 지도

- `CODEX_START_HERE.md`: 10/5 최신 인계 진입점.
- `docs/moemoa/operations/2026-10-05-design-handoff.md`: 현재 승인/실제 코드와 시안 차이/검증/새 PC 명령/다음 작업.
- `design/prototypes/film-archive/`: 검토 소스·생성 자산·증거·README/manifest.
- `design/evidence/original-design-5bd1b3f/`: 최초 서비스와 초기 앱 개편의 동일 조건 비교 원본37개와 안내.
- `.gitattributes`: 보관 자료의 원본 바이트와 checksum을 다른 운영체제에서도 유지.
- `scripts/serve-design-prototypes.mjs`, `scripts/check-design-prototypes.mjs`, 관련 Node test: 실행·누락 검증.
- `package.json`: dependency 변화 없이 design 미리보기/검사 명령만 추가.
- 기존 변경 파일: 그대로 체크포인트 보존하며 별도 검사 결과 기록.

## 7. 데이터·스키마 마이그레이션

없음. 복사 대상은 검토용 생성 자산과 코드/기록뿐이다. 개인정보/권리 불명 원본 발견 시 대상에서 제외하고 확인한다.

## 8. 마일스톤

1. 현 diff와 외부 시안 목록/참조/권리·비밀값 위험을 확인한다.
2. 시안 파일/자산/증거를 repository 경로로 옮긴 사본과 실행 명령을 준비한다.
3. 참조·구문·fixture·loopback 서버 접근제어와 실제 브라우저 로드를 검증한다. 기존 앱 unit/build 결과를 별도 기록한다.
4. 시작 문서/인계 갱신→명시 대상 stage→staged diff/비밀값/크기 검사→commit→non-force push→원격 SHA/깨끗한 worktree 확인.

## 9. 테스트와 검증

새 PC 경로/환경변수 없이 Node로 prototype 실행. HTML/CSS/JS 로컬 참조와 비교 이미지 무결성, 파일 checksum, traversal/금지파일 차단 테스트. V8 처음/펼침/모바일 smoke. 기존 앱 unit/build는 결과를 실제 실행 기준으로 보고하며 이전 PASS와 섞지 않는다. Required test 실패 시 사용자 지침에 따라 멈추고 결과를 보고한다.

## 10. 보안·개인정보·권리 영향

비밀값 파일/브라우저 profile/private 이미지/외부 reference 원본은 commit하지 않는다. 생성된 허구 작품과 제품 시안만 포함한다. 서버는127.0.0.1에만 바인딩하고 지정한 디자인 폴더만 제공한다. 원격 Git push 외 외부 mutation 없다. 기존 브랜치의 자동 Preview 발생 가능성과 운영 master 미변경을 구분한다.

## 11. 관찰 가능성·분석 이벤트

새 tracking/API/log 수집 없음. 검사 결과는 시안과 코드의 공개 가능한 기술 증거만 기록한다.

## 12. 롤백·복구

원본 외부 시안 폴더 보존. Git 체크포인트는 이력으로 복구 가능하며 파괴적 reset/clean/force push 금지. 자동 업그레이드/의존성 변경 없음. 서버 종료만으로 시안 미리보기 중단.

## 13. 위험과 완화

Git 밖 파일 누락→참조 closure/manifest 검사. 사진/키 노출→명시 whitelist 및 staged 검사. 새PC 경로 종속→상대 경로와 별도 checkout 모의 검사. 오래된 UI를 최종 디자인으로 오인→V8 디자인/기존 app 구현 경계·다음 승인 명시. 대형 중복 이미지→최종/참조된 근거만 선별하고 제외 기준 기록.

## 14. 필요한 사용자 결정

현재 checkpoint/push는 승인됨. 운영배포/실서비스 V8 적용/새PC의 로그인·환경변수 공급은 별도다.

## 15. 진행 기록

- 2026-10-05: 필수 문서·현재 branch/remote/status 확인. 계획 기록 후 자산/코드 audit와 인계 준비 시작.
- 2026-10-05: 외부 시안169개 및 원래 서비스 비교37개 보존. 원본 비교37개는 원본과 SHA256 일치. 원본 폴더와 이전 서버는 변경하지 않았다.
- 2026-10-05: 앱 단위407/407·빌드19pages 통과. 새 경로의 V8을 Chromium1440/320px에서 열고 필름 펼침·비교 페이지·누락 로고 안내를 확인, console error 없음.
- 2026-10-05: 최종 참조 검사171파일/98참조/7JS 구문/7fixture/169checksum PASS, 미리보기 서버·검사기 회귀9/9 PASS(skip0).
- 2026-10-05: Git index tree `69c2dac04381363601cab84a6bdefd427f99ffce`를 별도 공백 포함 경로로 archive/extract. 저장소와 다른 CWD에서 Node만으로 같은169checksum·98참조·7fixture 및9/9 테스트 재통과. 기존 node_modules·환경변수·Codex 원본 경로 없이 이식 파일을 검증했다. 다른 OS/실제 두 번째 PC 실행을 대신했다고 주장하지 않는다.
- 2026-10-05 16:55 KST: `git push origin codex/phone-test` 완료. 코드/자산/도구 commit `0abc021ed249c0c70dd19b903e4a3198b85005a8`의 local HEAD=remote SHA 확인, worktree clean. master 원격 `06d2e38d79d38c66753f0ec25a21b615bdc5fa60` 불변. 아래 완료 기록은 후속 문서 커밋으로 함께 올린다.

## 16. 발견 사항과 계획 변경

- 오래된 로고 후보4개는 기존 폴더에서도 부재였다. 해당 갤러리만 부재 안내로 바꾸고 확대 기능을 제거했다. 최신 필름 로고2안은 정상 보존. 169개 중168개 원본 bytes 동일,1개 갤러리 수정 전/후 hash를 manifest에 구분했다.
- 제3자 Are.na 원화면4개와 참조되지 않는 중간/중복 캡처44개는 복사하지 않았다. 실제 실패/수정 증거로 참조된 파일은 보존했다.
- 과거 프롬프트/결과 JSON의 절대경로는 역사적 메타데이터다. 실행 HTML/CSS/JS는 옛 PC 경로에 의존하지 않는다. 최신 V8은 로컬 이미지/동작 코드와 온라인 폰트, 일부 초기 가이드는 온라인 폰트/스크립트에 의존한다.
- 앱 소스는 초기 UI 개편 WIP, V8은 별도 RAM-only 시안이다. 기존 E2E의 과거 PASS와 이번 unit/build/smoke 결과를 분리했다.
- 검증기에서 srcdoc의 entity-encoded data SVG와 JS 동적 로고 경로를 로컬 파일로 오인하는 파서 거짓 양성을 발견했다. 자산을 바꾸지 않고 검사기/회귀 테스트를 보완했다. 선언된 choose01/02 버튼에 한해 로고 경로를 확장해 둘 다 존재 검증하며 실제 누락 시 실패한다. 임의 동적식이나 외부 URL은 정적 검사 범위가 아니다.

## 17. 완료 보고

### 1. 읽은 문서와 근거

`AGENTS.md`, `CODEX_START_HERE.md`, 확정 결정01, `PLANS.md`, QA/운영07, 변경통제09, 9/29 인계와10/3 interface-rebuild 기록. 실제 `package.json`, Git ignore/attributes/workflow, 기존 src/test diff, 시안 소스/manifest/생성 프롬프트/검증 JSON 및 원본 비교 manifest를 확인했다.

### 2. 가정과 미확정 사항

이번 승인은 현 개발 작업을 보존하는 commit/push다. V8의 최종 미감 승인·실제 앱 적용·배포 승인이 아니다. 로고 초기4이미지는 복구하지 못했으며 기존 온라인 폰트/초기 가이드 CDN 의존성은 유지한다.

### 3. 계획

본 ExecPlan을 수정 전 작성했다. 원본 보존 → 이식/검증 → 문서/결정·기존 앱·대형 디자인 자료·재개 도구를 추적 가능하게 분리 커밋 → 개발 브랜치 non-force push 순서다.

### 4. 변경 파일과 이유

섹션6 파일 지도를 따른다. 기존 src·테스트는 개발 체크포인트로 보존했고 이번 요청에서 추가로 UI를 변경하지 않았다. `design/`은169시안 파일과37원본비교 파일 및안내/manifest, `scripts/`2개와 Node test1개는 이식 실행/검사용이다. package script3개만 추가했으며 dependency/lock은 바꾸지 않았다.

### 5. 데이터와 롤백

DB/스키마/카탈로그/실사용자 데이터 migration 없음. 원본 디렉터리는 보존됐다. 필요 시 이번 Git 커밋을 대상으로 별도 revert를 검토하며 파괴적 reset/clean은 하지 않는다. 이식성 확인용 Git archive를 풀어 checksum을 재검증했으나 운영 DB 복원 테스트는 범위가 아니다.

### 6. 테스트와 결과

환경: Windows, Node24.19.0/npm11.17.0, Chromium. 다음은 이번 인계에서 실제 실행했다.

| 명령/검사 | 결과와 범위 |
| --- | --- |
| `npm run test:unit` |407/407 PASS, 실패·skip0 |
| `npm run build` |19정적페이지 및 후처리 PASS; 큰 JS chunk 경고 잔여 |
| `node scripts/check-design-prototypes.mjs` |171파일,98로컬참조,7외부JS구문·7fixture,169checksum PASS;21외부URL 요청하지 않음 |
| `node --test tests/design-prototypes-server.test.mjs` |9/9 PASS, skip0; loopback·메서드·traversal·symlink·포트충돌·누락/변조 검사 |
| Git tree archive 사본에서 위2개 명령 |동일 PASS; 다른 CWD·공백 경로·환경변수/의존성 설치 없이 실행 |
| 원본 비교37파일 SHA256 |원본과 사본37/37 동일 |
| `npm run design:preview -- --port 4350` + browser smoke |V8 1440/320px·표지 펼침·모바일 비교 양쪽 이미지·로고 부재 안내 PASS, console errors0·수평 overflow0 |
| `git diff --check` / staged 검사 |PASS |

브라우저 검증 스킬(agent-browser/agent-browser-verify/verification)을 사용했다. 실제 API/저장/외부 동기화는 RAM-only 시안이라 연결 대상이 없다. 전체 앱 E2E는 이번에 재실행하지 않았으며 과거97개 PASS와 구분한다. 실제 새 PC npm ci나 다른 OS/브라우저까지 검증한 것은 아니다.

### 7. 보안·권리·관찰 가능성

서버는127.0.0.1의 시안 폴더만 제공하고 dotfile/금지 확장자/traversal/link 탈출을 차단한다. 환경변수·인증·개인 사진은 제외, 검토용 생성 이미지/제공 로고/합성 데이터 화면만 보존한다. 제3자 원화면4개는 제외했다. public flag·업로드·API·분석 이벤트·DB·운영설정 변경 없음.

최종 read-only 감사는 시작5bd1b3f 대비263파일/105텍스트/신규260blob 범위다. 실제 credential·새 연락처·개인사진 폴더·DB dump 없음, 모든158PNG의 text/EXIF metadata chunk 없음, 최대blob3.53MB로100MB 초과0개. 기존 mock token과 desk 파일명 오탐은 비밀값이 아니다. 과거 작업 출처 문서/JSON5개의 로컬 계정 경로는 역사적 증거로 보존했으며 실행 의존성이나 원본 사진 경로가 아니다.

### 8. 남은 위험과 다음 게이트

Git 이전 목표는 달성했다. V8 승인과 앱 이식 ExecPlan, 전체19route/320px 회귀·실기기 접근성·공개 이미지 준비9/29 잔여가 남는다. master 전용 CI이므로 이 개발 브랜치 push에서 동일 CI가 자동 실행된다고 가정하지 않는다. 기존 Git 연동 Preview는 발생할 수 있으나 운영 master 배포는 하지 않았다. 원격 push/SHA/clean 확인은 위 진행 기록에 남겼다.
