# 제목 교정 운영 DB 및 웹 반영

상태: 완료. 사용자 “ㅇㅋ ㄱ” 승인에 따라 2026-09-07 운영 DB와 웹을 갱신했다.

## 결과
- 운영 주소: https://www.moemoa.xyz
- DB active release: `catalog-title-dd79a7b017076674b2950680`.
- 기존 3,998개 작품을 보존한 새 릴리스에 검토된 35개 제목·별칭을 반영했다. 대표 제목 변경 16개. 표지·인물·제목 외 기존 내용은 유지했다. 한국어 명칭 대기 항목에는 검토 상태를 기록했다.
- 공개 RPC의 `5등분` 검색에서 AniList 103572가 `5등분의 신부`로 반환됨을 확인했다. 실제 웹에서도 검색 → 1기 Title Hub 제목을 확인했다.
- Web deployment: `dpl_6szkuJQhK7PjBDGa1Tnd3M9wqBaX`, READY/production. 고정 URL: https://anime-collector-8m5rl1tpw-newrreds-projects.vercel.app . 운영 주소를 inspect해 동일 deployment를 재확인했다.

## 범위와 근거
AGENTS.md, CODEX_START_HERE.md, 확정 결정 01, QA/운영 07, 단계 runbook 08, 변경 관리 09, 기존 Web 배포 보고서, 4개 제목 검토 보고서, 기존 export/uploader 및 SQL activation/RLS를 읽었다. 실행 계획은 [DB·웹 배포 ExecPlan](../plans/2026-09-07-catalog-correction-release.md).

현재 운영 목록은 3,998개이며 로컬 4,224개 전체와 같지 않다. 검토 기록 36개 중 ANILIFE:3514 프리렌 미니 애니는 운영 목록에 없어 새로 추가하지 않았다. 이전 출처 수집이 중단된 5등분 2기(109261)도 여전히 없다. 한국어 명칭 7개, 미보유 관련 ID 후보 40개 및 scalar 충돌 59개는 이번 제목 배포로 해결한 것이 아니다.

## 적용·검증
1. 현재 active release의 assets/search/details 각 3,998행, people 4,899행을 별도 로컬 snapshot으로 저장했다.
2. 검토 staging artifact hash와 기존 DTO hash를 확인하고, 제목 관련 필드만 새 릴리스에 교정했다. 표지·인물 및 제목 외 필드의 전후 동일성을 확인했다.
3. 새 STAGING release에 업로드하고 네 테이블 전체를 재조회해 로컬 준비 데이터와 hash 일치를 확인했다. 기존 pointer 불변 확인 후 기존 activation RPC로 원자적 전환했다. 표지 bytes는 기존 저장 객체를 재사용했다.
4. 공개 anon 권한으로 교정 35개의 검색/상세 제목과 별칭을 재조회했다.
5. 현재 작업 파일을 격리 snapshot으로 빌드했다. 업로드 267개 입력이 작업 파일과 hash 일치. Node 24 Astro build 15페이지 성공. 출력에 개발 adapter/비공개 환경값/관리자 키가 없음을 검사했다.
6. candidate 주요 7개 흐름 통과 후 promote했다. 운영 주요 7개 흐름 및 별도 5등분 검색→상세, `오나의여신님` 기호 생략 검색 검증 통과. 브라우저 오류와 계정 쓰기 0건.
7. 운영 산출물 78개 HTTP 200. 비HTML 63개 byte hash 일치, HTML 15개는 Astro island uid와 기존 Vercel analytics bootstrap의 호스팅 설정 차이를 정규화한 뒤 일치했다.

기존 완료 검증은 앱 227개 통과와 카탈로그 244개 실행(241 통과, 기존 이미지 decode timeout 1, 2 skip; 실패 파일 단독 재실행 26 통과/1 skip)이다. 이번 배포에서는 빌드와 실제 운영 검증을 수행했다. 최초 candidate 브라우저 검사는 Vercel 로그인 화면에 도달해 실패했고, CLI의 정식 deployment-protection 접근 쿠키를 발급받아 재검사해 통과했다. 앱 결함으로 숨기거나 통과 처리하지 않았다.

## 파일·데이터·보안
앱 기능 변경은 이전 검토 턴의 코드와 교정표를 배포한 것이다. 이번 턴에는 실행 계획/보고서/현재 상태 문서를 추가·갱신했고, DB 적용 및 웹 배포 보조 스크립트는 저장소 밖에 보존했다. DB schema migration, 기존 release 삭제, 사용자 기록 변경, 새 표지 업로드, Public UGC 활성화는 없다. 합성 웹 smoke 기록은 별도 비로그인 브라우저의 로컬 저장소에만 만들었다. Android APK는 갱신하지 않았다. Git commit/push도 하지 않았다.

기존 production 계정 설정과 PUBLIC_CATALOG 환경값을 재사용했다. catalog 공개 환경값 두 개는 여전히 배포별 build 환경에 전달하므로 다음 배포에서도 제공해야 한다. 관리자 키는 프로세스 환경에서 읽었고 업로드/보고서/브라우저 출력에 포함하지 않았다.

## 복구와 산출물
- DB 이전 release: `catalog-v2-8af2e03bc80789f59b4eaf7c` (원본 그대로 보존).
- DB snapshot·준비 데이터·검증: `D:/hong/Web/Anime/.moemoa-catalog-production-2026-09-07/`의 before.json, prepared.json, review-summary.json, upload-verified.json, activation.json, public-verification.json.
- DB 복구: 같은 운영 자격 증명이 있는 환경에서 해당 디렉터리의 `db-release.mjs rollback` 실행. 현재 pointer가 이번 릴리스인지 확인한 뒤 이전 릴리스를 재활성화한다.
- Web 이전 deployment: `dpl_81aNzZJrKHCdc7RKxiY9Aw923VXK`, https://anime-collector-1vb4htcsj-newrreds-projects.vercel.app . 필요 시 이 주소로 Vercel rollback한다.
- Web snapshot·빌드·배포·운영 검증: `D:/hong/Web/Anime/.moemoa-release-2026-09-07-catalog/`. 관리자 키 없는 공개 산출물 manifest hash: `4ec280bdbb49124e3de269d051c04aad60200085d0b5471750cd0aae2b8b2257`.

요청한 기존 교정의 DB·웹 배포에는 남은 승인 단계가 없다. 누락 작품 복원과 전수 내용 검토는 별도 미완료 작업이다.
