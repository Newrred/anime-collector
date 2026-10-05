# MOEMOA 디자인 작업 재개 — 2026-10-05

## 먼저 확인할 상태

- 저장소: https://github.com/Newrred/anime-collector
- 최신 개발 브랜치: **`codex/phone-test`**. `master`가 아니다.
- 이번 이전 기준점: `5bd1b3f` 이후 진행한 UI 코드·테스트·작업 기록과 별도 디자인 시안의 개발 체크포인트. 출시 후보나 디자인 최종 승인본이 아니다.
- 최신 디자인: **V8 `moemoa-film-grid.html#home`**. 이전 V7은 `moemoa-film-desk.html`, 전후 비교는 `moemoa-film-grid-compare.html`.
- 중요한 차이: `src/`에는 초기 collection/board UI 개편 작업이 보존돼 있다. 최신 필름 디자인 V2–V8은 별도 HTML 시안이다. `npm run dev`만 실행하고 화면이 V8과 다르다고 해서 유실된 것이 아니다.

## 다른 PC에서 받기

Node.js 22–26 범위와 Git이 필요하다. 이번 PC는 Node24.19.0/npm11.17.0으로 검사했다. 저장소 packageManager는 npm11.17.0이다. 시안만 여는 데는 별도 패키지·DB·로그인·환경변수가 필요 없다.

처음 받는 경우:

```powershell
git clone --branch codex/phone-test https://github.com/Newrred/anime-collector.git
cd anime-collector
npm ci
npm run design:preview
```

이미 받았던 경우, `git status`로 미반영 변경이 없는지 먼저 확인한다. 변경이 있으면 보존하고 충돌 여부를 확인하며 강제 reset/clean하지 않는다. 깨끗한 상태에서:

```powershell
git fetch origin
git switch codex/phone-test
git pull --ff-only origin codex/phone-test
npm ci
npm run design:preview
```

로컬 브랜치가 없다면 switch 대신 `git switch --track origin/codex/phone-test`. 브랜치가 분기되어 pull이 거절되면 force push/reset하지 않고 차이를 확인한다.

실행 후 http://127.0.0.1:4348/ 에서 최신 V8이 열린다. 전후 비교는 http://127.0.0.1:4348/moemoa-film-grid-compare.html . 포트가 사용 중이면 `npm run design:preview -- --port 4350`으로 실행하고 해당 포트로 접속한다. 서버는 현재 PC에서만 접근 가능한 loopback이며 Ctrl+C로 종료한다. 기존 시안 저장은 RAM 전용이라 새로고침하면 초기화된다.

시안 패키지 검사:

```powershell
npm run design:check
npm run test:design-server
```

실제 앱 개발은 별도 `npm run dev`. 계정·동기화·서버 연결 검사는 필요한 환경변수를 안전하게 별도 준비하고, 기존9/29 인계의 테스트 환경/권한/만료 조건을 먼저 확인한다. 이번 이전은 DB 관측시각이나 정책을 갱신하지 않는다.

## Codex에 이어서 요청할 문장

> CODEX_START_HERE.md와 docs/moemoa/operations/2026-10-05-design-handoff.md를 읽고 이어서 진행해줘. 최신 기준은 design/prototypes/film-archive의 V8 필름책장 시안이야. Hero는 절대 넣지 말고 로고2안과 고정 표지 그리드·선택 행 아래 필름 구조를 유지해줘. 실제 앱에 V8이 아직 적용되지 않았다는 점과 남은 승인 단계를 먼저 확인해줘.

읽기 순서: AGENTS → CODEX_START_HERE → 확정 결정01 → 이 인계 → `plans/2026-10-03-interface-rebuild.md`의 최근8차 기록 → 작업별 명세. Git 이전 자체의 계획·검증은 `plans/2026-10-05-cross-pc-design-handoff.md`.

## 사용자가 정한 디자인 방향

1. 이미지 우선 개인 애니 기억 아카이브. 일반 트래커/서비스 소개 랜딩처럼 만들지 않는다.
2. **Hero를 절대 넣지 않는다.** 큰 소개/대표 이미지/spotlight/환영 영역으로 이름만 바꿔 되살리지 않는다. 기능적인 작은 제목·탐색·빈 상태는 가능하다.
3. C안에서 출발한 필름집 컨셉. 둥근 소문자 워드마크와 **이어지는 필름 심벌2안** 방향 유지. 최종 벡터/실제 폰트 원본/최소 크기 확정은 아직이다.
4. Are.na/Cosmos의 실제 이미지·컬렉션 화면, Pinterest 보드, Letterboxd/Raindrop/라프텔을 참고한다. 랜딩 캡처만 보고 반영했다고 주장하지 않는다. 실제 관찰치와 MOEMOA 제안치를 구분한다. Letterboxd/Raindrop 접근 실패 및 Pinterest 로그인 가림 한계는 과거 기록에 명시돼 있다.
5. 과한 둥근 테두리, 옛 느낌의 초록 배경·두꺼운 박스, hover 시 큰 확대/들썩임, 이미지 위아래 유색 패딩, 장황한 개발자/AI식 안내를 피한다. 이미지 비율과 작은 글자 위계를 실제 화면에서 검토한다.
6. 개인 홈은 선별한 작품을 꾸미는 책장. 전체 작품 그리드와 기억 Archive는 유지한다. Board를 서비스에서 영구 삭제하거나 N:M 모델을 책장으로 바꾼 승인은 아니다.
7. 표지를 필름집 커버처럼 느끼게 하고, 기억 필름과 연결한다. 모바일에서도 커버와 이미지가 각각 떨어져 배치된 느낌을 피한다.

## V8에서 구현된 것과 아직 아닌 것

V8 홈은 작은 선반 선택줄 + 연속 표지 그리드다. 전체는 선반 합집합(초기6작품, 중복 제거)이며 My Titles(8작품)와 다르다. PC6열/중간4·3열/모바일2열. 표지 선택 시 해당 행 바로 아래에 패널1개만 열리고 옆 표지의 x좌표·폭은 변하지 않는다. 같은 행의 다른 작품 선택은 같은 위치에서 내용 교체, 화면폭 변경은 해당 행 끝으로 패널 재배치. 초기 자동 펼침은 없다.

열린 패널은 작은 커버와 가로 필름이 붙어 있으며 자연 이미지 비율, 추가 로딩, 클릭 확대, 키보드 이동, 접기/다시 열기 위치 복원, 작품 상세 왕복, 그 작품에 기억 추가 후 같은 선반/패널 유지가 동작한다. 책장 이름·선반명·진열/순서 편집과 적용/취소, 개인 감상·날짜도 유지한다.

이것은 **가상 이미지/기록을 사용하는 RAM-only 프로토타입**이다. 실제 업로드·지속 저장·로그인·동기화·공개·production API와 연결되지 않는다. 생성된 가상 표지/장면은 실제 애니 작품·사진이 아니다. V8 구현을 전체 서비스의 디자인/기능 완료로 보고하지 않는다.

## 자료 위치와 비교 기준

| 자료 | 저장소 경로 |
| --- | --- |
| 현재 V8와 V7/V6 비교 | `design/prototypes/film-archive/` |
| 디자인 가이드·로고·V2–V8 소스/생성 자산/검증 JSON | 같은 폴더의 README와 manifest |
| 원래 서비스 디자인 비교 | `design/evidence/original-design-5bd1b3f/` |
| 레퍼런스 실제 수치와 제한 | `docs/moemoa/references/measurements/`, interface-rebuild 계획 |
| 현재 코드·검사 | `src/`, `tests/`, `scripts/measure-reference-layout.js` |

원래 서비스 비교는 **5bd1b3f 대10/3 초기 앱 개편**에 동일 합성 기록을 넣은9화면×전후 캡처다. V8과 직접 비교한 이미지가 아니다. `capture-manifest.json`에 날짜 당시의 `current uncommitted working tree` 표현은 그 시점의 설명으로 보존한다. 최신 V8 비교는 **V7 대V8**이며 최초 서비스 전후로 재명명하지 않는다. 모든 캡처는 합성 데이터이며 개인 사진이 아니다.

과거 계획/JSON에 적힌 `C:/Users/shjb0/.codex/visualizations/2026/10/03/01a10016-8e69-7791-b51b-32b0f7bd2d51/`은 당시 출처 경로다. 새 PC에서는 같은 파일명을 `design/prototypes/film-archive/`에서 찾는다. `deliverables/design-comparison-5bd1b3f/`의 보존 사본은 `design/evidence/original-design-5bd1b3f/`다. 당시 로컬 주소는 새 서버를 실행해야 다시 동작한다.

아주 초기 로고 후보4장의 원본은 기존 작업 폴더에도 없어 설명과 부재 사실만 보존했다. 현재 필름 로고2안은 포함돼 있다. 최신 V8은 이미지/동작 코드가 로컬에 있고 폰트만 CDN을 사용한다. 초기 가이드 일부는 온라인 폰트/스크립트에 의존하므로 완전한 오프라인 복원은 아니다. 보존/제외/누락과 외부 의존성은 `portable-manifest.json`에서 확인한다.

## 검증 상태

- 이번 인계 때 실제 앱 `npm run test:unit`:407/407 PASS, 실패/skip0. `npm run build`:19pages PASS. 대형 JS chunk 경고는 남는다.
- V8 기존 기록: fixture32/기능15그룹 PASS; 320·390·768·1000·1440px 배치/넘침/행 삽입 확인. 상세 bounds는 `grid-v8-flow-results.json`, `grid-v8-layout-results.json`.
- 기존 앱의10/3 Chromium97개/보드6개/원본 비교1개 결과는 당시 실행 기록이다. 이번 Git 이전 때 전체 브라우저 suite를 다시 통과했다고 주장하지 않는다. visual golden은 최종 디자인으로 승인·교체하지 않았다.
- 이식본의 새 경로/미리보기 검사 결과는 아래 완료 기록과 이전 ExecPlan에 남긴다.
- 이번 이식 검사:171파일/98로컬참조/7JS구문·7fixture/169checksum PASS. 서버·검사기 테스트9/9 PASS(skip0). Git에 담긴 파일만 다른 공백 포함 폴더에 풀어, 기존 저장소 밖 CWD에서 Node만으로 같은 검사를 재통과했다.
- 이번 브라우저 smoke:새 저장소 경로에서 V8 PC1440/모바일320px, 필름 펼침, 모바일 전후 비교 이미지, 옛 로고 부재 안내 확인. console errors0·수평넘침0. 다른 OS/실제 두 번째 PC까지 실행한 것은 아니다.

## 다음 작업과 승인 경계

1. V8을 실제로 열어 사용자 최신 피드백부터 확인한다. 필름/표지 구조 검토가 우선이다.
2. 최초 약속 순서인 전수 상태·문구 조사 → 공통 기준 확정 → 문구 축약 → 대표 흐름 시안 → 확인 후 확장 →320px/회귀를 따른다. 과거에는 기준 확인 전 확산한 문제가 있었고 그 이력을 삭제하지 않는다.
3. V8 승인 후 실제 앱 적용 ExecPlan을 갱신하고 하나의 end-to-end 흐름부터 이전한다. 현재 시안의 중첩 CSS를 그대로 운영 앱에 붙이거나 전체 언어/프레임워크를 임의 교체하지 않는다.
4. 실물 모바일 터치/관성, Safari/Firefox, 스크린리더·확대, 대량 이미지·실제 기록/동기화·전체19route 상태/문구/회귀는 잔여다.
5. 공개 이미지 준비 버튼의 결과 가시성/서버 성공, 공개 미리보기→게시→익명열람→철회 실기기 검증 등9/29 잔여는 해결되지 않았다. 디자인 작업으로 공개 gate를 통과한 것으로 해석하지 않는다.

## Git으로 이동하지 않는 것

`.env`와 키/비밀번호, 브라우저 로그인·로컬Storage/IndexedDB, 동기화하지 않은 원본 사진, 기존 PC의 실행 중 서버, Codex 대화 세션 자체/앱 탭/개인 설정, 카탈로그 수집 원본·checkpoint는 포함하지 않는다. 작업 맥락은 이 문서와 결정/계획/검증 기록으로 이어간다. 실제 개인 자료를 Git에 올리거나 미확인 키를 문서에 적지 않는다.

## 이번 인계 완료 기록

2026-10-05 16:55 KST 기준 코드·자료·재개 도구 commit `0abc021ed249c0c70dd19b903e4a3198b85005a8`까지 `origin/codex/phone-test` push 완료, 로컬/원격 SHA 일치와 깨끗한 작업 폴더를 확인했다. 이 완료 기록은 후속 문서 커밋으로 함께 보존한다. 다른 PC에서는 특정 중간 커밋이 아니라 브랜치 최신 상태를 받는다.

- 작업 기록/결정 → 기존 앱 개발 코드 → 시안/전후 비교 자료 → 실행·검사 도구를 분리해 보존했다.
- 시안169파일의 checksum과 기존 비교37파일의 원본 일치를 확인했다. Git 사본 이식 검사, 앱 단위407개, 미리보기 서버9개, 빌드, 브라우저 smoke가 통과했다. 전체 E2E/운영배포 완료가 아니다.
- 이번 변경263파일 최종 감사에서 실제 credential·새 연락처·개인사진 폴더·DB dump·100MB 초과 Git blob 없음. PNG158개에서 텍스트/EXIF 메타데이터 없음. 과거 작업 경로는 출처 문서/JSON5개에 역사적 정보로 남아 있으며 새 PC 실행에는 사용하지 않는다.
- 원격 `master`는 `06d2e38d79d38c66753f0ec25a21b615bdc5fa60`으로 변경하지 않았다. 브랜치 push가 기존 Git 연동 Preview를 유발할 수 있지만 운영 배포를 수정·승격하지 않았다.

상세 읽기 목록·변경 범위·검증 명령·마이그레이션/롤백·보안·잔여 게이트는 [이전 ExecPlan 완료 보고](../plans/2026-10-05-cross-pc-design-handoff.md#17-완료-보고)에 있다.
