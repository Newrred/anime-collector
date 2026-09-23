# Title Hub Phase 6 Web 배포 ExecPlan

상태: 완료. 사용자 승인: 2026-09-07 “배포 ㄱ”. 최종 운영 검증: 2026-09-07.

## 1. 목적과 사용자 결과
현재 Title Hub·My Titles 및 Phase 5/6 메뉴·검색·화면 연결·첫 Memory 안내를 기존 운영 Web에 반영한다.

## 2. 관련 결정
Title Hub·Dual View 결정과 기존 production OAuth 수용 기록을 따른다. 이번 명시적 배포 요청은 Web 배포를 승인한다. Android·Public UGC·이미지 cloud 활성화는 범위에 포함하지 않는다.

## 3. 현재 상태와 증거
Git HEAD `3fb09a76b45e8ad8e3d0cc14fa6f4b5073a091fb` 위에 여러 단계의 미커밋 작업이 있다. Vercel CLI 인증 사용자 `newrred`, project `newrreds-projects/anime-collector` (`prj_po9LsTZRHWOYjAYD76O1EC04xa4x`)를 실제 조회했다. 기존 운영 deployment `dpl_Uuo8wH33JHebWNT5cemdJStBzH3L`은 READY이며 `www.moemoa.xyz`, `moemoa.xyz`, `anime-collector.vercel.app` alias를 가진다. 기존 OAuth 수용 기록은 `https://www.moemoa.xyz/auth/callback/`을 사용한다. GitHub Pages도 활성 상태이므로 master push로 두 대상을 동시에 바꾸지 않는다.

## 4. 범위
기존 Vercel production 환경을 사용하는 정적 Web 배포. GitHub Pages·도메인·OAuth 설정·feature flag·DB schema·catalog 수집은 변경하지 않는다. 사용자 파일 전체를 일괄 커밋하지 않는다.

## 5. 실행 흐름
검증된 source snapshot → production 환경 pull → 격리 폴더에서 Node 24 Astro build → 출력 파일 점검 → production target에 `--skip-domain` source upload 및 Vercel server build → 실배포 smoke → 기존 production alias로 promote → canonical origin 확인.

## 6. 파일 지도
배포 입력은 현재 `src/`, `public/`, build-time `tools/`, package/config다. 격리 경로는 `D:/hong/Web/Anime/.moemoa-release-2026-09-07-phase6/`. Vercel source upload는 허용 목록의 257개 파일만 사용하며 환경 파일·DB·테스트 결과·로그를 제외한다. 보고서는 `docs/moemoa/reports/2026-09-07-title-hub-web-release.md`에 기록한다.

## 7. 데이터·마이그레이션
없음. 기존 `CATALOG_COVER` hosted migration 적용 기록을 유지한다. 사용자 이미지·로컬 저장소·원격 Memory 데이터를 이관하거나 삭제하지 않는다.

## 8. 마일스톤
1. 배포 대상과 이전 READY deployment 확인 — 완료.
2. 전체 Chromium·unit·production build 및 산출물 점검 — 완료.
3. 새 production-target deployment 검증 후 alias 연결 — 완료.
4. canonical origin smoke와 복구 정보 기록 — 완료.

## 9. 검증
README의 `npm run test:unit`, 전체 `npm run test:e2e -- --project=chromium --workers=1`, build를 따른다. Phase 6 직전 unit 221, 주요 E2E 및 build 15 pages 통과. 이번에는 full Chromium 결과를 추가 확인한다. 최종 정적 파일에서 dev fixture·secret·불필요 source 노출 여부와 route/headers를 확인한다. 새 deployment와 canonical에서 메뉴·legacy alias·작품 검색·첫 Memory 및 데이터 독립성을 격리 브라우저로 확인한다.

## 10. 보안·개인정보·권리
production 환경값은 출력하지 않는다. 배포 호스트·인증·권리 설정은 기존 값으로 유지한다. 원본 이미지나 private note를 업로드하지 않고, smoke는 로그인하지 않은 격리 브라우저의 합성 데이터만 사용한다.

## 11. 관찰 가능성
Vercel deployment ID, READY 상태, alias, 출력 SHA-256 manifest와 HTTP/UI 결과를 기록한다. 새 사용자 analytics는 추가하지 않는다.

## 12. 롤백
이전 READY deployment URL은 `https://anime-collector-31qi4hu9c-newrreds-projects.vercel.app`. 문제 시 Vercel rollback으로 기존 production alias를 이 deployment에 복구한다. DB rollback은 필요 없다. 이번 deploy는 git push 없이 수행한다.

## 13. 위험과 완화
검증 환경의 Node 20과 운영 Node 24 차이는 운영에 맞춘 Node 24 build로 확인한다. PWA의 기존 cache는 실제 응답 및 새 브라우저에서 확인하며, 서비스워커가 사용자 기록을 삭제하지 않는지 대조한다. 전체 검사 실패는 원인을 확인하고 필요한 수정·대상 재검증 뒤 진행한다.

## 14. 필요한 사용자 결정
없음. 기존 운영 대상 배포는 현재 요청으로 승인됐다. 호스트 이전이나 추가 기능 활성화가 필요해질 때만 범위를 다시 확인한다.

## 15. 진행 기록
- 기존 Vercel production 대상·alias·인증·Node 24 설정 확인.
- 전체 Chromium 검사 시작, 격리 배포 입력 준비.
- 첫 전체 검사: 117 passed, 3 conditional skipped, 9 failed. 7건은 개발 fixture가 계정 flag guard에 막힌 원인으로 확인되어 DEV mock만 허용하고 production mock session은 명시적으로 차단한다. 2건은 이미 적용된 Home hero의 64px padding/50px CTA와 이전 공통 검사 기준의 불일치로 실제 CSS 기준에 맞춘다. 대상 검사 후 전체 검사를 다시 수행한다.
- 로컬 Vercel build는 Windows에서 `spawn cmd.exe ENOENT`로 실패했다. 격리 snapshot을 명시적인 업로드 허용 목록으로 제한하고 Vercel production Node 24 서버에서 build한다. `--skip-domain`으로 검증 전 alias 변경을 방지한다. 기존 prebuilt 계획은 이 방식으로 대체한다.
- 기존 로컬 `.env.production`의 두 PUBLIC_CATALOG 값은 Vercel production env에 없었다. 기존에 검증한 catalog backend/공개 anon key를 해당 deployment의 build env로만 전달하고 provider의 영구 설정은 변경하지 않는다. 키 원문은 로그에 기록하지 않는다.
- 실제 production 빌드의 320px My Titles에서 `Has Memories` filter 글자가 넘쳤다. 작은 글자와 줄바꿈을 적용하고 첫 Memory 안내 Web/native 검사에 폰트 로드 후 필터·문서 overflow 검사를 추가했다.
- 최종 unit 221, 전체 Chromium 126 passed/3 conditional skipped, 후속 관련 검사 20 passed, React Doctor 84/100(기존 경고 6), Node 24/Vercel production build 15 pages 통과.
- `dpl_81aNzZJrKHCdc7RKxiY9Aw923VXK`를 검증 후 promote했다. www.moemoa.xyz 재조회·실배포 7개 흐름·78개 파일 확인을 완료했다.

## 16. 발견 사항
문서의 DEPLOY-01 미정 기록보다 최신 실제 운영 및 OAuth 수용 기록에서 www.moemoa.xyz 사용이 확인됐다. 새로운 canonical host를 선택하는 작업 없이 기존 운영 alias를 재사용한다.

## 17. 완료 보고
운영 https://www.moemoa.xyz , deployment `dpl_81aNzZJrKHCdc7RKxiY9Aw923VXK`, READY. [배포 보고서](../reports/2026-09-07-title-hub-web-release.md)에 입력/산출물 검증, production smoke, 복구와 범위 밖 검사를 기록했다. 후속 배포에도 두 `PUBLIC_CATALOG_*` 값을 제공해야 한다. 다음은 사람 Web 사용성 확인 후 Android Phase 7이며 Public·사용자 이미지 cloud gate는 유지한다.
