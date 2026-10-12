# W18 테스트 연결 후보 (운영 미적용)

원본 앱 후보 `5f791db`의 **로컬** Collection/Home 계약을 실제 `moemoa-test`와 `codex/phone-test`에 연결하기 위한 후보다. DB 구조 적용 승인만으로 실행하지 않는다. 정확한 데이터·설정·배포 후보 승인이 필요하다.

## 범위

- 기존 승인된 공개 카탈로그에서 Steins;Gate **1작품**, 상세 **1개**, 인물 **1페이지**, 표지 **89,300B**를 테스트에 복사한다.
- `catalog-source.json`은 읽기전용 공개 표본이다. 원래 release/row hash, cover ID/hash/provider/permission을 보존한다. 테스트 release는 별개이며 전체 카탈로그나 합성 외부 import로 주장하지 않는다.
- 실행 때 승인된 A 계정 이메일을 입력으로 받아 ID를 조회한다. 새 회원/수락/Memory/WatchLog를 만들지 않는다. 기존 선반이 있으면 중단한다. 저장 작품은 해당 entity가 없을 때만 추가한다.
- 기존 선반 공개 기능과 현재 가입 확인을 검사할 **설정5필드**만 임시 변경한다. 다른 kill switch/한도/원본/권한은 유지한다.
- `rollout-manifest.json`의 Preview 브랜치 설정4개와 고정 소스만 반영한다. 운영/master/Google 설정/서버 비밀키 변경은 없다.

## 준비·검증

```text
node tools/operations/collection-home-test/prepare.mjs
node tools/operations/collection-home-test/render-sql.mjs config
```

첫 명령은 버전관리된 자료에서 fixture SQL/hash를 다시 만든다. 두 번째 명령은 기본 **ROLLBACK** SQL만 출력한다. 생성된 SQL은 무조건적인 원격 실행 지시가 아니다.

Linux에서 기존 Node/PostgreSQL16으로:

```text
python3 tools/operations/collection-home-test/test_candidate.py
```

이 PC는 Windows Node + WSL PostgreSQL 조합이다. Node의 출력 bytes를 `.cache/collection-home-hosted/config-dry-run.sql`에 저장하고 다음 명령을 실행했다. PowerShell의 기본 `>` 인코딩으로 바꾸지 않는다.

```text
wsl.exe -u postgres -- python3 /mnt/e/web/anime/tools/operations/collection-home-test/test_candidate.py /mnt/e/web/anime/.cache/collection-home-hosted/config-dry-run.sql
```

격리 DB는 loopback Unix socket만 열고 모든 현행 migration(별도 pg_cron retention 제외)을 적용한다. 실제 서비스의 Auth/Storage HTTP를 모사해 통과했다고 주장하지 않는다.

## 승인 후 실행 순서

1. 연결 도구로 `moemoa-test/nmgkhknponvzcwliajyk`와 기존 settings/source0/catalog0를 재조회한다. target marker는 실행기의 실수 방지 장치이며 독립적인 DB 신원 증명이 아니다.
2. 공개 표지의 원본 URL·89,300B·SHA256을 재확인한다. 기존 테스트 bucket의 정확한 object 경로에 **upsert 없이** 업로드한다. 같은 경로가 있으면 byte hash가 일치할 때만 재사용하며 덮어쓰지 않는다. 실제 JPEG decode와 width/height도 확인한다.
3. `renderTestSql('fixture', {ownerEmail, apply:true})`를 같은 대상에 실행한다. 원래 psql 버전도 기본 ROLLBACK이다. 실행 결과에는 raw source, 개인 이메일/노트/토큰을 출력하지 않는다.
4. 현재 가입 기록/고지·구조·자료를 대조한 후 `renderTestSql('config',{apply:true})`로 정확한5필드만 변경한다.
5. Vercel `preview/codex/phone-test`의 manifest에 있는4개 값만 변경한다. 카탈로그 공개키는 기존 **테스트용 public client key**를 재사용하며 service role을 클라이언트에 넣지 않는다.
6. `phone-test` 기준 SHA가 여전히 `a6b6dda`인지 확인하고 승인한 새 소스로 Git 배포한다. master는 push하지 않는다. Ready·source SHA·alias·실제 화면의 연결을 확인한다. 이전 배포 조회404는 실제 alias HTTP 상태를 의미하지 않는다.
7. A의 테스트 컬렉션/공개 선택·동의 전 차단·실제 decode를 확인한다. 사용자가 정확한 미리보기에 직접 공개 동의한다. 새 익명 방문자의 표지/제목·Title Hub 링크, 재진입 선택 복원·stale preview 거부·철회/원본 보존을 검사한다. 이전 Google/팔로우 검증은 이 새 타입의 검증으로 계산하지 않는다.
8. 새 공개본은 기존 소유자 철회 기능으로만 철회하고, config restore와 Preview 환경/이전 source를 정확히 복구한다. 공개 사본과 원본을 임의 삭제하지 않는다.

## 원복

- `renderTestSql('restore',{apply:true})`는 적용된 정확한5필드 상태에서만 이전 설정으로 돌아간다. 다른 운영자가 바꾼 kill switch/한도를 덮지 않는다.
- 새 브랜치 override3개는 제거하고 public policy 값은 이전 테스트 revision으로 복구한다. 상속된 Production 값 자체를 바꾸지 않는다.
- phone-test는 새 승인 소스에 대한 정확한 lease로 기존 Git SHA를 복구하고 재빌드한다. 이전 preview ID가 현재 API에서 조회되지 않아도 기존 소스·환경으로 재현 가능하다.
- **테스트 카탈로그·표지·저장 작품·선반은 남긴다.** 회원 원본/변경 기록을 삭제하거나 이전 값으로 덮어쓰지 않는다. 새 타입은 off가 된다. 이는 DB 전체 복원이나 저장공간 회수 작업이 아니다.

## 남은 범위

이번 준비는 실제 게시/Google/익명 HTTP 인수나 운영 완료가 아니다. 브라우저의 기존 개인 자료와 충돌하면 새로 복사하거나 병합하지 않고 기존 conflict UI로 처리한다. 승인 없는 나라·권리·Public 범위 확대/비용 계약은 포함하지 않는다.
