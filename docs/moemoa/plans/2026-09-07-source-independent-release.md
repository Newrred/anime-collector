# 자체 ID 지원 검토·운영 배포

사용자 2026-09-07 `검토후 배포 ㄱ` 승인. SOURCE-INDEPENDENT-CATALOG-01 구현을 현재 Vercel 운영 웹에 반영한다.

1. 이전 운영 snapshot과 실제 변경 코드 비교, 저장/Memory/출처/오프라인 경계 검토 및 발견 결함 수정.
2. 회귀 단위·브라우저 검사, production 환경의 격리 snapshot 빌드와 산출물/비밀값 검증.
3. 기존 production 배포를 기록하고 candidate 생성. candidate smoke 통과 후 운영 도메인 promote 및 동일 smoke/파일 hash 대조.
4. 226개는 transport PASS만 있으므로 개별 identity 승인 없이 추가하지 않는다. 기존 3,999개 release를 보존한다. AniLife 게시용 DB 제약 변경은 실제 데이터 게시 전에 적용하는 별도 migration으로 남기며, 이번 웹 코드 배포에 필수적이지 않다.
5. 환경값은 기존 공개 production 계정/catalog 값만 사용한다. Public/이미지 cloud, 사용자 DB/이미지, 인증 권한을 바꾸지 않는다.
6. 복구는 이번 promote 전 READY deployment로 Vercel rollback. 추가 로컬 저장 영역과 기존 데이터는 보존한다. 기존 미커밋 작업을 reset하거나 묶어 commit하지 않는다.

자료: AGENTS, CODEX_START_HERE, 결정01, 운영07, 변경09, source-independent 구현 계획/보고서, 이전 Web/correction 배포 보고서. 변경 파일 지도·검증·잔여 위험·최종 배포 식별은 source-independent-production 보고서에 기록한다.

완료: 검토 결함 4건 보완, unit 230/Chromium 13/production build 통과. candidate 7개 흐름 확인 후 운영 promote, 운영 7개 흐름+catalog 저장 검사와 78개 파일 대조 완료. DB 3,999개 유지, migration/226개 추가 미실행. Deployment `dpl_9cQZqinSPXfT8uRbfdamz59qtyQY`. [최종 보고서](../reports/2026-09-07-source-independent-production.md).
