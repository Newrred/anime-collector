# MOEMOA 필름 아카이브 — 디자인 검토본

최신은 **V8 `moemoa-film-grid.html#home`**. 사용자 확정 제약은 Hero 금지·로고2안 방향·이미지 우선·기록/작품/시청/보드 모델 독립이다. 이 폴더는 실행 가능한 디자인 시안 보관함이지 실제 서비스 빌드 자산이 아니다.

## 실행

저장소 루트에서 Node22–26으로:

```powershell
npm run design:preview
```

http://127.0.0.1:4348/ 에서 시작한다. 비교: http://127.0.0.1:4348/moemoa-film-grid-compare.html . 다른 포트는 `npm run design:preview -- --port 4350`. 별도 npm 의존성·로그인·환경변수 없이 실행되며 서버는127.0.0.1에서만 접근할 수 있다. 최신 V8의 이미지와 동작 코드는 모두 로컬 파일이며, 기존 Pretendard CDN 폰트는 인터넷을 사용하고 연결 불가 시 시스템 폰트로 표시된다. 초기 디자인 가이드는 Google Fonts·Floating UI·Lucide의 기존 온라인 의존성이 남아 있어 완전한 오프라인 실행을 보장하지 않는다. 정확한 URL·버전은 manifest에 기록했다.

```powershell
npm run design:check
npm run test:design-server
```

데이터는 페이지 메모리에만 존재해 새로고침하면 초기화된다. 실제 사진 선택/업로드·DB·공개·로그인 연결이 없으며 버튼은 가상 기록으로 체험하는 것이다.

## 버전 지도

| 단계 | 진입 파일 | 당시 의미 |
| --- | --- | --- |
| 초기4안 | `moemoa-design-guide-browser.html`, `moemoa-design-directions.html` | C안 선택 전후 디자인 탐색 |
| 초기 로고 탐색 | `moemoa-logo-review.html` | 이전4이미지 부재로 설명만 보존; 현재 채택 로고와 다름 |
| 필름 가이드 | `moemoa-film-guide.html` | 둥근 글자·필름 심벌2안·공통 가이드 |
| 로고 발전 | `moemoa-film-evolution.html` | 2안/정제안 비교, 최종 벡터 확정 아님 |
| V2 | `moemoa-film-prototype.html` | 최초 연결형 필름·보드·작성 흐름 |
| V3 | `moemoa-film-bookshelf.html` | 개인 책장·작품별 필름 행 |
| V4 | `moemoa-film-sleeve.html` | 커버에서 이어지는 필름 |
| V5 | `moemoa-film-interaction.html` | 상호작용·레퍼런스 검토 |
| V6 | `moemoa-film-collection.html` | 이미지 비율/컬렉션 밀도 |
| V7 | `moemoa-film-desk.html` | Hero 제거, 선반별 케이스 |
| **V8** | **`moemoa-film-grid.html`** | **선반 탭·고정 표지·선택 행 아래 필름** |

V6/V7/V8의 `-compare.html`은 각각 직전 시안 대비다. 원래 서비스 디자인을 뜻하지 않는다. 최초 서비스 기준 캡처는 `../../evidence/original-design-5bd1b3f/`에 별도 보존했다. 과거 가이드의 큰 소개 영역·오래된 색상·모서리는 이력이며, 최신 Hero 금지 제약을 대체하지 않는다.

## 보존과 제외

- `portable-manifest.json`: 가져온 파일명·크기·SHA256, 제외·부재 목록. 기존 소스·생성 자산·검증JSON·최종/문서참조 캡처를 보존한다.
- PNG 표지/장면은 작업 중 생성한 허구 이미지다. `film-v2-prompts.json`, `collection-v6-prompts.json` 등 출처/프롬프트 기록 유지. `logo-before.png`는 사용자가 제공한 로고 시안이다. 실제 개인 사진·서비스 데이터가 아니다.
- `moemoa-logo-01.png`~`04.png`는 기존 작업 폴더에 없었다. 이를 현재 `film-logo-02.png`와 혼동하지 않는다. 과거 탐색 페이지는 부재를 명시하며 이미지를 재생성해 원본으로 가장하지 않았다.
- 제3자 Are.na 원화면 PNG4개는 Git 보관에서 제외했다. 관찰 수치/URL/제약은 `interaction-v5-references.json`과 저장소 references/measurements에 남아 있다.
- 문서에서 참조하지 않는 중간/중복 캡처는 제외하되 원래 PC의 원본 폴더는 삭제하지 않는다. 실제 실패/수정 증거로 참조된 debug 파일은 유지한다.
- 원래 경로는 Codex visualizations/2026/10/03/01a10016-8e69-7791-b51b-32b0f7bd2d51. 기록JSON의 당시절대경로·해시·실행시점은 역사적 증거로 유지하며 새PC 실행경로로 해석하지 않는다.

## 이어서 작업하기

`docs/moemoa/operations/2026-10-05-design-handoff.md`와 `docs/moemoa/plans/2026-10-03-interface-rebuild.md` 8차 기록을 먼저 읽는다. 실제 app `src/`에는 초기UI 개편만 있고 V8을 적용하지 않았다. 미감 승인·서비스 이전 범위·전체상태/문구/실기기회귀는 다음 게이트다. 현재 각 시안의 겹친 CSS/복제 JS를 운영 앱에 그대로 전개하지 않는다.
