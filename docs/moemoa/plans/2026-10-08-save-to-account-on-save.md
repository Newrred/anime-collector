# 저장 한 번으로 계정까지 반영 — ExecPlan

> 2026-10-08 범위 확장: 사용자는 모든 로그인 기록을 자동 계정 반영하고, 비로그인은 작품·감상 기록 및 공식 표지 카드를 기기에 저장하도록 결정했다. 직접 선택한 개인 사진에는 로그인이 필요하다. 시스템 디자인 카드의 신규 작성은 제거하되 기존 카드의 표시·보존은 유지한다.

## 1. 목적과 사용자 결과
로그인한 사용자가 작품·감상 기록, Memory 카드, 보드, 새 개인 사진을 저장·수정·삭제하면 별도 동기화 버튼 없이 계정에 반영한다. 비로그인은 작품·감상 및 공식 표지 카드를 기기에 저장할 수 있다. 개인 사진을 선택하려면 로그인 안내를 제공한다.

## 2. 관련 확정 결정
`FREE-PRIVATE-IMAGE-SYNC-01`, `TITLE-STATE-SYNC-01`, `CARD-01`을 유지한다. 2026-10-08 사용자는 카드 정보와 사진 모두 저장 시 자동 반영을 선택하고, 비로그인 공식 표지 카드를 허용하며 시스템 디자인 작성 종료를 지시했다. 이 결정은 기존 `ACCOUNT-01`의 guest Private 카드·사진 허용 범위를 변경한다. 사진 원본은 기기에 남고 서버에는 용량 제한된 비공개 최적화 사본만 저장한다. 과거 사진을 일괄 업로드하거나 공개하지 않는다.

## 3. 현재 상태와 저장소 증거
`useTitleStateSync.js:40-65`와 `TopNavDataMenu.jsx:120-121`은 작품·감상 상태를 자동 반영한다. 반면 `useMemoryAccountSync.js:118-136`의 Memory metadata 동기화는 수동 호출이고 `MemoryAccountPanel.jsx:89`가 그 버튼이다. `useMemoryCardComposer.js:285-320`은 로컬 카드 작성 직후 Archive로 이동한다. `MemoryPrivateImageSync.jsx:82-91`은 상세에서 별도 사진 전송 동의를 요구한다. `createPrivateImageTransfer.js:83-119`는 계정·asset 원격 버전·원본 hash·정책·용량을 서버에서 다시 확인한다.

## 4. 범위
### 포함
새 카드 및 카드 수정·삭제·보드 변경의 로컬 저장 뒤 로그인 계정 metadata 자동 동기화, 새로 선택한 개인 사진의 비공개 사본 전송, 재진입·온라인 복귀 시 재시도, 비로그인 사진 선택 로그인 안내, 시스템 디자인 신규 작성 제거, 성공/부분실패 상태 표시. 기존 작품·감상 자동 동기화와 기존 수동 복구 도구는 유지한다.
### 제외
과거 사진 일괄 전송, 로그인 전 Guest 기록의 자동 승격, 기존 시스템 디자인 카드 삭제·마이그레이션, 원본 파일 전체 백업, 공개 게시, Android 네이티브 출시.

## 5. 아키텍처·데이터 흐름
카드·원본을 현행 IndexedDB/기기 저장소에 먼저 확정한다. 로그인 계정 owner가 맞으면 모든 Memory mutation의 현행 outbox를 자동 동기화하고, 온라인 복귀·화면 재진입에서도 재시도한다. 선택된 신규 개인 사진은 선택·저장 행위와 안내를 전송 동의로 기록하고 asset 원격 버전을 확인한 뒤 현행 private image transfer에 전달한다. 계정 변경·오프라인·충돌·용량/정책 실패 시 로컬 결과를 삭제하거나 재작성하지 않는다. 이미 만들어진 cardId로만 계정 저장을 재시도한다. 공식 표지는 이미지 bytes 대신 카탈로그 참조값을 카드에 저장한다. 작품 방영 정보·캐릭터 목록은 서비스 카탈로그를 조회하되 카드에는 연결 ID와 당시 제목 등의 작은 snapshot, 사용자가 직접 고른 캐릭터 분류·감상이 개인 기록으로 남는다. 카탈로그 캐릭터가 없으면 일부 작품에서 AniList fallback을 사용한다.

## 6. 변경 파일 지도
Memory runtime의 mutation 알림, account 자동 동기화 hook, private photo 전송 의도 보존·재시도, composer·상세·보드 문구와 게이트, 결정 로그·제품 흐름·작업판 및 검증. 기존 서버 RPC는 변경하지 않는다.

## 7. 데이터·스키마 마이그레이션
운영에는 기존 카드/asset 동기화 스키마만 있고 private-image manifest·bucket·정책이 없다. 기존 동기화 outbox/asset 버전을 재사용하고, `20260925152858` 삭제 fence 호환 prelude→`20260925152859` 비공개 표현 경계→`20261008090000` 용량 관측 RPC를 선택 적용한다. 신규 사진의 전송 의도만 기기 전용 저장소에 보관한다. 기존 guest/system-design 데이터는 삭제하지 않는다.

## 8. 마일스톤
1. guest는 공식 표지 카드 작성과 작품·감상 기록을 유지하고, 사진 선택에서 로그인 안내를 받는다. 시스템 디자인 신규 작성 버튼은 사라진다.
2. 로컬 저장→계정 metadata→새 사진 순서를 연결하며 모든 Memory mutation에서 자동 동기화를 요청한다.
3. 부분 실패 시 카드가 한 번만 생성되고 같은 cardId/asset version으로 자동·수동 재시도되게 한다.

## 9. 테스트와 검증
계정 일치/변경, Guest 공식 표지·사진 게이트, flag off, metadata 실패/부분 완료, 사진 성공/실패/재진입, 보드·카드 mutation, 중복 저장 방지의 단위·브라우저 검사를 실행한다. 기존 카드 작성/계정/이미지 회귀, WebKit 핵심 저장, 빌드, React Doctor를 확인한다. 실제 두 기기/hosted image 전송은 별도 증거로 남긴다.

## 10. 보안·개인정보·권리 영향
로그인 사용자가 새 개인 사진을 선택·저장할 때 비공개 최적화 사본 저장을 안내하고 그 사진만 전송한다. 과거 로컬 사진이나 guest 사진을 로그인만으로 자동 전송하지 않는다. 원본·개인 메모·토큰을 일반 로그에 넣지 않는다. 기존 RLS·policy·hash·quota·source-version 검사는 유지한다.

## 11. 관찰 가능성·분석 이벤트
새 분석 이벤트를 만들지 않는다. 화면에는 기기 저장과 계정 반영 대기를 구분해 표시하고, 정상 경로의 수동 동기화 유도를 제거한다. 서버 오류 원문 대신 안전한 결과 문구를 쓴다.

## 12. 롤백·복구
클라이언트 변경을 되돌리면 현행 수동 동기화 경로가 남는다. 이미 로컬 확정된 카드/원본과 계정에 반영된 기록은 삭제하지 않는다. 운영 배포가 필요하면 `master` Git SHA와 Vercel SHA를 확인한다.

## 13. 위험과 완화
저장 중 네트워크 지연과 앱 이탈은 로컬 확정을 잃지 않도록 하고, 부분 실패 화면에서 같은 카드의 계정 반영만 재시도한다. Guest→로그인 승격은 기존 명시 검토를 유지한다. 서버 기능 flag가 꺼져 있으면 사진 전송을 제공하지 않는다.

## 14. 필요한 사용자 결정
카드 정보와 신규 개인 사진 모두 저장 시 반영 및 Git `master` 운영 배포: 사용자 2026-10-08 답변과 후속 진행 지시로 확정. 관리 화면에서 민감한 개인 사진 보관 권한을 여는 최종 조작은 브라우저의 행동 시점 확인 정책을 따른다.

## 15. 진행 기록
- 2026-10-08 운영 iPhone 후속: 새 사진 카드가 기기에 저장됐으나 계정 반영 대기 상태가 재시도 후에도 남았다. 운영 DB에는 해당 카드/사진이 아직 없고 사진 API 요청도 도착하지 않았다. metadata 동기화 실패가 현재 동일 안내로 가려져 원인 구분이 불가능하다. 카드 ID를 유지한 채 계정/metadata 실패 종류를 안전하게 표시하고, 전체 동기화 결과와 별개로 이 카드·asset의 실제 원격 확정 상태를 검사한다. 서버 정책·기존 사진 데이터는 변경하지 않는다.
- 2026-10-08 운영 iPhone 후속 검증: 단위 454/454, 해당 신규 사진 저장·재진입 Chromium 1/1, Web 20페이지 build, React Doctor 변경분 93/진단 0. 실제 iPhone의 기존 카드 재시도 결과와 정확한 실패 코드는 새 Git 배포 후 확인한다. 재시도는 새 카드를 만들지 않는다.
- 2026-10-08: 현재 코드/결정/운영 flag 조사 및 계획 작성.
- 2026-10-08: 새 카드의 로컬 저장→계정 metadata→선택한 비공개 사진 순서를 연결했다. 계정/사진 전송이 중단되면 로컬 카드를 보존하고 동일 cardId로 재시도한다. 첫 후보의 별도 사본 저장 선택 UI는 뒤이은 자동 저장 결정에 따라 제거했다.
- 2026-10-08: 합성 Chromium에서 신규 사진 전송 첫 실패→동일 operation 재시도와 기존 수동 사진 관리 2경로를 확인했다. 기존 계정 동기화 안내 회귀를 보정했다.
- 2026-10-08: 사용자 피드백으로 전체 Memory mutation 자동 동기화, guest 공식 표지 허용·사진 로그인, 시스템 디자인 신규 작성 제거로 범위를 확장했다. 기존 카드/원본 보존을 유지한다.
- 2026-10-08: 계정 저장 완료를 batch 응답만으로 판단하지 않고 방금 작성한 카드·asset의 실제 syncState도 확인하도록 보완했다. 과거 사진의 수동 전송 회귀는 신규 자동 저장과 분리된 fixture로 유지했다. 계정/로컬 여부가 달라도 틀리지 않게 주요 화면 문구를 정리했다.
- 2026-10-08: guest 공식 표지 카드 상세에서 사진 추가를 선택할 때 로그인만으로 guest 카드가 곧바로 계정 카드가 되는 것처럼 안내하지 않는다. 로그인 후 기기 기록 가져오기 화면으로 보내고, 기존 카드 승격을 마친 뒤 사진을 추가하도록 설명한다.

## 16. 발견 사항과 계획 변경
- 운영 `.env.production`의 `PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1=0`이므로 현재 Git 후보를 빌드해도 운영 사진 자동 전송은 켜지지 않는다. flag/서버 정책·용량과 실계정 두 기기 검증은 운영 적용 전 별도 확인이 필요하다.
- Windows Playwright WebKit은 테스트 사진 Blob을 IndexedDB에 넣을 때 `UnknownError: Error preparing Blob/File data to be stored in object store`를 내며, 이를 우회한 fixture에서도 private image journal Blob 저장이 `MEDIA_STORAGE_FULL`로 실패했다. 실제 iPhone Safari에서 새 자동 사진 전송 성공을 증명하지 못한 상태다. Chromium 합성 결과를 Safari/hosted 통과로 표시하지 않는다.
- 기존 공식 표지 회귀의 홈 선반은 catalog 정규 제목 `Frieren: Beyond Journey’s End`를 사용한다. fixture의 한국어 제목과 가짜 catalog ID 고정 기대를 현재 projection 계약에 맞게 보정했고, 작성→Archive→상세→홈 흐름 1건을 다시 통과했다.
- React Doctor가 찾은 `MemoryCardDetail` effect 의존성 누락을 수정하고, `useMemoryAccountSync`의 타이머/interval/리스너 생명주기를 별도 시작·해제 함수로 정리했다. 최종 변경 파일 검사 86점, 진단0이다.
- 시스템 디자인·비로그인 개인 사진 작성에 의존하던 오래된 브라우저 fixture가 여러 파일에 남아 있다. 제품 UI에서 해당 경로는 제거됐으므로, 전체 과거 회귀를 PASS로 주장하지 않고 이후 fixture 이관 대상으로 둔다.

## 17. 완료 보고
- 확장 범위의 로컬 후보는 unit 449/449, 관련 Chromium 자동 저장·Guest/계정 11/11, 공식 표지 관통 1/1, 기존 사진 관리 4/4, Web build 20페이지, React Doctor 86/진단0을 통과했다. 중복 검사 숫자는 합산하지 않는다. WebKit 사진 fixture 제한과 과거 E2E fixture 이관은 위 기록대로 남는다.
- 2026-10-08 운영 직접 조회: `okchpyagfucpzpyrfgol`은 이름이 `moemoa-preview`여도 운영 사이트가 참조하는 프로젝트다. private-image policy/manifest/bucket과 publication delete fence가 없고 `memory_cards`는 1행이다. 기존 `catalog-covers-preview` Storage는 4,292개·855,987,001 bytes. Vercel 서버 전용 DB 연결·사진 API 값은 Preview에만 있으며 Production에는 없다. 따라서 flag만 켜서 배포할 수 없다.
- 배포 후보 보완: 전체 Public migration을 켜지 않고 삭제 fence 호환 prelude+기존 비공개 migration을 선택 적용한다. 관측 RPC와 6시간 간격 GitHub maintenance로 `observed_at`의 24시간 만료를 갱신하고 만료/초과 시 닫힌다. 초기 정책은 계정당 50MB/60장, 서비스 전체 100MB, 월 읽기 계정당 250MB/전체 500MB다. 운영 사용량과 청구 확인 후 별도 상향할 수 있다.
- 향후 Public source-status migration(`20260923182210`)을 운영에 선택 적용할 때는 이미 생성된 삭제 fence 테이블을 검사하고 그 파일의 `create table`을 호환화해야 한다. 이번 사진 저장 작업이 Public 게시를 활성화하지는 않는다.
- 현재 재검증: unit 452/452, 자동 저장·guest·기존 사진 Chromium 15/15, 보드 3/3, 웹 20페이지 build, React Doctor 86/진단0. 로컬 PostgreSQL 전체 migration+비공개 계약 49 assertion/동시성 2 PASS. 운영 DB에서 세 migration+초기 정책+`supabase_migrations` 기록을 한 transaction에 넣고 마지막에 `rollback`하는 dry-run도 통과했다. 이는 영구 적용 또는 iPhone 실기기 검증을 뜻하지 않는다. Vercel/GitHub 설정, Git push, 두 기기 iPhone 확인은 아직 끝나지 않았다.
- 적용 순서: 운영 DB migration을 transaction 검증 후 기록→초기 정책 적용→Vercel Production 서버 전용 세 값/API flag/허용 origin/maintenance secret 설정→GitHub maintenance 변수/secret 설정→`master` Git push·Vercel SHA 확인→실제 iPhone 저장·PC 이미지 조회. 관리 secret 원문/개인 이미지는 Git과 보고서에 남기지 않는다.
- 운영 적용 기록(2026-10-08): `okchpyagfucpzpyrfgol`에서 세 migration을 하나의 transaction으로 적용하고 `supabase_migrations.schema_migrations`에 3건을 기록했다. 정책 release ID는 `MOEMOA_PRIVATE_20261008_01`, 계정당 50MB·60장/전체 100MB로 승인·활성화했다. 적용 후 별도 조회에서 비공개 버킷(`public=false`), manifest, 이력 3건을 확인했다. 서비스 권한으로 `observe_memory_private_image_capacity()`를 실제 호출해 `storedBytes=0`, `reservedBytes=0`, `globalReadBytes=0`의 새 관측 시각을 얻었다.
- Vercel Production에 서버 전용 DB 주소·공개 인증키·관리자 키, 사진 API flag·허용 origin, 정리/관측 flag·프로젝트 확인값·관리 비밀값을 저장했다. GitHub Actions에 같은 관리 비밀값과 활성화 변수/운영 origin을 등록했다. 원문 비밀값은 버전 관리 문서에 보관하지 않는다. 이 설정은 새 Git 배포부터 적용된다.
