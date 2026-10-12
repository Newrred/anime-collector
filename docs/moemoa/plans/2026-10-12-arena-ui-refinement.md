# MOEMOA 전체 화면 개선과 현재 버전 비교 ExecPlan

## 1. 목적과 사용자 결과

사용자 2026-10-12 요청: 전체 디자인 검수 결과를 바탕으로 Are.na를 다시 구체적으로 참고해 개선하고, 작업이 모두 끝난 뒤 현재/개선 차이를 볼 수 있게 준비한다. 실제 앱에서 반복 조작·설명 과밀·작업 혼합을 줄이며 같은 합성 데이터로 비교할 수 있는 PC/모바일 화면 모음을 제공한다.

## 2. 관련 확정 결정

이미지 중심, NO-HERO, 흰색/다크 테마와 분홍 주요 행동, 작품과 기억의 독립성, 로컬 사용·계정 자동 저장, 원본 보호, 공개 권리·현재 가입·게시 동의·신고·차단·이의제기와 운영 확인은 유지한다. 기본 약관 진입점만 현행 문서로 연결하며 과거 수락 문서 본문을 수정하지 않는다. 이번 요청은 새 운영 배포 승인이 아니다.

## 3. 현재 상태와 저장소 증거

- 현재 운영/master `33de5b4c985e009d14c8ecec6158c4511af946a2`를 기준으로 `codex/arena-ui-refinement-20261012`를 시작한다. 이전 handoff/tools가 다른 작업 브랜치는 전체 병합하지 않는다.
- 검수 `../reports/2026-10-12-full-page-design-review.md`: 33개 경로, 운영19개 상태, 주요 모바일5개. 작품56개 사례의 카드 장르 버튼169, 미니홈 이의 폼2 상시 노출, 모바일 작품 입력y≈908/저장y≈1345, 도움말 고정 미제공 문구와 기본 고지 경로의 초안 연결.
- `TitleAlbumCard.jsx`, `TitleCollectionView.jsx`, `channel-service.css`, `MemoryMinihome.jsx`, `MemorySafety.jsx`, `MemoryCardComposer.jsx`, `DataCenter.jsx`, `HelpCenter.jsx` 등 기존 render/handler를 확인한다.
- Are.na 채널과 블록 상세 실제 브라우저를 재조사하고 관찰값과 제안값을 구분한다. 레퍼런스 작품을 서비스 자산으로 복제하지 않는다.

## 4. 범위

### 포함

검수17항목: 작품 반복 장르/작성 버튼과 이미지 폭, 미니홈 편집/관계/알림 및 요청 시 이의 폼, 사진/표지 시작 경로, 도움말/고지 연결, 계정/동기화/백업/개인정보 분리, 드문 위험 행동, 상단 표시 설정, 빈 필터 설명, 상태별 오류/권한 행동, 작성 중 공통 CTA, 보드 공개 항목 접기, 운영자 신고 목록 읽기 쉬운 요약, 가입 언어 연속성, 티어 초기화 위계. 기존 기능이 모두 접근 가능하게 유지한다.

### 제외

새 기능·국가·상품·의존성, DB/schema/RLS/Storage 변경, 인증 계약·권한 부여 변경, 새 실계정 데이터/사진/게시/신고/동의, 배포와 환경/feature flag 변경. 비교 자료에는 실사용자 기록·이미지·계정·키를 넣지 않는다.

## 5. 아키텍처와 데이터 흐름

기존 handler/controller/gateway 계약을 보존하고 JSX 계층·CSS·짧은 고지와 표시 상태만 개선한다. tab/disclosure로 분리해도 작성 중 입력과 미저장 보호를 유지한다. 공개 동의와 원본 보호는 필수 단계로 남긴다. 권한 실패는 서버 결과로 구분하고 클라이언트 표시를 보안 권한 판단으로 대체하지 않는다. 백업 파일 형식·범위·복원 의미는 그대로 유지한다.

## 6. 변경 파일 지도

| 묶음 | 대상 |
| --- | --- |
| 작품/목록 | `TitleAlbumCard`, `TitleCollectionView`, `LibraryUi`, `ArchiveView`, `channel-service.css`와 해당 CSS |
| 미니홈/안전 | `MemoryMinihome`, `MemorySafety`, `MemoryRelationships`, public surface CSS |
| 작성/상세 | `MemoryCardComposer`, title selector, `MemoryCardDetail`, `TopNavDataMenu` |
| 계정/지원 | `DataCenter`, 계정/개인정보/백업 패널, `HelpCenter`, ko/en messages |
| 공개/운영 | public Board/home, `MemoryPublicationPanel`, `MemoryContentReview`, `MemoryReportReview`, `AdminDashboard` |
| 고지/기타 | `terms.astro`, `privacy.astro`, `SimpleSignup`, `TierBoard` |
| 검증/비교 | 영향 있는 기존 검사·추가 UX/browser checks·합성 비교 fixture/manifest/로컬 gallery |

## 7. 데이터와 스키마 마이그레이션

없음. 기존 원본·보드·팔로우·신고·서버 정책·동의 기록을 변경하지 않는다. 고정 고지 문서의 해시/본문 변경0을 확인한다.

## 8. 마일스톤

1. 기준 버전 별도 checkout, 레퍼런스 재관찰, 품질 기준점과 비교 데이터 확정.
2. 작품·미니홈·작성의 주요 과밀을 개선하고 실제 layout/기능으로 확인.
3. 데이터·도움말·문서 연결과 나머지 검수 항목을 완료. 항목별 완료 상태를 기록.
4. 관련 기능/접근성/권리 회귀, build, React Doctor 신규 문제·점수 하락 확인.
5. 동일 데이터/폭/테마로 현재와 개선 실제 앱을 촬영하고 비교 gallery를 만든 뒤 직접 열어 검증.

## 9. 테스트와 검증

- 기존 title collection/memory view, composer/guest/save, public publication/follow/report/moderation, signup/admin/data backup, tier와 화면 검사를 영향 범위에 맞춰 실행한다.
- 의미 있는 UX 검사: 카드 장르 버튼 감소·단일 이미지 폭·미니홈 tab/알림 펼치기/이의제기·필수 동의/disabled/미저장 유지·권한/무효 링크 대안·현행 고지 링크·모바일 검색과 저장 접근.
- PC1440/모바일390·320, light/dark, 키보드 초점/탭·44px 터치·가로 넘침·긴 문구·이미지 비율. 단순 CSS 복제 단위 검사는 추가하지 않는다.
- React Doctor baseline full/uncached 및 `--verbose --diff`, 새 진단과 score regression을 확인한다. 기존 모든 진단 해소를 주장하지 않는다.
- `npm run build`, `git diff --check`. 필요한 검사 통과 후 변경 없이 같은 검사를 불필요하게 반복하지 않는다.

## 10. 보안 개인정보 권리 영향

계정/권리/공개 동의·서버 owner/role 검사와 정책 버전은 유지. 실계정 대신 synthetic mock/local store fixture로 before/after를 확인한다. 비교 ZIP/HTML/이미지에 인증 상태·.env·개인 원본·실계정 식별자를 넣지 않는다. 동의나 삭제를 대신 실행하지 않는다.

## 11. 관찰 가능성과 분석 이벤트

새 analytics 없음. 비교 manifest에는 source SHA, fixture hash, 화면 폭/테마, 합성 화면의 버튼/설명/layout 수치만 넣는다. 스크린샷과 로그는 로컬 산출물로 분리하고 필요한 안전한 검증 요약만 버전 관리한다.

## 12. 롤백 복구

개선 presentation commit을 revert하면 된다. DB/데이터 rollback 없음. 현재 버전 checkout과 비교 결과를 보존해 되돌릴 기준을 제공한다.

## 13. 위험과 완화

접기/탭 전환의 입력 손실·정책 확인 생략·기능 찾기 어려움이 주요 위험이다. 안정된 상태 소유, 명확한 라벨, 키보드 접근, 기존 동작 회귀로 확인한다. 백업을 하나로 표현해 실제 포함 범위를 오해시키지 않는다. 두 비교 버전은 같은 데이터·폭·테마·route 상태로 촬영해 차이를 과장하지 않는다.

## 14. 필요한 사용자 결정

현재 개선/비교 준비 범위에는 추가 결정이 없다. 운영 반영을 원할 때는 완료된 정확 후보를 별도 승인받는다. 기존 배포 승인을 새 코드에 재사용하지 않는다.

## 15. 진행 기록

- 기준33de5b4, 개선 branch 준비. 원래 작업 폴더와 운영 버전은 보존하며 기존 소유 worktree를 재사용한다. baseline 별도 detached checkout 준비.
- 검수17항목의 구현과 기능 보존 검사를 완료했다. `../reports/2026-10-12-arena-ui-refinement.md`에 코드와 실행 근거를 연결한다.
- Are.na 실제 채널 재관찰, 동일 fixture의 PC/모바일/light·주요 dark 비교 촬영과 독립 로컬 gallery 준비. 최종 freeze 소스의 build/원격 CI·artifact 결속/갤러리 조작 확인을 마친 뒤 전달한다.

## 16. 발견 사항과 계획 변경

- 법적 고정 문서에 `data/#account-privacy`가 있다는 점을 최종 교차 점검에서 확인했다. 문서는 보존하고 새 작업 메뉴에서 과거 hash를 개인정보/백업 메뉴로 해석해 기존 링크를 유지했다.
- 일반 `astro check`는 기준 자체370오류로 실패한다. 빌드·기존 필수 CI와 해당 검사 결과를 분리해서 보고한다. React Doctor의 전체 기존302진단도 이번 미관 작업과 분리한다.
- 비교의 신규 테스트 보조 모듈은 기존 합성 fixture를 재사용한다. 현재 버전 checkout에는 촬영 보조 파일만 추가하고 앱 소스는 변경하지 않는다.
- 첫 원격 검사에서 기존 암호화 단위 검사의 무작위 문자 교체가1/64 확률로 원문과 같아지는 실패를 확인했다. 암호화 구현은 보존하고 IV/인증 tag/암호문 비트를 실제 바꾸는 검사로 보강한다. 비교 fixture의 필요한 `PUBLIC_CARD` 상수도 복원하고 새 후보에 전체 검사와 촬영을 결속한다.
- 전체 화면 흐름에서 기존 백업 검사가 항상 노출된 도구를 가정하던 부분을 새 `파일 백업` 선택으로 갱신했다. 기존 모달 fixture의 Vite 최적화 재로딩 경쟁은 mount뿐 아니라 첫 실제 조작까지 재시도 범위에 포함해 focus trap 검사의 의미를 보존했다. 두 영향 검사는 로컬에서 통과했다.
- 컬렉션 펼침에도 `TitleAlbumCard`가 재사용되는 점을 전체 검사에서 확인했다. 작품 목록의 새 미리보기 grid는 `.title-collection__memory-grid` 안으로 한정해 기존 컬렉션의 이미지 비율·표지 클릭·모바일 가로 rail을 보존한다. 관련21검사 통과/기존 사진 flag 검사1 skip. 비회원 미니홈의 빈 작업 메뉴와 비활성 계정 개인정보의 빈 상태도 명확한 안내로 정리했고 개선8검사를 통과했다.

## 17. 완료 보고

완료 후 검수17항목의 실제 변경·검증·비교 자료·한계를 연결하고, 사용자에게 비교 gallery와 핵심 차이를 전달한다.
