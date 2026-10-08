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

사진 대기 원인 경로 분석, 필요한 범위의 제한된 재시도·진단 개선, 현행 로그인 사진 검사 보강, 두 독립 기기 합성 계정 동기화 검사, 실기기 결과 범위 구분, CI·Git·운영 SHA 대조, 다른 PC 인계.

### 제외

운영 개인 사진·토큰을 테스트로 가져오기, 기존 사진 일괄 업로드, DB migration, 공개 게시 활성화, 권리·용량 정책 변경, 새 기능 UI 디자인.

## 5. 아키텍처·데이터 흐름

새 사진은 먼저 기기 카드와 원본, 사진 전송 의도를 보존한다. 계정 metadata가 카드·asset의 원격 버전을 확정한 뒤 기존 idempotent operation을 통해 최적화 사본을 올린다. 첫 시도의 일시적 대기는 수동 조작 없이 제한적으로 재시도하되, 소유자·세션 변경, 정책·quota·권리 오류를 무한 재시도하지 않는다. 검사 fixture는 합성 계정·사진과 가짜 gateway를 사용한다.

## 6. 변경 파일 지도

이 계획 문서, `autoSavePrivatePhotos.js`/`saveNewMemoryToAccount.js` 및 해당 unit, 로그인 사진 E2E spec/helper, 독립 기기 sync spec, 필요 시 `.github/workflows/quality.yml`, 시작/인계 문서. 실제 목록은 완료 보고에 기록한다.

## 7. 데이터·스키마 마이그레이션

없음. 운영 DB/Storage 행·설정은 변경하지 않는다.

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

문제가 생기면 해당 Git 커밋을 revert해 `master`로 push한다. 기기에 이미 확정된 카드·원본·사진 의도는 삭제하지 않는다. 서버·DB를 건드리지 않으므로 데이터 롤백은 없다.

## 13. 위험과 완화

첫 오류 원문이 없어서 단일 원인으로 몰아가지 않는다. 재시도는 횟수·시간을 제한하고 중복 업로드 idempotency를 유지한다. 합성 브라우저 검사를 실제 iPhone 성공으로 과장하지 않는다.

## 14. 필요한 사용자 결정

현재 코드·테스트·Git 배포에 추가 결정은 없다. 실제 iPhone 수정/삭제/오프라인 검사는 사용자 기기 조작이 필요하며 결과가 오기 전에는 미확인으로 남긴다.

## 15. 진행 기록

- 2026-10-09: Git `979a759` clean 확인. 결정·시작·운영 마감/자동 저장 계획을 읽고 사진 대기 경로와 10건의 과거 Guest 테스트, 실제 기기 미확인 범위를 식별했다.
- 2026-10-09: 사진 전송 의도 drain이 모든 오류를 `pending`으로 합치는 것을 확인. 일시적인 `PRIVATE_IMAGE_REQUEST_FAILED`만 동일한 journal/operation으로 350ms 뒤 1회 재시도하고, 정책·quota 오류는 반복하지 않도록 수정. 허용된 안전 코드만 카드 저장 결과에 전달하며 알 수 없는 내부 오류는 일반 대기 코드로 남긴다. 관련 unit 15 PASS, React Doctor 변경 파일 검사 92점·새 진단 0건.
- 2026-10-09: 독립 BrowserContext·IndexedDB와 합성 공용 gateway로 카드 저장→다른 기기 pull→오프라인 수정 대기→재로드·재접속 복구→반대 기기 삭제/tombstone 반영을 확인. Chromium 1 PASS, WebKit 1 PASS. GitHub CI Chromium 목록에 추가했다.
- 2026-10-09: 과거 Guest 사진 전제의 `test.fixme` 10건을 로그인 합성 계정·실제 파일 선택·가짜 private-image API로 전환했다. 관련 카드 작성/계정 저장 Chromium 21 PASS, Web 이미지/Guest/레이아웃 13 PASS, channel 사진 1 PASS, 남은 `test.fixme` 0건. CI는 사진 flag를 켠 전용 실행 단계에서 이를 검사한다.
- 2026-10-09: 전체 unit 458 PASS, catalog 256 PASS/기존 skip 2건. Chromium 주요 회귀 81건 중 79 PASS·기존 skip 1건·팝업 harness 로딩 지연 1건 실패; 해당 `service-finishing.spec.ts` 단독 재실행 6 PASS. 이 실패는 사진 코드 경로가 아니라 Vite test harness 첫 마운트 후 버튼 대기에서 발생했고, CI 결과도 확인한다.
- 2026-10-09: 화면·감상 channel 회귀 80 PASS/기존 skip 5건, 정적 Web 빌드 20페이지 PASS. React Doctor 변경 파일 92/100, 새 진단 0건. 모든 fixture의 계정·이미지·gateway는 합성값이며 운영 데이터 접근은 없다.

## 16. 발견 사항과 계획 변경

- 정확한 첫 iPhone 오류 문자열/시각·네트워크 로그가 없어 이번 제한 재시도가 그때의 원인을 제거한다고 단정할 수 없다. 이후 동일 증상이 반복되면 안전 코드와 시각을 받아 사진 API 응답·기기 metadata 상태를 대조한다.
- 두 BrowserContext 검사는 실제 iPhone Safari의 앱 백그라운드·네트워크 전환이나 운영 계정/사진 정책을 대신하지 않는다.
- 대규모 로컬 회귀 중 팝업 harness가 한 차례 30초 안에 뜨지 않았지만 단독 실행에서는 통과했다. 실제 UI 결함이라고 단정하지 않고 GitHub CI에서도 재확인한다.

## 17. 완료 보고

- 변경: 일시적 사진 HTTP 요청 실패만 같은 의도/journal로 350ms 뒤 1회 재시도한다. 대기 이유는 지정된 안전 코드만 표시한다. 로그인 사진 `fixme` 10건을 제거하고 CI 사진 전용 실행과 합성 두 기기 메타데이터 왕복 회귀를 추가했다. 시작 문서에 인계 절차를 적었다.
- 로컬 검증: unit 458 PASS, catalog 256 PASS/2 skip, 로그인 사진 묶음 Chromium 21+13+1 PASS, 두 기기 Chromium·WebKit 각 1 PASS, channel 80 PASS/5 skip, build 20페이지 PASS. 주요 Chromium 묶음은 79 PASS/1 skip/팝업 harness 첫 로딩 지연 1 fail이었고 그 파일 단독 재실행은 6 PASS다.
- DB·환경 설정·운영 사진·권리 정책 변경 없음. 실패 시 이 변경 커밋을 `git revert`하고 `master`에 push한다. 사진 전송 의도와 기기 원본은 보존한다.
- GitHub CI와 Vercel Git 배포는 push 후 확인한다. 운영 SHA는 `/build-info.json`의 `commit`·`checkoutCommit`이 원격 `master`와 같은지 확인한다.
- 실제 iPhone Safari에서 이번 개선본의 첫 저장 무재시도 성공률, 기기 간 수정·삭제·오프라인 복구는 사용자 실기기 확인이 남아 있다. 정확한 과거 `photo_transfer_...` 오류 문자열이 없어 이번 재시도가 원인을 완전히 해결했다고 주장하지 않는다.
