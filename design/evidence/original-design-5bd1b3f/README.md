# 원래 서비스 디자인 비교 근거

2026-10-03에 실제 앱의 작업 시작 commit `5bd1b3fb132baaafbcb6cf892ece0793139fc7ce`와 그날의 초기 UI 개편 working tree를 동일 조건으로 캡처한 원본이다. **V8 필름책장과의 비교가 아니다.** 당시 파일명·manifest의 `current uncommitted working tree` 문구를 원래 시점의 기록으로 보존했다.

- 9화면×전후, 같은 합성 Memory10개·Board3개·고정 ID/시각, 한국어·밝은 테마.
- PC1440×1000, 모바일390×844. `-full.png`는 전체 높이이며 일반 파일은 동일 viewport 비교다.
- 실제 사용자 사진·로그인·원격 데이터 없음. manifest의 noRealUserData/noExternalNetwork와 재현 테스트 참조.
- 생성 근거: `tests/visual/original-design-comparison.visual.spec.ts`.
- 이전 위치: `deliverables/design-comparison-5bd1b3f/`(Git ignore). 이번 인계에서 원본 bytes 그대로 복사했다.
- `capture-manifest.json`의 과거 시점/검사 범위는 새 검증 결과로 덮어쓰지 않는다.

최신 V7→V8 비교는 `../../prototypes/film-archive/moemoa-film-grid-compare.html`을 시안 서버에서 연다. 이 폴더 이미지는 파일 뷰어나 편집기에서 볼 수 있으며 기본 시안 서버는 다른 폴더를 임의 제공하지 않는다.
