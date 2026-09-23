# 기존 표지 갤러리 운영 복원 — 2026-09-08

사용자의 검증·배포 승인에 따라 기존 Library 필터 패널과 표지 그리드를 재사용한 `/titles/` 복원을 운영 반영했다. 장르 검색·태그 필터, 정렬, 저장된 열 크기, Poster/Memory 전환과 모바일 배치를 확인했다.

## 검증 결과

- 이번 배포 전 재검사: 관련 단위 테스트 5/5, Titles·자체 ID·화면 간 연결 브라우저 테스트 11/11 통과.
- Node 24 운영 설정 빌드: 15개 페이지 생성. 현재 작업 소스와 격리 배포 snapshot의 입력 파일 270개 대조 통과. 개발용 테스트 어댑터 미포함 및 비공개 환경값의 출력 유출 검사 통과.
- 도메인 연결 전 후보와 연결 후 운영에서 각각 14개 smoke 검사 통과, 브라우저 page error 0건. 실제 카탈로그 표지·한국어 장르 검색·태그 필터·화면 전환 시 검색 유지·열 설정 새로고침 유지·320px 2열/가로 넘침 없음·Title Hub 이동을 확인했다.
- 기존 주소 호환, 로컬 Memory 작성과 이동 후 유지, 로그인 표시, 실제 작품 검색도 통과했다. 격리 브라우저의 로컬 데이터만 사용했고 account write는 없었다.
- 운영 데스크톱 및 모바일 캡처 생성, 데스크톱 캡처 육안 확인.
- 운영 파일 78개 검증: 63개 byte hash 일치, HTML 15개는 Astro build UID 및 기존 Vercel analytics 삽입 필드 정규화 후 일치. 실패 0건.
- `git diff --check` 통과. 이전 복원 단계의 전체 단위 231개, 브라우저 15개 통과(외부 연결 2개 skip), React Doctor 71점은 ExecPlan에 별도 기록되어 있다.

## 운영 배포

- 운영: https://www.moemoa.xyz/titles/
- Deployment: `dpl_7CswVCMgTNWLU8vzh7A3ULPCeGxm` (`Ready`, production 도메인 조회로 재확인)
- 후보 URL: https://anime-collector-pniu0nwge-newrreds-projects.vercel.app
- 격리 snapshot: `D:/hong/Web/Anime/.moemoa-release-2026-09-08-gallery`
- 입력 manifest SHA256: `c8d899f62dd4039b8a2bf0519b457c2b5bbe60d73d9b6d83b49dd8f79aeae5ae`
- 근거 파일: snapshot의 `production-smoke.json`, `production-gallery-smoke.json`, `live-artifact-verification.json`, `production-gallery-desktop.png`, `production-gallery-mobile.png`.

현재 작업 소스를 snapshot으로 빌드한 뒤 `--prod --skip-domain` 후보를 검증하고 승격했다. CLI가 `deploy --dry-run --json`을 지원하지 않아 파일 inventory 및 실제 빌드 artifact 대조로 검사했다. 이를 CLI dry-run 성공으로 간주하지 않는다.

## 변경 범위와 복구

DB·카탈로그 데이터·사용자 데이터 migration은 없으며 AniList 외부 연결 제거 정책은 유지한다. 이번 작업에서 소스 변경을 추가하지 않았고 검증된 복원 코드를 배포했다. 커밋·push는 수행하지 않았다.

이전 운영 배포는 `dpl_9cQZqinSPXfT8uRbfdamz59qtyQY`이며 필요 시 다음 명령으로 되돌린다. 현재 복구는 필요하지 않다.

```powershell
npx --yes vercel@59.11.7 rollback https://anime-collector-3159ylqjz-newrreds-projects.vercel.app --yes --scope newrreds-projects
```
