# 운영 설정·검사 마감 ExecPlan

## 1. 목적과 사용자 결과

운영에 적용된 자동 저장·비공개 사진 상태를 시작 문서와 작업판에 정확히 반영하고, 현행 UI와 맞지 않는 브라우저 회귀 검사 때문에 `Service quality`가 20분에 취소되는 문제를 해결한다. 설정 지도와 검증 결과를 Git `master`에 보존하고 Vercel Git 배포의 SHA를 대조한다.

## 2. 관련 확정 결정

- `AUTOMATIC-SAVE-AND-GUEST-COVER-01`: 비로그인 사용자는 공식 표지 카드, 로그인 사용자는 직접 선택한 사진 카드와 계정 자동 저장. 신규 시스템 디자인 작성 UI는 제거했고 기존 디자인 카드의 읽기·보존은 유지한다.
- 공개 게시/이미지, Android 출시 범위 및 DB 정책은 이번 작업에서 바꾸지 않는다.
- 운영 배포는 `AGENTS.md`에 따라 Git `master` → Vercel Git 연동으로만 한다. 사용자의 이번 “진행”은 직전 제안의 Git 반영·CI 수정·배포 후 실기기 검증 준비에 대한 지시다.

## 3. 현재 상태와 저장소 증거

- 시작 문서 `CODEX_START_HERE.md` 2026-10-08 두 번째 배너와 `docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md` 맨 위는 사진 flag off/미배포라고 적지만 실제 `.env.production:12`는 `PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1=1`이다. 운영 `build-info.json`·Git `master`는 `adba637`로 일치한다.
- `docs/moemoa/operations/2026-10-08-configuration-map.md`는 검증 후 만든 설정 지도이며 아직 Git 미추적이다.
- GitHub `Service quality` 실행 `37733862583`은 `verify` 20분 제한에 도달했다. E2E는 80건 중 60여 건 진행했고 `tests/publication-ui.spec.ts:405` 등이 제거된 `Use system design` 버튼을 30초씩 기다려 재시도했다. `publication-contract`는 성공했다. 시간 제한만 늘리면 잘못된 테스트를 숨긴다.
- 사용자 확인은 기존 iPhone 카드 1건의 재시도 후 PC에서 카드와 사진이 보인다는 범위다. 새 카드·오프라인·Guest·수정/삭제 실기기 전수 검증은 아직 아니다.

## 4. 범위

### 포함

현재 상태 문구 및 설정 지도 Git 반영, 제거된 UI를 기다리는 CI 영향 검사 수정, 의미 있는 현재 저장/조회/게시·관리 계약 유지, 필요한 경우 CI 작업 분리, 검증과 Git 배포 SHA 대조, 실기기 확인 절차 제공.

### 제외

제품 기능 추가, 새 Supabase migration/데이터 변경, 사진 원본 업로드, 공개 게시 활성화, Android 배포, 무관한 시각 디자인.

## 5. 아키텍처·데이터 흐름

제품 저장 경로는 바꾸지 않는다. 브라우저 검사의 데이터 준비만 현재 작성 UI(공식 표지+개인 기억 신호) 또는 과거 디자인 카드 보존 검사가 필요한 경우 기존 runtime fixture로 바꾼다. CI는 각각의 실패를 짧은 시간에 판별하도록 구성하며 검사 자체를 제거해 통과시키지 않는다.

## 6. 변경 파일 지도

`CODEX_START_HERE.md`, `docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md`, `docs/moemoa/operations/2026-10-08-configuration-map.md`, 이 계획 문서, 영향받은 `tests/*.spec.ts`/공용 test helper, 필요 시 `.github/workflows/quality.yml`. 실제 변경 목록은 완료 보고에 확정한다.

## 7. 데이터·스키마 마이그레이션

없음. 운영 DB 정책·Auth·Storage 값은 읽기 대조만 하며 변경하지 않는다.

## 8. 마일스톤

1. 시작 문서와 작업판의 최상단이 사진 기능의 현재 운영 상태 및 한정된 실기기 검증 범위를 정확히 가리키고, 설정 지도가 Git에서 찾을 수 있다.
2. CI 대상 브라우저 검사에서 제거된 신규 시스템 디자인 버튼 대기가 사라지고, 실제 기능 의미를 보존한 회귀 검사가 로컬에서 통과한다.
3. 관련 단위·브라우저·빌드 및 GitHub CI가 성공한다. 만약 CI 자체의 실행 시간이 여전히 문제라면 작업을 분리해 각 job의 실패 신호를 유지한다.
4. Git `master`, Vercel 운영 `/build-info.json`, GitHub Actions의 대상 SHA를 대조하고 실기기 확인 범위를 명시한다.

## 9. 테스트와 검증

변경 대상 Playwright Chromium을 먼저 실행하고 이후 CI와 동일한 로컬 검사를 수행한다. 단위, 카탈로그, Web build를 포함한다. GitHub `Service quality`의 모든 필수 job 성공과 운영 SHA를 확인한다. 실기기 항목은 실제 사용자 결과가 없으면 PASS로 기록하지 않는다.

## 10. 보안·개인정보·권리 영향

없음. 합성 fixture만 사용하고 운영 사용자 사진·감상·토큰을 테스트나 일반 로그에 넣지 않는다. 기존 과거 디자인 카드 읽기는 유지하지만 신규 작성 UI는 되살리지 않는다. 공개 이미지/권리 gate는 닫힌 채 유지한다.

## 11. 관찰 가능성·분석 이벤트

새 분석 이벤트 없음. GitHub job 결과·소요 시간, 운영 build SHA, 기존 비공개 사진 maintenance 결과를 기록한다.

## 12. 롤백·복구

CI/문서 변경에 문제가 있으면 해당 Git 커밋을 revert 후 `master`에 push한다. 기존 사용자 카드·DB 행·이미지 버킷에는 손대지 않는다. 브라우저 검사 시간 증가는 최후 수단이며 무한 대기/실패 은폐는 하지 않는다.

## 13. 위험과 완화

오래된 검사가 여러 파일에 남아 있다. 실패한 버튼만 다른 버튼으로 바꾸면 검사 목적이 바뀔 수 있으므로 각 테스트의 주된 사용자 결과를 확인한다. 합성 E2E 성공은 iPhone Safari 실제 계정 왕복의 대체가 아니다.

## 14. 필요한 사용자 결정

현재 없음. 새 실기기 카드 작성·사진 선택은 사용자가 직접 진행하며, 실기기 결과가 오기 전에는 해당 항목을 완료로 쓰지 않는다.

배포 후 실기기 확인 순서: iPhone Safari에서 같은 계정으로 새 사진 카드 1건을 저장하고 저장 직후 완료/대기 표시를 확인한다. PC에서 같은 계정으로 카드와 사진을 새로고침 없이 찾아 열고, 목록으로 돌아갔다 다시 열어도 표지가 유지되는지 확인한다. iPhone에서 짧은 감상을 수정해 PC에 반영되는지 확인하고, 마지막으로 카드 삭제를 양쪽 기기에서 확인한다. Guest 검사는 별도 브라우저에서 공식 표지 카드 저장 및 사진 로그인 안내를 확인한다. 오프라인 저장·재연결은 별도 단계로 결과를 기록한다. 사용자 사진·토큰을 증거로 보내지 않는다.

## 15. 진행 기록

- 2026-10-08: `adba637` 운영 SHA와 Git `master`를 대조. 최신 `Service quality`의 20분 취소 직전 로그에서 제거된 시스템 디자인 버튼 대기와 반복 재시도를 확인. 설정 지도는 미추적 상태.
- 2026-10-08: 제거된 디자인 작성 UI를 기다리던 검사들을 현행 공식 표지 작성/Guest 사진 gate/과거 디자인 카드 읽기로 수정. 새 카드·보드/상세 흐름 79 PASS·1 기존 skip, 전체 composer 13 PASS·6 `fixme`, 모바일/Guest 10 PASS·과거 Web picker 3 `fixme`. 자체 카탈로그 캐릭터 fixture의 영향 범위 49 PASS·1 사진 시나리오 `fixme`. 전체 채널 회귀 80 PASS·5 skip(기존 skip 포함). 단위 454 PASS, 카탈로그 256 PASS·2 skip, build 20페이지 PASS. GitHub CI·운영 SHA 대조는 진행 중.
- 2026-10-08: 첫 GitHub CI는 전체 화면 묶음을 통과했지만 공식 표지 카드의 선반 편집 검사에서 실패. CI에서는 작품 표시명이 `장송의 프리렌`, 로컬에서는 영문 별칭으로 나타나는 차이를 실패 증거의 접근성 트리에서 확인했다. 검사에서 두 표시명을 허용하도록 수정했고 전체 composer 13 PASS·6 skip으로 재확인했다.
- 2026-10-08: 코드 커밋 `5923bcc`에 대한 [Service quality 실행](https://github.com/Newrred/anime-collector/actions/runs/37746861642)에서 `publication-contract`와 `verify` 모두 성공(`verify` 8분 26초). 운영 `/build-info.json`의 `commit`·`checkoutCommit`도 `5923bcc`이고 배포 출처는 `vercel-git`으로 확인했다. 사용자 실기기에서는 새 사진 카드를 iPhone Safari에 저장할 때 첫 시도에 사진 전송 관련 대기 코드가 나타났으나 재시도 뒤 iPhone 보관함과 PC에서 카드·사진 모두 표시됐다. 정확한 첫 오류 코드는 확보하지 못했으므로 원인을 확정하지 않는다.

## 16. 발견 사항과 계획 변경

- `tests/memory-card-composer.spec.ts`와 `tests/web-image-intake.spec.ts`의 오래된 개인 사진 시나리오는 Guest가 사진을 바로 저장할 수 있던 시절의 전제다. 실제 현행 Guest 정책에서는 버튼이 없거나 저장이 막혀 시간 초과한다. 각 시나리오를 `fixme`로 명시해 CI 결과에서 보이게 하고, 현행 공식 표지 작성·Guest gate·계정 동기화·Web intake unit은 실행한다. 오래된 사진 UI 시나리오를 진짜 로그인 계정 fixture로 다시 작성하는 작업은 남는다. `tests/channel-service.spec.ts`의 이와 같은 1건도 `fixme`로 표시한다. 임의로 시간 제한을 늘리지 않는다.
- 캐릭터 E2E도 과거 AniList 클라이언트 캐시를 전제로 했다. 제품의 실제 경로는 자체 카탈로그 `getPeople`이므로 DEV 전용 합성 카탈로그 reader를 주입해 DB 캐릭터 선택·분류·복원을 검증한다.

## 17. 완료 보고

- 운영 설정 지도 `docs/moemoa/operations/2026-10-08-configuration-map.md`를 Git에 추가하고, `CODEX_START_HERE.md`·작업판·`.env.production` 주석의 현재 사진 자동 저장 설명을 맞췄다. 환경 값, Supabase 정책, 운영 데이터는 바꾸지 않았다.
- 제거된 신규 시스템 디자인 작성 경로를 기다리던 브라우저 검사를 현행 공식 표지·Guest gate·기존 카드 읽기 흐름에 맞췄다. 관련 파일은 `.github/workflows/quality.yml`, `scripts/run-channel-e2e.mjs`, `tests/helpers/approvedCoverCard.ts`, 영향받은 `tests/*.spec.ts`, DEV 전용 합성 캐릭터 reader를 가진 `src/features/titles/application/titleCharacters.js`다. 실제 제품의 캐릭터 조회는 자체 카탈로그 경로 그대로다.
- 로컬 단위 454 PASS, 카탈로그 256 PASS·2 skip, 20개 화면 build, 첫 브라우저 묶음 79 PASS·1 기존 skip, composer 13 PASS·6 `fixme`, 모바일/Guest 10 PASS·Web picker 3 `fixme`, 채널 회귀 80 PASS·5 skip. GitHub `Service quality` 두 필수 job 성공. 과거 Guest 개인 사진 작성 시나리오 10건은 현재 정책과 맞지 않아 `fixme`로 명시했으며 로그인 사진 fixture를 갖춰 다시 작성해야 한다.
- 운영 Git/Vercel 검증 코드는 `5923bcc`. iPhone Safari 새 사진 카드의 재시도 후 양 기기 표시까지는 사용자 확인을 받았다. 첫 시도 대기의 정확한 원인, 자동 복구 시간, 수정·삭제 왕복, 오프라인 재연결, 다른 계정 간 경계는 이번 실기기 확인 범위 밖이다. 추가 검증 없이 이 항목들을 완료로 표시하지 않는다.
