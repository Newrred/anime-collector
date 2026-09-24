# W15 서버 자원 통제 운영 절차

이 문서는 로컬 구현의 적용·복구 절차다. 운영 DB 적용, 실제 한도 승인, WAF/요금 경보 설치를 의미하지 않는다. 실행 상태의 원장은 [진행판](../release-v2/03_RELEASE_WORKBOARD.md)이다.

## 경계와 단위

`20260924115258_memory_resource_controls.sql`의 private 정책은 모두 `enabled=false`, `paused=false`, `daily_limit=0`으로 시작한다. 숫자 0은 승인된 상품 한도가 아니다. 활성화하면 UTC 날짜별 한도가 적용된다. 기존 신고의 rolling 24시간 한도와 구분한다.

| scope | 계수 단위 / 용량 |
|---|---|
| SYNC_MEMORY_PRIVATE_TITLES / CARDS / VISUAL_ASSETS / BOARDS / BOARD_CARDS | 해당 테이블의 실제 저장 변경 1회 / 소유자별 살아있는 행 수(삭제 필드 없는 테이블은 전체 행) |
| SYNC_USER_DEVICES | 기기 행 변경 1회 / 등록 행 수 |
| PUBLIC_PREPARE / PUBLIC_PUBLISH | 보드·미니홈 준비 revision / 새 게시 operation |
| FOLLOW_WRITE | 팔로우 false→true / 현재 팔로우 수 |
| IMAGE_ATTEMPT | 이미지 변환 전에 별도 커밋된 시도 1회 |
| IMAGE_DELIVERY | Storage 읽기 전에 서비스 서버가 예약한 전달 1회 |
| IMAGE_DELIVERY_BYTES | 전달당 최대 출력 2 MiB 예약; 실제 전송 바이트 측정값 아님 |

SYNC scope의 전체 이름은 `SYNC_` + 대문자 테이블 이름이다. 게시/이미지 scope에는 live_limit을 사용하지 않는다. 기존 이미지 reserved_bytes 한도를 함께 유지한다.

저장 trigger의 거부는 전체 트랜잭션을 되돌린다. 이미 성공한 operation의 재시도는 추가 변경량을 소비하지 않는다. 동일 내용을 다시 준비하는 작업은 새 revision이므로 소비한다. IMAGE_ATTEMPT는 변환 실패도 소비하며, 이미 READY인 업로드 재시도는 무료다. 전달 실패도 예약량을 환급하지 않는다. 계정별 current-day 행 하나를 유지하며 요청 이력 전체를 저장하지 않는다.

삭제·시각 자료 retirement·공개 철회·언팔로우·차단·이의제기는 성장 quota에서 제외한다. 신고에는 기존 별도 신고 한도가 적용된다. 이 통제는 성공한 저장 작업 예산이며, 실패한 요청까지 모두 제한하는 ingress rate limiter가 아니다.

## 설정·조회·회복

정책/만료 override는 신뢰된 DB 운영 경로에서만 변경한다. 일반 로그인 사용자는 자기 `get_memory_resource_usage()`만 조회하고, 운영 allowlist에 등록된 계정만 `inspect_memory_resource_costs()`의 집계 정보를 받는다. 서비스 전용 `authorize_memory_image_delivery`에는 브라우저 실행 권한이 없다. 개인 본문·검색어·이미지 원본은 이 집계에 넣지 않는다.

운영 적용 전에 D03에서 scope별 예산, 초과 안내, 지원 담당자, 경보 수신자와 주기를 확정하고 후보 환경에서 재검증한다. 아래는 **격리 테스트 값의 예시이며 운영 권고값이 아니다**.

```sql
-- 격리 테스트 DB에서만 실행하는 예시
update private.memory_resource_policies
set enabled=true, daily_limit=1, live_limit=1
where scope='SYNC_MEMORY_BOARDS';
-- 중단: enabled=false라도 paused=true이면 새 성장 작업을 거부한다.
update private.memory_resource_policies set paused=true where scope='SYNC_MEMORY_BOARDS';
-- 정책 롤백: 데이터나 동의/철회 이력은 삭제하지 않는다.
update private.memory_resource_policies set enabled=false, paused=false
where scope='SYNC_MEMORY_BOARDS';
```

한시 예외는 `memory_resource_overrides`에 actor/scope/예산/만료/사유를 명시한다. 유효한 override는 해당 계정의 기본 숫자를 대체하고, 만료되면 기본 정책으로 돌아간다. 중단이나 계정 제재를 우회하지 않는다. 예외 부여 전에 실제 소유자와 만료를 확인하며 무기한 예외는 사용하지 않는다.

초과 후 복구는 승인된 예산 조정, 만료 예외 또는 UTC 날짜 전환을 사용한다. 사용량을 무조건 지워 초과를 숨기지 않는다. 계정별 advisory lock으로 동시 쓰기의 일일 한도와 용량 한도를 직렬화한다. 사건 제재의 배타 잠금과 공개 쓰기의 공유 잠금으로 진행 중 요청도 저장 시 다시 검사한다. 임의의 과거 manual flag 업데이트까지 같은 직렬화를 보장한다는 의미는 아니다.

## 비용 계측과 남은 경계

집계 RPC는 정책·당일 scope 사용량·삭제 fence 개수/DB 크기·보존 sync operation 수·이미지 예약량·신고 수를 제공한다. 이는 수동 조회 도구이며 자동 요금 경보가 설치된 것이 아니다. 활성화 전에는 새 사용량을 적립하지 않으므로 비활성 기간 전체의 실사용 통계로 해석하지 않는다.

격리 검사는 보드 변경 1, 성공 operation replay 0, 삭제 0, 게시 준비/게시 각각 1, 이미지 변환 시도 1, GET 예약 1회/2 MiB를 확인했다. SQL timing은 합성 자료의 로컬 시간으로 운영 성능/사용자당 월 비용을 추정할 근거가 아니다. 실제 Guest→계정 이전·복수 기기·이미지 유입량은 후보 환경에서 측정해야 한다.

삭제 fence는 늦은 sync가 삭제 자료를 재공개하지 못하게 하는 안전 기록이다. 임의 하드 cap으로 정상 삭제를 막거나 오래된 fence를 지우지 않는다. 삭제 fence 및 retained sync ledger의 보존·압축은 D05 미완료 게이트다. 신고/지원 경로와 실패한 요청의 ingress 비용도 별도 호스팅 통제가 필요하다.

익명 공개 DTO와 카탈로그 검색(검색어 최대 120자/응답 최대 12행)은 응답 크기를 제한하지만 요청 횟수를 제한하지 않는다. 기존 카탈로그 표지 전달은 새 Memory 이미지 예산 대상이 아니다. D03에서 호스팅 WAF·대역폭·실제 청구 경보를 확인해야 한다. Memory 이미지 GET의 모든 요청은 서비스 예산을 공유하므로 익명 남용이 전체 전달을 소진할 위험도 해당 ingress 통제로 다룬다.

과거 `user_follows`, `user_showcase_layouts`, `user_showcase_public`이 존재하면 client 권한을 회수하고 행은 보존한다. user_profiles는 자기 행 SELECT 경계로 제한한다. 알려진 과거 설치 SQL을 fixture로 재현했으며, 원격의 미등록 RPC·column grant·실제 객체는 D01 감사 대상이다. 롤백을 이유로 과거 공개/직접 쓰기 권한을 복구하지 않는다.

## 출시 전 확인

D01 실제 Supabase/PostgREST/Storage 역할·권한, D03 승인 예산/호스팅 제한/경보, D05 안전 보존·압축, W19 Android 실기기 검증을 유지한다. Public flag와 운영 DB를 변경하지 않았고 신규 의존성은 없다. 서버와 SQL은 같은 Git 후보에서 배포해야 하며, 마이그레이션 전 이미지 서버만 먼저 배포하면 새 RPC가 없어 요청이 실패한다.
