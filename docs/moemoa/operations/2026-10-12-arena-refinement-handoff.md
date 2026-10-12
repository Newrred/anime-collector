# 2026-10-12 디자인 개선 운영 반영·다른 PC 재개

사용자가 “운영 반영 후 다른 pc에서 작업 이어갈 수 있도록 git업데이트 ㄱ”으로 운영 반영과 Git 인계를 승인했다. 이 문서가 이번 디자인 개선의 재개 기준이다. 아래의 과거 문서 날짜별 상태보다 이 문서와 실제 최신 Git/운영 SHA를 먼저 확인한다.

## 코드와 검증 기준

- 저장소: https://github.com/Newrred/anime-collector, 운영 브랜치 `master`.
- 개선 앱 기준: `cafcd2a03c4c2641fa0e18548defb4469776edd6`, 직전 운영 기준: `33de5b4c985e009d14c8ecec6158c4511af946a2`.
- 정확한 개선본의 전체 품질 검사 [38223832158](https://github.com/Newrred/anime-collector/actions/runs/38223832158): `publication-contract`·`verify` 모두 SUCCESS. 디자인 검수17항목, 실제 구현과 테스트는 [개선 보고](../reports/2026-10-12-arena-ui-refinement.md)와 [ExecPlan](../plans/2026-10-12-arena-ui-refinement.md) 참조.
- 로컬 최종 근거: unit619 PASS, catalog256 PASS/기존2 skip, build33페이지, 공개54 PASS, 전체 channel88 PASS/기존5 skip, React Doctor37→37/변경 파일 진단0. `astro check`의 기존370오류와 전체 React Doctor302진단은 미해결이다. 정적 검사 전체 성공이라고 보고하지 않는다.
- 데이터·schema·API·권한·환경·공개 기능 설정·고정 legal 본문·의존성 변경0. 디자인 표시와 해당 회귀 검사를 반영했다. 합성 테스트 이외 실제 사용자 게시·신고·삭제·동의·사진 업로드0.

## 다른 PC에서 재개

기존 작업 폴더에서는 먼저 `git status`를 확인한다. 미커밋 작업이나 이전 PC만의 commit이 있으면 그대로 보존하고 아래처럼 별도 checkout을 만든다. `reset --hard`, 강제 pull/push, 이전 개발 브랜치 전체를 master로 병합하지 않는다.

기존 clone의 터미널에서:

```powershell
git fetch origin
git worktree add -b codex/continue-after-arena-20261012 ../anime-collector-continue-20261012 origin/master
cd ../anime-collector-continue-20261012
git log -1 --oneline
node --version
npm ci
npm run dev -- --host 127.0.0.1 --port 4363
```

해당 브랜치/폴더가 이미 있으면 먼저 상태를 확인하고 재사용하거나 다른 빈 이름을 선택한다. 4363을 다른 개발 서버가 사용 중이면 빈 포트를 쓴다. 처음 받는 PC라면 먼저 위 GitHub 저장소를 clone한 뒤 같은 절차를 진행한다. 다른 PC에서 실행한 사실까지 이 인계의 완료로 주장하지 않는다.

Node는 `package.json`의 `>=22 <27`에 맞춰 준비한다. 이 PC는24.19.0, 운영 프로젝트는24.x다. 잠금 파일대로 `npm ci`를 사용하며 의존성을 임의 업그레이드하거나 설치 스크립트를 일괄 승인하지 않는다. 기존 비밀 보관 경로의 개발 환경 설정을 새 PC의 제외된 환경 파일로 준비한다. 로컬 개발은 `.env.production`을 자동 사용하지 않는다. 키/암호/복구 ZIP을 Git에 넣거나 대화에 붙여 넣지 않는다.

먼저 `AGENTS.md` → `CODEX_START_HERE.md` → 확정 결정 → 이번 ExecPlan/개선 보고 → `release-v2/01~03`을 읽는다. 과거 `codex/phone-test` 또는 `codex/public-ui-arena-20261012`의 ‘최신’ 안내는 당시 이력이다. 새 변경은 현재 `origin/master`에서 시작한다. 기존 계정 연동을 사용하며 전체 과거 migration을 다시 `db push`하지 않는다.

## 운영 버전 재확인

```powershell
git fetch origin
git rev-parse origin/master
Invoke-RestMethod https://www.moemoa.xyz/build-info.json
```

실제 `commit`·`checkoutCommit`과 `origin/master`가 같고 `source=vercel-git`, 배포 설정의 `semanticMatch=true`인지 확인한다. 배포 중 잠깐 이전 SHA가 보이는 것은 완료가 아니다. Vercel의 `anime-collector` 프로젝트, Production/READY, GitHub `Newrred/anime-collector`/master/source SHA도 확인한다. 운영은 계속 Git master 배포로 진행한다.

## 비교 자료와 개인정보

같은 합성 예시로 촬영한 실제 앱18장면/42쌍/84PNG와 비교 HTML은 이전 PC의 `design-comparison-20261012`에 있다. ZIP 이름 `MOEMOA-DESIGN-COMPARISON-20261012-cafcd2a.zip`, SHA256 `5046c55fd9999db4d772de002f3d71f5c1cceb95d84fa9b4e6b37fb3425d92cf`. ZIP만 별도 전달하면 `index.html`을 오프라인으로 열 수 있다. 원본 PNG·개인 기록·환경 파일·브라우저 로그인·암호화 복구키는 Git으로 이동하지 않는다. 이번 배포에서 비교 ZIP 내용은 변경하지 않는다.

## 다음 작업과 롤백

현재 디자인 개선 구현/비교는 완료다. 다음은 사용자의 실제 이용 피드백 또는 기존 출시 작업판에 남은 항목이며 Android·새 국가·애니 캡처/팬아트 권리 gate를 이번 디자인 배포로 완료 처리하지 않는다. 기존 승인·백업 설정과 별도 보관한 복구키는 보존한다.

문제가 확인되면 기준33de5b4 이후 개선 앱 변경을 검토된 revert commit으로 되돌리고 CI→Git master→Vercel READY→www 동일SHA를 확인한다. DB/개인 원본 복원은 필요 없다. 서로 다른 브랜치의 백업 도구/운영 이력을 통째로 섞거나 강제 push하지 않는다.

## 배포 실행 기록

Git master에 개선본 cafcd2a를 force 없이 반영했다. Vercel Production `dpl_FL7SBpiDdBVRhWmkdi24y6DvQego` READY, source=Git/master/cafcd2a, www의 commit/checkoutCommit=cafcd2a·source=vercel-git·semanticMatch=true를 확인했다. build log의 변경 경로는 `vercel.json` 하나이며 기존 배포와 같은 설정 hash/semanticMatch를 유지한다. `workingTreeDirty=true`를 깨끗한 build로 보고하지 않는다.

실제 운영 `/`, `/titles/`, `/minihome/`, `/data/`, `/help/`, `/terms/`, `/privacy/`, `/admin/` HTTP200. 브라우저에서 작업별 도움말 펼침과 데이터 작업 메뉴를 읽기 확인했다. 개인 자료 변경은 없다. 인계 후속 commit은 문서만 변경하고 앱·API·DB·환경·의존성은 개선본과 동일함을 확인한 뒤 전체 CI와 Git 운영 배포를 진행한다. 최종 운영 commit은 위의 live 조회 절차로 확인한다.
