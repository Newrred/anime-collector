# 사진 저장 신뢰성·기기 간 검증 ExecPlan

## 1. 목적과 사용자 결과

첫 사진 저장에서 대기 코드가 나타난 뒤 수동 재시도로 복구된 현상을 조사하고, 로그인 사진 E2E 검사와 두 기기 동기화 회귀 검사를 보강한다. 검증된 변경과 기록을 운영 `master`에 push해 다른 PC에서 바로 이어갈 수 있게 한다.

## 2. 관련 확정 결정

- `AUTOMATIC-SAVE-AND-GUEST-COVER-01`: 로그인 신규 사진만 저장 흐름에서 비공개 계정 사본으로 전송하며, 실패·오프라인은 같은 카드의 기기 저장과 재시도 의도를 보존한다. 비로그인 사진 작성은 막고 공식 표지 카드는 허용한다.
- 기존 사진 일괄 업로드, 공개 게시, 이미지 권리 정책 변경은 이번 범위가 아니다.
- 사용자가 이번 턴에 남은 작업 및 Git 업데이트를 명시적으로 지시했다. 배포는 Git `master` → Vercel Git 연동으로 추적한다.

## 3. 현재 상태와 저장소 증거

- 시작 Git `master`/원격 `979a759`는 clean. 직전 `Service quality` 두 job 성공, 운영 build SHA 일치.
- 사용자 확인: 신규 iPhone Safari 사진 카드는 첫 시도에 `photo_transfer_...` 성격의 코드가 뜬 후 Retry로 복구됐고 PC에서도 카드·사진이 보였다. 정확한 오류 코드는 없으므로 원인 확정은 불가하다.
- `src/features/memory/application/autoSavePrivatePhotos.js`는 사진 의도별 오류를 모두 `pending` 수치로 합쳐 첫 실패 원인을 가린다. `saveNewMemoryToAccount.js`는 이를 `PHOTO_TRANSFER_PENDING`으로 표시한다. `useMemoryAccountSync.js`에도 독립 자동 drain이 있어 동시 실행·순서의 계약을 확인해야 한다.
- `tests/memory-card-composer.spec.ts`, `tests/web-image-intake.spec.ts`, `tests/channel-service.spec.ts`에는 과거 Guest 사진 작성 전제의 `fixme` 10건이 남아 있다. 기존 로그인 사진 테스트 fixture는 `tests/memory-save-account.spec.ts`와 `tests/private-image-sync.spec.ts`에 있다.
- 실제 iPhone 수정·삭제·오프라인 왕복은 아직 사용자 확인이 없다. 합성 두 BrowserContext 검사는 실기기 PASS를 대체하지 않는다.

## 4. 범위

### 포함

사진 대기 원인 경로 분석, 필요한 범위의 제한된 재시도·진단 개선, 현행 로그인 사진 검사 보강, 두 독립 기기 합성 계정 동기화 검사, 실기기 결과 범위 구분, CI·Git·운영 SHA 대조, 다른 PC 인계. 10월9일 운영 두 브라우저 직접 검사에서 발견한 private-only DB의 카드 삭제 RPC 누락도 같은 기존 W06/W19 작업으로 보완한다. 공개 migration/flags는 켜지 않고 삭제 fence·인증·계정 경계를 유지하는 additive 호환 RPC와 선택적 스키마 회귀 검사를 먼저 준비한다.

### 제외

운영 개인 사진·토큰을 테스트 fixture로 가져오기, 기존 사진 일괄 업로드, 파괴적 DB migration, 공개 게시 활성화, 권리·용량 정책 변경, 새 기능 UI 디자인.

## 5. 아키텍처·데이터 흐름

새 사진은 먼저 기기 카드와 원본, 사진 전송 의도를 보존한다. 계정 metadata가 카드·asset의 원격 버전을 확정한 뒤 기존 idempotent operation을 통해 최적화 사본을 올린다. 첫 시도의 일시적 대기는 수동 조작 없이 제한적으로 재시도하되, 소유자·세션 변경, 정책·quota·권리 오류를 무한 재시도하지 않는다. 검사 fixture는 합성 계정·사진과 가짜 gateway를 사용한다.

## 6. 변경 파일 지도

이 계획 문서, `autoSavePrivatePhotos.js`/`saveNewMemoryToAccount.js` 및 해당 unit, 로그인 사진 E2E spec/helper, 독립 기기 sync spec, 필요 시 `.github/workflows/quality.yml`, 시작/인계 문서. 실제 목록은 완료 보고에 기록한다.

## 7. 데이터·스키마 마이그레이션

초기 사진 재시도 보완에는 없음. 후속 운영 직접 검사에서 private-only 스키마에 `retire_memory_card_publications(uuid)`가 없는 것이 확인됐다. 기존 fence 테이블·private-media 정리 trigger는 설치돼 있다. additive migration으로 누락된 RPC만 설치하고 기존 full-public 구현은 보존한다. full-public 의존성이 불완전하면 삭제를 거부하고 원본을 보존한다. 사용자에게 이미 승인받은 중요 기능 마감·운영 DB 업데이트 범위에서, 로컬 selective/full SQL 검사 → 대상 읽기 대조/스키마 사본 → 제한된 설치/이력 기록 → 두 브라우저 테스트 카드 삭제를 순서대로 수행한다. 정책·bucket·기존 사용자 행은 migration에서 바꾸지 않는다.

## 8. 마일스톤

1. 첫 대기 코드가 발생하는 가능한 단계와 유지되는 사진 의도·카드 ID를 코드/테스트로 확인한다.
2. 로그인 사진 작성·재시도·취소 등 과거 `fixme`의 실제 목적을 현행 정책으로 재검증하고, 의미 있는 시나리오만 활성화한다.
3. 두 독립 기기 합성 저장·수정·삭제·오프라인 복구가 기대대로 수렴하는지 검사한다.
4. 관련 단위/E2E/build/CI 통과 후 Git `master`와 운영 SHA를 대조하고, 실제 iPhone 확인 범위를 분리해 인계한다.

## 9. 테스트와 검증

관련 unit과 변경 spec을 먼저 실행한다. 이후 전체 unit, catalog, CI 대상 브라우저·빌드와 GitHub 필수 job을 확인한다. 개인 데이터 없이 합성 fixture만 사용한다. 실제 iPhone Safari 결과는 사용자 확인 범위만 PASS로 쓴다.

## 10. 보안·개인정보·권리 영향

개인 사진은 기존 권한·비공개 정책·동의 경계를 그대로 따른다. 재시도는 저장 시 새로 선택한 사진의 의도에만 한정하고, 다른 계정의 의도를 drain하지 않는다. 로그에 사진 bytes·토큰·사용자 메모를 남기지 않는다.

## 11. 관찰 가능성·분석 이벤트

새 개인정보 분석 이벤트는 만들지 않는다. 사용자에게 노출되는 안전한 대기 원인과 CI 실패 증거를 통해 metadata/사진 단계를 구분한다.

## 12. 롤백·복구

사진 재시도 변경은 해당 Git 커밋을 revert해 `master`로 push한다. 기기에 이미 확정된 카드·원본·사진 의도는 삭제하지 않는다. 후속 삭제 RPC 호환 설치는 설치 전 존재 여부/함수 정의·ACL을 기록하고, 새로 설치된 private-only RPC만 원복할 수 있게 한다. 삭제 fence와 이미 생긴 정리 대기 기록을 지우거나 카드/사진을 되살리지 않는다. 운영 시험에서 사용자가 지정한 테스트 카드 삭제는 의도된 결과이며 다른 개인 행은 건드리지 않는다.

## 13. 위험과 완화

첫 오류 원문이 없어서 단일 원인으로 몰아가지 않는다. 재시도는 횟수·시간을 제한하고 중복 업로드 idempotency를 유지한다. 합성 브라우저 검사를 실제 iPhone 성공으로 과장하지 않는다.

## 14. 필요한 사용자 결정

현재 코드·테스트·Git 배포에 추가 결정은 없다. 실제 iPhone 수정/삭제/오프라인 검사는 사용자 기기 조작이 필요하며 결과가 오기 전에는 미확인으로 남긴다.

## 15. 진행 기록

- 2026-10-09 다른 PC 재개 계획: `master`의 `35fb912`를 이 PC에 fast-forward했고 이번 PC의 unit458/build20이 통과했다. 사용자의 후속 진행 지시에 따라 기존 테스트 환경 파일로 로그인 가능한 로컬 실행을 준비하고, 두 독립 브라우저의 수정·삭제·오프라인 복구 검사를 이 PC에서 확인한다. 기본 `.env.local`과 개인 브라우저 기록은 보존하고 로컬 실행의 Public·사진 원격 전송은 켜지 않는다. 운영 SHA/CI는 읽기로 대조한다. 실제 iPhone 결과·운영 DB/설정 변경·새 배포는 이번 준비만으로 완료 처리하지 않는다.
- 2026-10-09 다른 PC 재개 결과: 기존 `.env.moemoatest.local`의 테스트 프로젝트 `nmgkhknponvzcwliajyk`로 실행했다. 실제 `http://127.0.0.1:4321/data/`에서 기존 테스트 A 계정 연결, Memory/Board 및 작품/감상 동기화 완료 표시를 확인했다. 공개 Auth 설정 조회 HTTP200/Google 활성도 확인했다. 기본 `.env.local`·계정 토큰·원본을 복사하거나 출력하지 않았다.
- 2026-10-09 이번 PC 실행 명령: `npm ci --no-audit --no-fund` 성공(Node24.19.0/npm11.17.0), `npm run test:unit` 458/458 PASS, `npm run build` 20페이지 PASS. 후속 `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4358 node scripts/run-e2e.mjs tests/memory-cross-device-sync.spec.ts --project=chromium --project=webkit --workers=1 --reporter=line`은 첫 서버 준비 시간 초과로 실패했고 `.cache/resume-20261009-cross-device.log`에 보존했다. 준비된 로컬4321을 대상으로 같은 검사를 다시 실행해 두 독립 BrowserContext의 수정·오프라인/재로드·재접속·삭제 수렴 2/2 PASS(`.cache/resume-20261009-cross-device-ready.log`). wrapper가4322에 띄운 추가 서버는 사용되지 않았고 종료됐으며4321만 남았다. 이 검사는 합성 metadata gateway이며 운영 사진 bytes·실기기 검증이 아니다.
- 2026-10-09 운영 읽기 대조: Git `35fb912e56ea49c69f433b94559350d5283e0372`와 운영 build-info의 commit/checkoutCommit 일치, source=vercel-git/semanticMatch=true. 최신 Service quality37818042096 성공과 현재 maintenance/health 성공 상태를 확인했다. 운영 Archive 실제 화면은 읽기만 확인했다. DB migration/정책/운영 flags 변경·개인 사진 업로드 없음. 현재 구조 문서의 종료된 시스템 디자인 신규 작성/사진 flag off 설명을 현행 확정 결정에 맞췄다.
- 2026-10-09 실기기 진행: 사용자가 운영 iPhone Safari에서 새 테스트 사진 카드의 저장·짧은 감상 수정 완료를 보고했다. 같은 계정의 운영 PC에서 오늘 생성한 카드, 수정된 테스트 감상 일치, 사진 사본 디코딩(740×1600), 다른 기기 이용 가능 표시를 직접 확인했다. 앞서 같은 작품의 어제 카드를 대조한 착오를 정정했고, 그때의 감상 없음은 동기화 실패로 판정하지 않는다. 사용자가 보낸 작품 감상 탭에는 별도 WatchLog도 표시됐으며 카드 감상과 혼합하지 않았다. 사진 bytes·서명 URL·계정 식별자·개인 메모는 증거 파일에 저장하지 않는다. 다음은 동일한 새 카드의 오프라인 수정/재로드/재접속이며 아직 미확인이다.
- 2026-10-09 직접 두 브라우저: 사용자 요청으로 추가 휴대폰 조작 요청을 중단했다. 앱 브라우저와 Chrome의 독립 계정 저장소에서 동일한 오늘 테스트 카드·사진(740×1600)을 확인하고, Chrome 감상 수정 → 앱 브라우저 재로드 후 수정 수신을 확인했다. Chrome 삭제는 `공개 철회 미확인`으로 안전하게 중단됐다. 운영 DB 읽기 검사에서 retirement/revoke RPC와 Public 테이블은 없고 private 삭제 fence/trigger와 private-boundary migration은 설치됐음을 확인했다. migration `20261009090000`으로 누락된 private-only RPC만 추가한다. full-public 함수가 이미 있는 경우 정의·ACL을 건드리지 않고, 나중에 Public 테이블만 일부 설치되면 실패하도록 한다. 향후 Public 활성화에서는 full retirement 구현으로 원자적 교체하는 별도 migration 검토가 필요하다.
- 2026-10-09 삭제 경계 로컬 검증: `wsl -u postgres -e bash /mnt/e/web/anime/tools/private-images/run-retirement-compat.sh` 최종23 assertions PASS(누락 재현, 인증/익명, B→A 사본 보존, 즉시 읽기 차단, 중복·늦은 삽입 fence, partial-public 거부, 설치/롤백). 첫 fixture는 기본 quota0 때문에 예약이 실패했고 합성 정책 값만 보정했다. 기존 `tools/private-images/run-local-postgres.sh` full schema51 assertions/동시 quota·동일 operation race2 PASS. 전체 migration replay에서 기존 Public retirement도 유지된다. CI에 selective 계약을 추가했다. 운영 적용 파일은 `tools/private-images/activate-retirement-compat-20261009.sql`, 제한 롤백은 같은 폴더 `rollback-retirement-compat-20261009.sql`이다. 이 줄 작성 시 운영 적용/삭제 재검증은 아직 전이다.
- 2026-10-09: Git `979a759` clean 확인. 결정·시작·운영 마감/자동 저장 계획을 읽고 사진 대기 경로와 10건의 과거 Guest 테스트, 실제 기기 미확인 범위를 식별했다.
- 2026-10-09: 사진 전송 의도 drain이 모든 오류를 `pending`으로 합치는 것을 확인. 일시적인 `PRIVATE_IMAGE_REQUEST_FAILED`만 동일한 journal/operation으로 350ms 뒤 1회 재시도하고, 정책·quota 오류는 반복하지 않도록 수정. 허용된 안전 코드만 카드 저장 결과에 전달하며 알 수 없는 내부 오류는 일반 대기 코드로 남긴다. 관련 unit 15 PASS, React Doctor 변경 파일 검사 92점·새 진단 0건.
- 2026-10-09: 독립 BrowserContext·IndexedDB와 합성 공용 gateway로 카드 저장→다른 기기 pull→오프라인 수정 대기→재로드·재접속 복구→반대 기기 삭제/tombstone 반영을 확인. Chromium 1 PASS, WebKit 1 PASS. GitHub CI Chromium 목록에 추가했다.
- 2026-10-09: 과거 Guest 사진 전제의 `test.fixme` 10건을 로그인 합성 계정·실제 파일 선택·가짜 private-image API로 전환했다. 관련 카드 작성/계정 저장 Chromium 21 PASS, Web 이미지/Guest/레이아웃 13 PASS, channel 사진 1 PASS, 남은 `test.fixme` 0건. CI는 사진 flag를 켠 전용 실행 단계에서 이를 검사한다.
- 2026-10-09: 전체 unit 458 PASS, catalog 256 PASS/기존 skip 2건. Chromium 주요 회귀 81건 중 79 PASS·기존 skip 1건·팝업 harness 로딩 지연 1건 실패; 해당 `service-finishing.spec.ts` 단독 재실행 6 PASS. 이 실패는 사진 코드 경로가 아니라 Vite test harness 첫 마운트 후 버튼 대기에서 발생했고, CI 결과도 확인한다.
- 2026-10-09: 화면·감상 channel 회귀 80 PASS/기존 skip 5건, 정적 Web 빌드 20페이지 PASS. React Doctor 변경 파일 92/100, 새 진단 0건. 모든 fixture의 계정·이미지·gateway는 합성값이며 운영 데이터 접근은 없다.
- 2026-10-09: 구현·테스트·인계 커밋 `364de73988d85213c6bc25a5991e2e9c7c62826c`를 원격 `master`에 push. [GitHub Service quality 37816923071](https://github.com/Newrred/anime-collector/actions/runs/37816923071)의 `publication-contract`·`verify` 모두 성공(verify 7분 50초). 특히 첫 로컬 묶음에서 지연됐던 팝업 harness도 CI 전체 묶음에서는 통과했다. Vercel Git 상태 success, 운영 `/build-info.json`의 `commit`·`checkoutCommit`과 구현 커밋이 일치하고 `source=vercel-git`, `deploymentConfig.semanticMatch=true`를 확인. 운영 `/memory/new/`·`/archive/` HTTP 200. 사용자에게 실기기 수정·삭제 확인을 요청했지만 지금은 테스트하기 어려워 미확인으로 둔다.

## 16. 발견 사항과 계획 변경

- 2026-10-09 운영 삭제 후 발견: 승인된 테스트 카드의 서버 tombstone·삭제 fence·사진 retirement는 확인됐지만, 이미 열려 있던 반대 브라우저의 상세는 삭제된 카드와 사진을 계속 표시했다. `MemoryCardDetail.jsx`의 sync 완료 구독이 `getCard()`의 null을 무시하며 편집 중에는 구독 자체가 중단된다. 기존 계획에서 같은 W06/W19의 삭제 수렴을 마감한다. 먼저 합성 실제 IndexedDB/동기화와 상세 UI로 실패를 재현하고, 삭제 수신 시 상세/미리보기/편집을 비우는 최소 수정 후 Chromium·WebKit/owner 경계/빌드·Git 배포를 검증한다. 살아 있는 카드의 미저장 편집과 다른 계정 이벤트는 보존한다. 운영 DB 호환 설치는 완료됐고 Public·정책·일반 사용자 행은 변경하지 않았다.
- 정확한 첫 iPhone 오류 문자열/시각·네트워크 로그가 없어 이번 제한 재시도가 그때의 원인을 제거한다고 단정할 수 없다. 이후 동일 증상이 반복되면 안전 코드와 시각을 받아 사진 API 응답·기기 metadata 상태를 대조한다.
- 두 BrowserContext 검사는 실제 iPhone Safari의 앱 백그라운드·네트워크 전환이나 운영 계정/사진 정책을 대신하지 않는다.
- 대규모 로컬 회귀 중 팝업 harness가 한 차례 30초 안에 뜨지 않았지만 단독 실행에서는 통과했다. 실제 UI 결함이라고 단정하지 않고 GitHub CI에서도 재확인한다.

## 17. 완료 보고

- 변경: 일시적 사진 HTTP 요청 실패만 같은 의도/journal로 350ms 뒤 1회 재시도한다. 대기 이유는 지정된 안전 코드만 표시한다. 로그인 사진 `fixme` 10건을 제거하고 CI 사진 전용 실행과 합성 두 기기 메타데이터 왕복 회귀를 추가했다. 시작 문서에 인계 절차를 적었다.
- 로컬 검증: unit 458 PASS, catalog 256 PASS/2 skip, 로그인 사진 묶음 Chromium 21+13+1 PASS, 두 기기 Chromium·WebKit 각 1 PASS, channel 80 PASS/5 skip, build 20페이지 PASS. 주요 Chromium 묶음은 79 PASS/1 skip/팝업 harness 첫 로딩 지연 1 fail이었고 그 파일 단독 재실행은 6 PASS다.
- DB·환경 설정·운영 사진·권리 정책 변경 없음. 실패 시 이 변경 커밋을 `git revert`하고 `master`에 push한다. 사진 전송 의도와 기기 원본은 보존한다.
- 구현 커밋 `364de73`의 GitHub CI 두 job과 Vercel Git 배포가 성공했고, 당시 운영 SHA도 일치했다. 이 완료 기록을 반영한 문서 후속 커밋의 최신 원격/운영 SHA는 `/build-info.json`의 `commit`·`checkoutCommit`과 `git rev-parse origin/master`로 다시 대조한다.
- 실제 iPhone Safari에서 이번 개선본의 첫 저장 무재시도 성공률, 기기 간 수정·삭제·오프라인 복구는 사용자 실기기 확인이 남아 있다. 정확한 과거 `photo_transfer_...` 오류 문자열이 없어 이번 재시도가 원인을 완전히 해결했다고 주장하지 않는다.

## 18. 이 PC의 개발 실행과 실기기 확인

기존 `.env.local`은 운영 카탈로그 읽기 설정만 있으므로 그대로 둔다. 이 PC에 이미 있는 `.env.moemoatest.local`을 프로세스에 읽어 테스트 계정으로 개발한다. 개인 세션·비밀 설정은 Git으로 옮기지 않는다. 아래 실행은 테스트 계정 metadata와 기존 화면을 위한 것이며, 상대 경로의 운영 사진 API를 제공하는 서버가 아니므로 사진 원격 전송은 끈다.

```powershell
. .\.cache\activate.ps1
$env:PUBLIC_MEMORY_ACCOUNT_SYNC_V1 = '1'
$env:PUBLIC_TITLE_STATE_SYNC_V1 = '1'
$env:PUBLIC_MEMORY_CARD_CLASSIFICATION_SYNC_V1 = '1'
$env:PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1 = '1'
$env:PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1 = '0'
$env:PUBLIC_MEMORY_PUBLIC_PRIVATE_SOURCE_V1 = '0'
$env:PUBLIC_MEMORY_PUBLICATION_V1 = '0'
$env:PUBLIC_MEMORY_MINIHOME_V1 = '0'
$env:PUBLIC_MEMORY_FOLLOWS_V1 = '0'
$env:PUBLIC_MEMORY_MODERATION_V1 = '0'
node --env-file=.env.moemoatest.local node_modules/astro/astro.js dev --host 127.0.0.1 --port 4321
```

실기기 사진 검사는 `https://www.moemoa.xyz/`에서 같은 계정의 **새 테스트 카드**로 진행한다. 기존 개인 카드 삭제나 과거 사진의 일괄 전송을 하지 않는다. 순서는 새 사진 카드 저장/PC 표시 → iPhone의 짧은 감상 수정/PC 반영 → 오프라인 수정·재로드/온라인 복구 → 테스트 카드 삭제/PC 반영이다. 결과가 확인된 단계만 실제 기기 PASS로 기록한다.

현재 새 카드의 저장/수정은 사용자 iPhone 보고와 PC의 동일 카드·감상·사진 실제 표시로 확인했다. 첫 전송의 시도 횟수나 소요 시간은 수집하지 않아 무재시도 성공률은 미측정이다. 오프라인 수정/재로드/재접속은 요청했으나 사용자가 건너뛰고 진행하라고 지시해 이번 실기기 검사에서 제외했다. 미확인으로 남기며 합성 PASS로 대체하지 않는다. 후속 사용자 지시에 따라 추가 휴대폰 조작 요청을 중단하고, PC의 앱 브라우저와 Chrome의 독립 저장소/세션으로 수정·삭제를 직접 검사한다. 사용자가 삭제 가능하다고 확인한 오늘 테스트 카드만 대상으로 하며, 두 PC 브라우저 검사를 실제 iPhone 삭제 PASS로 기록하지 않는다. 작품의 WatchLog와 카드의 짧은 감상은 서로 다른 기록이므로 주소/생성일로 카드를 먼저 식별한다.

## 19. 두 화면 직접 검증과 삭제 경계 마감

- 읽은 기준: `AGENTS.md`, `CODEX_START_HERE.md`, 확정 결정01, QA07/변경 통제09, `PLANS.md`, 기존 단일 작업판과 이 ExecPlan, 현재 구조/운영 설정 지도. 구현은 `MemoryCardDetail.jsx`·private-image 상세/runtime·계정 owner/sync hook·metadata sync/IndexedDB 및 기존 cross-device/owner/editing/photo fixture와 quality workflow를 대조했다.
- 후속 변경 파일: `src/features/memory/components/MemoryCardDetail.jsx`의 null/편집 중 삭제 반영, `tests/memory-owner-boundary.spec.ts`의 실제 sync→열린 상세/편집 회귀2건, `supabase/migrations/20261009090000_private_card_retirement_compat.sql`의 인증/owner fence 호환 RPC, `tools/private-images/{run-retirement-compat.sh,retirement-compat-contract.sql,activate-retirement-compat-20261009.sql,rollback-retirement-compat-20261009.sql}`의 selective 회귀·guarded 적용/복귀, `.github/workflows/quality.yml`의 해당 SQL 검사. 시작 문서/현재 구조/이 계획/단일 작업판/release 증거를 최신화했다. 새 진행판·운영 의존성·개인 데이터 로그는 추가하지 않았다.
- 운영 DB: `MOEMOA_PRIVATE_RETIREMENT_20261009_01`, migration `20261009090000`을 guarded transaction으로 설치했다. 적용 직전 source 행 수/정책 hash와 적용 직후 값이 같고, 익명 실행 불가·인증 실행 가능·Public 테이블 없음·이력 기록을 확인했다. migration 소스는 `00fb614`이며 SHA256과 결과는 [release 증거](../release-v2/evidence/2026-10-09-private-retirement-production.json)에 있다. 기존 사용자 행·quota·bucket·공개 설정을 바꾸지 않았다. 제한 롤백 SQL은 새 compatibility RPC만 제거하며 fence/이미지 정리/tombstone을 보존한다. 운영 롤백은 실행하지 않았다.
- 실제 운영 브라우저: 앱 브라우저/Chrome의 독립 세션에서 같은 신규 사진과 수정 수신을 확인했다. 함수 설치 후 지정 테스트 카드의 Chrome 삭제가 성공해 Archive로 돌아갔고 서버 tombstone/fence/사진 retirement/READY 없음도 확인했다. 사진 bytes의 물리적 정리 완료나 이미 발급된 서명 URL의 즉시 무효화를 검증한 것은 아니다.
- 직접 발견한 UI 결함: 이미 열린 반대 상세가 동기화 후 `getCard() === null`을 무시해 삭제된 카드/사진을 유지했다. `MemoryCardDetail.jsx`는 null 수신 시 bundle/preview/편집/dialog를 비우고 not-found로 전환한다. 편집 중에도 삭제만 반영하며 살아 있는 카드의 미저장 입력은 유지한다. 다른 계정 event·late 응답의 기존 owner 경계는 보존한다.
- 재현/검증: 수정 전 합성 실제 IndexedDB·metadata sync의 삭제 수신은 완료됐지만 열린 상세/편집 중 상세가 사라지지 않는 실패를 각각 재현했다. 수정 후 최종 Chromium의 `memory-owner-boundary`·`memory-cross-device-sync`·`release-editing` 묶음 15 PASS, unit458 PASS, build20 PASS. `.cache/run-detail-sync.mjs`는 기존 `scripts/lib/isolatedE2eServer.mjs`로 계정 환경을 비운 격리 서버를 실행한 이 PC의 보조 실행 파일이며 CI는 기존 quality 목록에서 같은 spec을 실행한다. 명령은 `node .cache/run-detail-sync.mjs tests/memory-owner-boundary.spec.ts tests/memory-cross-device-sync.spec.ts tests/release-editing.spec.ts --project=chromium --workers=1 --reporter=line`, `npm run test:unit`, `npm run build`다.
- 실패 기록도 보존: 처음 실제 테스트 계정용4321 서버를 회귀 fixture에 재사용했을 때 mock session과 실제 Auth 설정이 섞여 fixture 준비가 실패했다. 격리 실행으로 구분했다. 선택적 WebKit 확대 검사는 순수 두 기기 metadata 수렴은 PASS지만 이번 상세 2건과 기존 owner 경계 1건이 계정 초기화/상세 진입 전에 실패했다. fixture를 공식 표지 참조로 바꾸고 gateway override 시점을 늦춰도 같은 초기화 차단이 반복돼 실제 iPhone/상세 PASS로 만들지 않는다. 확정 실패는 **WebKit 자동 검사의 계정 준비 단계**, 현재 사용자 iPhone 저장/수정의 실패로 판정하지 않는다. 관련 `.cache/detail-sync-*-20261009.log`에 보존했다.
- Git/운영: 구현 `d4f6d918e7bee99e943266c1a2351d71416e6612`를 기존 `master`에 push했고 [Vercel Git 배포](https://vercel.com/newrreds-projects/anime-collector/2TNMYXXRXH7pC8QcTCZzoPvfLUrk) success, 운영 build-info의 commit/checkoutCommit과 동일 SHA·source=vercel-git·config semantic match를 확인했다. 문서 후속 커밋의 정확한 최신 결과도 `/build-info.json` 및 같은 SHA의 [Service quality](https://github.com/Newrred/anime-collector/actions/workflows/quality.yml)를 대조한다. 로컬 빌드를 운영으로 promote하지 않았다.
- 구현 CI 완료: [Service quality37901937296](https://github.com/Newrred/anime-collector/actions/runs/37901937296)의 `verify`·`publication-contract` 모두 success. 기존 주요 회귀와 새 상세 삭제2건, 로그인 사진/모바일/Guest·Web 감상/디자인 및 selective SQL 검사까지 통과했다. 이후 결과만 추가하는 문서 커밋은 source/SQL/flags를 바꾸지 않는다. 해당 후속 SHA의 자동 CI가 별도로 시작되면 구현 CI 성공과 구분한다.
- 배포 후 실제 UI PASS: 새 검증용 **공식 표지 카드** 한 개를 Chrome의 작성 UI에서 명시 선택/테스트 감상으로 저장하고, 독립 앱 브라우저에서도 동일 카드 표시를 확인했다. 앱 브라우저는 감상 편집 중으로 두고 Chrome에서 그 테스트 카드만 삭제했다. 앱 브라우저는 재로드/이동 없이 기존 자동 sync 주기 안에 카드/이미지/미저장 편집을 제거하고 `Card not found.`로 전환했다. Chrome에서 같은 삭제된 주소로 다시 접근해도 `카드를 찾을 수 없어요.`였다. 새 개인 사진 업로드·기존 카드/WatchLog 수정·공개 게시 없음. 두 결과 screenshot은 이 PC의 `.cache/two-browser-delete-*-20261009.jpg`에만 남기고 사용자 데이터가 포함될 수 있는 화면은 Git에 넣지 않았다.
- 현재 W06/W19 미완료: 실제 iPhone 오프라인·삭제는 요청에 따라 이번 범위에서 제외/미검증, WebKit 상세 계정 fixture 준비 차단은 남는다. 삭제 반영은 기존 자동 sync 주기에 따르며 즉시 실시간 push를 약속하지 않는다. Public 출시·Android 전체 완료도 아니다. 외부 권한 추가 요청 없음. 다음1개는 **WebKit 자동 검사의 계정 초기화 fixture 차단 원인 분리**다. 추가 휴대폰 조작을 요청하지 않는다.
