# W16~W20 복구·후보 인수인계

현재 실행 상태와 검증 숫자는 [단일 진행판](../release-v2/03_RELEASE_WORKBOARD.md)에만 기록한다. 이 문서는 운영 절차이며 실제 운영 설정을 완료했다는 증거가 아니다.

## 카탈로그 후보와 복구

1. 승인된 workspace의 canonical/checkpoint/이미지 bytes/release manifest를 확보한다. `production-baseline.json`은 ID 목록이며 원본 백업이 아니다. 2026-09-08 보충 배치도 포함한다.
2. 기존 collector·validator·exporter와 `scripts/catalog-release-guard.mjs`로 필드/권리/표지 hash/기존 ID/시즌 구분을 검사한다. 새 네트워크 수집과 운영 적용은 범위 승인을 따른다.
3. 검토할 release ID/hash, 정확한 이전 ACTIVE, 변경 목록과 승인자를 기록한다. preview uploader는 격리 preview 설정을 요구한다. production으로 환경값만 바꿔 실행하지 않는다.
4. 재개 upload는 기존 release를 STAGING으로 되돌리지 않으며 hash/건수가 달라지면 새 후보를 요구한다. 업로드 완료 후 `activate_catalog_release_checked(requested_release_id, requested_release_hash, expected_active_release_id)`로 전환한다. 다른 운영자가 먼저 전환했다면 충돌로 중단하고 새 ACTIVE를 확인한다.
5. 잘못된 hash·빈/불완전 후보·누락 Storage 객체·잘못 연결된 표지는 활성화되지 않는다. DB의 객체 존재 검사는 실제 bytes checksum 검사를 대체하지 않는다. 단계별 exporter와 실제 전달 검사를 함께 통과해야 한다.
6. 게시 뒤 익명 검색·상세·표지·기존 Memory 참조와 health를 확인한다. 복구도 동일 checked RPC에 이전 release ID/hash와 현재 ACTIVE를 명시한다. RETIRED→ACTIVE가 허용되며 새 자료/표지 revision을 삭제하지 않는다. 같은 요청은 no-op 재시도할 수 있다.

호환용 두 인자 activate RPC도 직렬화하지만 운영자 predecessor 검사를 제공하지 않는다. 신규 운영 도구는 checked RPC를 사용한다. 신뢰된 service_role의 직접 테이블 수정까지 금지하는 구조는 아니므로 관리자 접근 통제와 작업 감사가 필요하다.

## 복구 대상별 절차와 한계

| 대상 | 복원·검증 | 남은 외부 확인 |
|---|---|---|
| 로컬 Memory/Board JSON | 로그아웃한 빈 보관함에 preview 후 복원, 새 로컬 ID·관계·소유권·공식 표지/디자인 확인 | 실제 사용자 백업은 동의 후 별도; 개인 사진 bytes 미포함 |
| 계정 metadata DB | 격리 복구 DB에 pg_restore 후 행·관계·revision과 권한 대조 | 실제 Supabase Auth/운영 백업·PITR·RPO/RTO |
| 공개 철회·제재·신고/감사 | delete fence/public-card control/sanction/audit를 함께 복원하고 최신 상태와 대조 | 백업 뒤 발생한 철회/제재의 별도 최신 journal 확보 |
| 사용자 공개 이미지 | private bucket의 derivative bytes/checksum·DB 참조를 함께 검증 | 실제 Storage 사본·복원·CDN/전달 차단; 원본 기기 사진 복원 아님 |
| 공용 cover | immutable bytes/checksum과 catalog_cover_revisions 보존 | 실제 cover 사본 확보와 이전 Memory 열람 |
| canonical/checkpoint/release | 원본 workspace의 독립 사본을 복구해 검증/export hash 대조 | 새 PC에 원본/보충 배치가 실제 인계됐는지 확인 |

`tools/publication-boundary/restore-roundtrip.sh`는 합성 DB의 현재 snapshot을 pg_dump/pg_restore하고 Memory 관계·표지 revision·철회/제재/감사 값을 동일하게 비교한다. 원문·digest를 일반 로그에 출력하지 않는다. DB dump에 Storage 파일 본문이 들어 있다고 가정하지 않는다.

**오래된 DB를 복원한 직후 Public을 열면 안 된다.** 네트워크 격리 또는 서버의 Public 읽기/쓰기 중단을 먼저 적용하고 최신 철회·계정 삭제·제재 journal을 반영한다. 최신 상태를 확보할 수 없으면 Public을 계속 닫는다. 현재 snapshot의 성공적인 복원은 오래된 백업의 최신 철회 재현을 증명하지 않는다. 운영 보존/압축 일수와 복구 목표는 D05 결정이 필요하다.

## 문의·정책·운영 책임

현재 Help의 기존 연락처는 `minecrafthong@gmail.com`이며 Instagram 링크도 있다. 이 작업에서 연락처를 새로 정하거나 메시지를 보내지 않았다. 이것이 신고·권리침해·이의제기·계정 삭제를 처리할 담당자/응답시간의 확인을 대신하지 않는다. D04에서 운영 주체·연령/허용 이미지 유형·정책 문구·담당자·연락 채널을 확정한다.

Public 신고/조치는 [신고 운영 절차](2026-09-24-public-moderation.md), 계정/이미지 한도와 예외는 [자원 통제](2026-09-24-resource-controls.md)를 따른다. 실제 경보 수신자·요금 한도·실행 누락 감시는 D03 확인 대상이다. 개인 감상·이미지·토큰·이메일을 오류/분석 로그에 추가하지 않는다.

## 후보 고정·검사·배포 인계

- 소스 hash와 테스트 artifact hash는 미커밋 작업본의 증거다. 이를 운영 SHA로 쓰지 않는다. 후보 확정에는 검토한 깨끗한 commit과 동일 SHA의 필수 CI가 필요하다.
- `node scripts/check-release-candidate.mjs <candidate.json>`은 source commit/dirty 상태, 필수 검사와 artifact SHA256, D01~D06의 확인자·근거, catalog/config 증거를 확인한다. 누락은 exit 2, 읽기 실패는 exit 1이며 실제 배포를 수행하지 않는다. 사람의 외부 증거 진실성이나 GitHub/Vercel 보호 규칙을 자동 입증하지 않는다. 로컬 점검 파일은 미확인 gate를 PENDING으로 유지한다.
- DB 후보에는 W09~W16 additive migrations, catalog release ID/hash, client/server flags와 policy revision, 직전 Git/catalog 버전을 함께 기록한다. 새 이미지/preview uploader는 추가 RPC가 있는 schema를 요구한다.
- 빌드/SW와 Android packaged routes, unit/catalog/브라우저/격리 SQL 검사를 통과한 결과를 묶는다. 실계정 A/B·익명·관리자, Google OAuth, Storage/CDN, Android 실제 back/키보드/공유/사진 수신은 합성 검증과 구분한다.
- D01~D05 확인과 모든 필수 Q 통과 후 정확한 후보의 D06 승인을 받는다. Git master push→필수 CI→Vercel Git deployment→운영 build-info SHA→smoke/health 순서로 검증한다. CLI 직접 배포로 대체하지 않는다.
- 코드 복구는 검토한 이전 코드로 revert commit/push한다. 데이터와 철회/제재 이력은 역삭제하지 않는다. 담당자는 배포 후 2/24/72시간 장애·철회·비용·health 실행 여부를 점검한다. 이 문서만으로 예약 작업이나 알림이 만들어지지 않는다.

2026-09-24 읽기 전용 관찰: 운영 build-info는 commit0330a54/source=vercel-git이지만 workingTreeDirty=true다. 현재 source SHA 일치와 깨끗한 배포 소스 검증은 별개이며, 다음 후보 전 Vercel 빌드의 실제 dirty 원인을 확인해야 한다. 정상 생성물일 것이라고 가정해 표시를 false로 덮어쓰지 않는다.
