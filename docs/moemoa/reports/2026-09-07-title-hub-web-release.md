# Title Hub Phase 6 Web 운영 배포

상태: **완료 — 2026-09-07 09:13 KST 검증**. 사용자의 “배포 ㄱ” 요청으로 기존 운영 Web 배포를 승인받았다.

## 결과와 배포 식별

- 운영: https://www.moemoa.xyz
- Vercel project: `newrreds-projects/anime-collector`, `prj_po9LsTZRHWOYjAYD76O1EC04xa4x`.
- 최종 deployment: `dpl_81aNzZJrKHCdc7RKxiY9Aw923VXK`, **READY / production**.
- 고정 URL: https://anime-collector-1vb4htcsj-newrreds-projects.vercel.app
- 검증 후 `vercel promote` 성공, `vercel inspect https://www.moemoa.xyz`로 동일 deployment를 재확인했다.
- Title Hub, My Titles Poster/Memory View, 메뉴·검색·기존 Library 주소 호환, Home·화면 간 연결, 첫 Memory 안내를 반영했다. Android 배포는 하지 않았다.
- Git HEAD `3fb09a76b45e8ad8e3d0cc14fa6f4b5073a091fb` 위의 현재 작업 파일을 격리 snapshot으로 빌드했다. Git commit/push는 하지 않았으며 GitHub Pages도 갱신하지 않았다.

## 읽은 자료와 판단 근거

`AGENTS.md`, `CODEX_START_HERE.md`, 확정 결정 `01`, QA/운영 `07`, 단계 runbook `08`, 변경 관리 `09`, README의 배포 절차, `vercel.json`, `.github/workflows/astro.yml`, 기존 [production OAuth 수용 기록](unified-user-data-test-evidence.md), [Phase 5](2026-09-07-title-navigation-phase5.md)·[Phase 6](2026-09-07-title-cross-surface-phase6.md) 보고서를 대조했다. 배포 대상은 문서의 과거 미정 항목을 추측하지 않고 Vercel project/deployment 조회와 기존 OAuth 운영 주소로 확인했다.

실행 계획: [Web 배포 ExecPlan](../plans/2026-09-07-title-hub-web-release.md). 기존 운영 도메인과 production 계정 동기화 flag를 유지한다는 전제로 진행했다. 새로운 제품 결정이나 사용자의 추가 결정이 필요한 사항은 없다.

## 배포 과정에서 수정한 파일

- `src/hooks/useAuthSession.js:4` — 명시적으로 심은 개발 mock session이 실제 production 환경값 없이도 계정 검사를 재현하게 했다. effect는 인증 활성 상태 변경을 구독한다.
- `src/repositories/mockAuthStorage.js:72` — production에서는 개발 mock session을 읽지 않는다. 실제 배포에 fake session을 넣어도 로그아웃 상태가 유지됨을 확인했다.
- `src/features/titles/components/title-collection.css:50` — 320px에서 영문 `Has Memories` 필터가 화면 너비를 넘던 문제를 작은 글자와 줄바꿈으로 수정했다. 운영 설정의 실제 빌드에서 발견했다.
- `tests/page-design-system.spec.ts:6` — 기존 Home hero의 최대 64px padding/50px CTA와 Composer step-card의 16–18px radius 등 실제 적용된 화면 규격을 검사한다. overflow 등 공통 검사는 유지한다.
- `tests/title-cross-surface.spec.ts:38` — 첫 Memory 안내 수락 후 320px Web/native My Titles와 필터 글자의 넘침을 폰트 로드 후 확인한다.
- 이 보고서, release ExecPlan, 현재 상태 문서에 배포 결과를 반영했다.

## 빌드·환경·산출물

Windows의 `vercel build`가 `spawn cmd.exe ENOENT`로 실패했다. 동일 snapshot을 Node 24.20.0으로 직접 Astro build하여 검증하고, Vercel의 기존 Node 24 production 설정으로 서버 빌드했다. 최종 배포는 prebuilt가 아니라 source build다. production dependency 버전을 변경하지 않았다.

격리 경로: `D:/hong/Web/Anime/.moemoa-release-2026-09-07-phase6/`. 업로드는 `.vercelignore` 허용 목록의 `src`, `public`, build tools, package/config **257개 파일**로 제한했다. 환경 파일, 인증 정보, 테스트 결과, DB 파일, 작업 로그는 업로드에서 제외했다.

기존 production의 `PUBLIC_SITE_URL`, `PUBLIC_SUPABASE_*`, `PUBLIC_MEMORY_ACCOUNT_SYNC_V1=1`을 재사용했다. 기존 로컬 `.env.production`의 `PUBLIC_CATALOG_SUPABASE_URL`, `PUBLIC_CATALOG_SUPABASE_ANON_KEY`도 해당 deployment의 build 환경에 전달했다. 계정과 catalog가 동일 Supabase를 바라보고 공개 anon 자격 증명임을 확인했으며 키 원문을 보고서나 로그에 출력하지 않았다. **두 catalog 값은 Vercel 프로젝트의 영구 환경변수에 추가하지 않았으므로 이후 별도 배포에서도 제공해야 한다.**

산출물은 **78개 파일 / 15 HTML pages**. `artifact-audit.json`에서 snapshot과 작업 폴더 입력 hash 일치, 개발 adapter 식별자 제거, 비공개 환경값 2개의 산출물 미포함을 확인했다. 로컬 manifest SHA-256: `c98a8afeea2f77bfc9881651f52c7d37d0cf9b3e149c506b2497961f659502f9`.

운영 origin에서 78개 파일 모두 HTTP 200을 확인했다. JS/CSS/폰트/정적 파일 **63개는 byte SHA-256이 일치**한다. HTML **15개는 Astro island build uid와 기존 Vercel Analytics의 호스팅 endpoint 설정을 제외한 내용이 일치**한다. 이 두 차이를 포함한 운영 원본 hash와 비교 결과는 `live-artifact-verification.json`에 보관했다.

## 검증 결과

| 검사 | 결과 |
| --- | --- |
| `npm run test:unit` | 221 passed, 0 failed |
| 전체 Chromium (`npm run test:e2e -- --project=chromium --workers=1 --reporter=line`) | 126 passed, 3 conditional skipped, 0 failed |
| 모바일 수정 후 계정·화면 규격·첫 Memory·메뉴 대상 재검사 | 20 passed, 0 failed |
| Node 24 production Astro build / Vercel server build | 15 pages, 성공 |
| React Doctor `--verbose --diff` | 84/100, 기존 경고 6개. 이번 변경의 새 경고 없음 |
| `git diff --check` | 통과 |
| 고정 deployment URL의 실제 production 브라우저 | 7개 흐름 통과, page error 0, 계정 쓰기 0 |
| `https://www.moemoa.xyz`의 별도 새 브라우저 | 동일 7개 흐름 통과, page error 0, 계정 쓰기 0 |

실배포 흐름: HTTPS/보안 헤더·메뉴·h1, `/library/` → `/titles/`, 합성 PrivateTitle + 시스템 디자인 저장, 첫 안내의 Memory View 선택과 작품 저장 상태 독립성, Home → 동일 Title Hub 및 안내 미반복, 계정 로그인 버튼 활성/production mock 무시, 320px 메뉴·필터, 실제 Naruto 검색 → Title Hub. 개발 adapter나 API 응답 mock 없이 검사했다.

첫 전체 검사의 9개 실패는 숨기지 않고 원인을 확인했다. 계정 fixture 7개는 개발 인증 경계 수정으로, 화면 규격 2개는 기존 Home/Composer CSS에 맞는 검사로 해결했다. 실배포에서 발견한 필터 overflow도 수정 및 재검사 후 promote했다. 조건부 생략 3개를 통과로 계산하지 않았다. React Doctor의 과거 Phase 5 이전 86점과 현재 84점 차이는 이번 배포가 해결한 항목이 아니다.

## 데이터·보안·복구

이번 작업의 DB/schema/data migration은 **없다**. 사용자 원본 이미지 업로드, Public UGC 활성화, 이미지 cloud 활성화, 기존 사용자 기록 삭제를 하지 않았다. 실배포 smoke의 합성 기록은 로그인하지 않은 별도 브라우저의 로컬 저장소에만 생성했고 브라우저를 종료했다. 실제 Google OAuth 로그인·다기기 cloud 쓰기를 다시 수행하지는 않았다. 기존 analytics를 유지했으며 새로운 수집은 추가하지 않았다.

이전 READY deployment: `dpl_Uuo8wH33JHebWNT5cemdJStBzH3L`, https://anime-collector-31qi4hu9c-newrreds-projects.vercel.app . 운영 문제 시 `vercel rollback https://anime-collector-31qi4hu9c-newrreds-projects.vercel.app --yes --scope newrreds-projects`로 복구한다. DB rollback은 필요 없다. 현재 서비스워커는 페이지 navigation을 network-first로 처리하며, IndexedDB/localStorage 사용자 기록을 삭제하지 않는다.

## 남은 범위

- 실제 사용성 확인 후 Phase 7 Android 적용.
- 후속 배포 시 두 `PUBLIC_CATALOG_*` 값을 반드시 재사용하거나 프로젝트 production 환경에 영구 등록할 것.
- 실제 계정 OAuth/다기기 재검사와 장기간 오프라인 PWA 업그레이드 검사는 이번 smoke 범위 밖이다.
- Public UGC와 사용자 이미지 cloud는 기존 gate를 유지한다. 이번 사용자 승인에 포함되지 않는다.
