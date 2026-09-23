# 현재 Private 서비스 최소 운영 절차

이 문서는 2026-09-22 로컬 구현 기준이다. 계정/Public 활성화 승인이 아니며, 공급자 설정을 완료했다는 기록도 아니다.

## 운영자 접근

- 일반 서비스에는 관리자 비밀 키/권한 버튼을 넣지 않는다. 운영은 Supabase 프로젝트 관리자와 GitHub/Vercel 운영자 계정으로 한다.
- MFA, 최소 멤버 권한, 비밀 키 보관·회전, Auth 신규 가입/요청 제한, DB 백업/PITR 및 비용 알림을 공급자 대시보드에서 확인한다. 실제 설정 확인자는 별도 기록한다.
- `tools/operations/status.sql`은 active release/건수, RLS·테이블 쓰기 권한·RPC 실행 권한, legacy social 테이블 존재 여부만 조회한다. 정상 예상값: Memory 테이블 RLS=true, anon SELECT=false, authenticated 직접 INSERT/UPDATE/DELETE=false. catalog activation은 service_role만 실행 가능해야 한다. 출력에 개인 감상/보드 이름/이메일은 없다.
- 계정 정지·삭제는 지금 일반 클라이언트에서 임의 DB delete로 처리하지 않는다. 계정 출시 전 사용자 요청→확인→Auth 및 종속 데이터/파일 삭제→결과 확인·감사까지 검증한다. 현재 도구가 이를 자동 수행한다고 설명하면 안 된다.

## 매일과 장애 발생 시

`npm run ops:catalog-health`

익명 공개 카탈로그만 조회한다. 기존 내부 ID가 사라짐, 회귀 대상 2기 검색 누락, 표본 상세/이미지 실패, 검사 도중 릴리스 교체면 실패한다. transient 네트워크/동시 릴리스 가능성은 재실행해 구분한다. 자동 재활성화나 데이터 수정을 하지 않는다.

GitHub의 `Catalog health` workflow는 push 후 기본 브랜치에서 매일 08:17 KST 예약 실행한다. 장애 통지는 GitHub Actions 계정 알림 설정을 따른다. 새 Slack/이메일 발송 자동화는 만들지 않았다. Actions 비활성화·기본 브랜치 설정·장기 비활성 저장소는 별도 확인한다.

장애 시 기록할 것은 시각, commit SHA, release ID, HTTP/실패 코드, 영향 화면과 익명 재현 절차다. 사용자의 감상·이미지·검색 원문·인증 토큰을 일반 로그에 넣지 않는다.

## 새 애니 정보·표지 갱신

1. 현재 건강 점검을 저장한다. `production-baseline.json`의 4,292개 ID와 active release를 비교한다.
2. 승인된 출처/범위 안에서 기존 catalog collect/checkpoint/resume 흐름으로 후보를 수집한다. source-registry와 permission 상태를 유지한다. 원본 자료와 cover checksum을 보존한다.
3. 전체 재생성 시 원본 배치뿐 아니라 5등분 2기, 니세코이 2기, 누락 131건 보충 target/canonical을 포함한다. 각 보고서에 있는 workspace 경로가 다음 운영자에게 실제로 전달됐는지 확인한다. **Git의 ID baseline은 원본 canonical/이미지 백업을 대체하지 않는다.**
4. 기존 `catalog:rebuild`, `catalog:validate`, `catalog:preview:export`, `catalog:preview:validate`를 승인된 workspace/profile로 실행한다. preview upload 명령을 환경값만 바꿔 production 명령으로 오용하지 않는다.
5. 전체 후보 release.json에 다음 검사를 실행한다.

```sh
node scripts/catalog-release-guard.mjs tools/catalog-lab/config/production-baseline.json /absolute/path/to/release.json
```

후보에 기존 ID가 하나라도 없거나 중복/형식/건수 계약이 깨지면 실패한다. 새 작품을 넣어 총건수만 맞춰도 기존 ID 누락을 통과하지 못한다. 이 검사는 작품 identity/허가/이미지 bytes/hash의 기존 정밀 검증을 대체하지 않는다.

6. 삭제/병합이 의도적이라면 자동 우회하지 않는다. 카드의 stable reference 보존·되돌릴 매핑과 원본 백업을 검토하고 별도 버전 관리한다.
7. release ID/hash, 데이터 변경분, 이전 release, 운영 검증/복구 절차를 기록한다. 사용자 승인과 버전 관리된 ingestion 코드를 근거로 staged upload→검증→activation을 수행한다. 이번 마무리 작업에서는 수행하지 않았다.
8. 활성화 후 건강 점검, 대표 작품 1·2기 분리 검색, 표지/상세를 재확인한다. 승인된 새 전체 ID 집합을 `node --env-file=.env.production scripts/catalog-health.mjs --snapshot`으로 기록하고 Git diff를 검토한다. snapshot도 기존 ID가 빠진 상태에서는 실패한다.

## Web 릴리스

1. unit/catalog/build 및 주요 E2E 성공, known issues·변경 flags·DB migration 유무를 기록한다.
2. 검토한 소스를 master에 commit/push한다. `.env` 비밀값이나 원본 사용자 자료를 포함하지 않는다.
3. Vercel Git 배포를 확인한다. GitHub Pages 자동 배포는 제거했다. GitHub quality 체크를 반드시 기다리게 하는 보호 규칙/배포 설정은 별도로 확인한다.
4. 운영 `/build-info.json`의 commit과 배포 대시보드 Git SHA를 push한 SHA와 대조한다. `source=vercel-git`, 깨끗한 배포 소스인지 확인한다. local/dirty artifact는 운영 최신성의 근거가 아니다.
5. 실제 운영 화면, 핵심 저장/복귀, 카탈로그 health를 확인한 뒤 완료 기록한다. 2h/24h/72h 장애 신호는 운영자가 확인한다.

복구: 코드 장애면 검증한 이전 commit으로 revert commit/push 후 Git 배포. DB 장애면 사용자 소유 reference/asset을 보존한 채 기록된 이전 release로 되돌릴 수 있는지 검증한 운영 절차를 따른다. 로컬 CLI build를 바로 production으로 덮어쓰지 않는다.

## 호출량과 계정 공개 전 차단 항목

현재 로컬 카드·보드 쓰기는 서버 API를 호출하지 않는다. 검색 RPC의 반환 12개 제한은 **요청 횟수 제한이 아니다**. 클라이언트의 disabled/debounce/cache도 악의적인 직접 API 접근을 막지 못한다.

계정 기능 공개 전에 필요한 최소 계약:

- 서버가 인증 UID를 기준으로 요청량/동시 처리/저장량을 제한하고 운영자가 계정별 한도·정지를 변경할 수 있어야 한다.
- 한도에 걸려도 로컬 저장을 삭제하지 않고 sync를 보류해야 한다. 정지/429/네트워크 실패를 구분하고 무한 즉시 재시도하지 않아야 한다.
- 익명 카탈로그는 신뢰할 수 있는 서버/API 경계의 IP/전체 예산 통제를 별도로 검토한다. Vercel 도메인만 보호해도 직접 Supabase 호출은 남는다.
- 서버 한도 값은 실제 부하·요금·정상 guest 승격/초기 sync 크기를 측정해 정한다. 임의로 “사용자 하루 100회” 같은 고정 제한을 제품에 넣지 않는다.
- 실제 PostgreSQL 테스트, 사용자 A/B 격리, 직접 REST 우회, 병렬 요청, 충돌/재시도, 정지 해제, 계정 전체 삭제와 복원을 검증한다.
- [Supabase Data API 보안](https://supabase.com/docs/guides/api/securing-your-api)과 [Auth 요청 제한](https://supabase.com/docs/guides/auth/rate-limits)은 서로 다른 통제다. Auth 제한이 Memory/catalog API 한도를 제공한다고 해석하지 않는다.

Public Board/이미지 공개는 위 계정 준비와 별개로 신고·차단·관리 삭제·이의제기·감사 로그·kill switch·권리 게이트를 모두 충족해야 한다. 현재 서비스에 이를 활성화하지 않는다.
