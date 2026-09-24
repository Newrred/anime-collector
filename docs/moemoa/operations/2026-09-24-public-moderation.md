# 공개 신고·운영 조치 절차 — W14 로컬 검증본

상태: 운영 적용 승인 아님. 역할·처리 흐름은 격리 PostgreSQL과 합성 인증 브라우저에서 검증했다. 실제 운영 담당자/Google·Supabase 계정/지원 연락처/보존 기간은 D01/D04/D05, 호출 한도는 D03/W15에 남는다. 이번에 어떤 운영 계정도 관리자에 추가하지 않았다.

## 권한과 준비

버전 관리 migration `20260923213901_memory_moderation.sql`은 private 사건·알림·감사·사건별 계정 제한과 RPC를 추가한다. `private.memory_moderators` allowlist는 신뢰할 수 있는 DB 운영자만 관리한다. 사용자 metadata, 일반 REST table 쓰기, 프런트 버튼으로 승격할 수 없다. 권한 해제는 해당 allowlist의 enabled=false로 수행하며 이후 RPC 호출부터 거절한다. 실제 적용/권한 부여는 대상 환경과 사용자 ID를 확인한 별도 배포 게이트에서 수행한다.

`reports_enabled=false`, `report_daily_limit=0`이 기본값이다. 격리 테스트에서는 2/3을 사용했으며 실제 상품 한도로 승인한 값이 아니다. 클라이언트는 `PUBLIC_MEMORY_MODERATION_V1`와 기존 publication flag를 모두 필요로 한다. 서버의 신고 중지는 신규 신고만 막고 기존 접수 조회·이의제기·운영 검토를 막지 않는다. 기존 읽기/쓰기 긴급 중지는 publication settings의 분리된 flag를 그대로 사용한다.

## 사용자 경로

공개 보드/미니홈의 신고 버튼 → 로그인(비회원) → 고정 분류와 선택 설명 → 접수 번호 → 내 미니홈의 '내 신고·운영 알림'. 차단 관계는 이 경로를 숨기지 않는다. 아직 공개한 적 없는 private UUID는 신고 대상으로 받지 않는다. 동일 operation 재시도는 기존 사건을 반환하고 다른 payload 재사용은 거절한다. 진행 중인 동일 대상/분류는 기존 사건으로 합치며 종결 후 새 사건은 접수 가능하다. 일일 한도 판정은 사용자별 잠금 안에서 수행한다.

운영 조치가 있으면 대상 소유자의 인앱 알림에 조치와 운영자가 작성한 사유를 표시한다. 신고자 ID·설명은 소유자에게 전달하지 않는다. 알림별 이의제기는 한 번 접수되고 같은 요청 재시도는 성공 상태를 반환한다. 이의제기는 사건의 검토 버전을 변경하므로 이전 화면의 관리자 조치는 충돌로 거절된다. 별도 이메일 발송·푸시·읽음 보장은 구현하지 않았다.

## 운영자 검토 API

격리 SQL 검사에서는 `SET ROLE authenticated`와 합성 auth.uid로 권한을 시험했다. 이 설정을 실제 인증의 대체로 쓰면 안 된다. Hosted 환경에서는 **allowlist에 등록된 실제 운영자의 인증 JWT**로 Supabase RPC를 호출한다. 토큰은 문서·로그·브라우저 공유·코드에 기록하지 않는다. 다음은 요청 body 계약이며 실제 운영 호출은 이번 작업에서 실행하지 않았다.

1. `list_memory_moderation`에 `{"p_after":null}`을 보내 20건씩 조회한다. 반환 next가 있으면 다음 요청의 p_after로 사용한다. queue에는 공개 대상 ID, 분류/설명, 사건 revision, 대상 targetRevision, 이의제기가 있다. 전체 private 원본 조회 권한은 없다.
2. 공개 대상이 읽히면 해당 공개 페이지와 신고 내용을 검토한다. 보이지 않는 자료의 내부 private 원본을 우회 조회하지 않는다. 검토에 필요한 자료가 없으면 실제 지원 담당자 절차로 보류한다.
3. `review_memory_report`의 body는 `p_id`(사건 UUID), `p_revision`(현재 사건 revision), `p_target_revision`(현재 targetRevision), `p_action`, `p_reason`(1~500자)이다. p_action은 `KEEP`, `HIDE`, `RESTORE`, `RESTRICT_ACCOUNT`, `RELEASE_ACCOUNT` 중 하나다. 사유는 대상 소유자가 읽으므로 신고자 신원·비공개 원문·비밀 정보를 적지 않는다.
4. `PUBLICATION_CONFLICT`면 다시 queue를 읽어 다른 운영자/이의제기/동일 대상의 다른 사건 변경을 검토한다. 최신 숫자만 기계적으로 넣어 재시도하지 않는다. 응답을 잃은 경우도 queue와 감사 기록으로 반영 여부부터 확인한다.
5. `read_memory_moderation_audit`에 `{"p_case":"사건 UUID"}`를 보내 최근 50개 조치와 행위자/사유/버전을 확인한다. 일반 계정은 호출할 수 없다. 원본 전체 감사 이력은 private table에 보존하며 삭제/수정 API를 제공하지 않는다.

외부 지원 문의가 들어오면 승인된 담당자가 공개 대상과 필요한 최소 요약으로 같은 `submit_memory_report` 경로에 접수할 수 있다. 외부 문의 채널이 실제로 연결됐다는 뜻은 아니며 개인정보 원문을 그대로 복사하지 않는다.

## 조치와 복구 의미

- HIDE/RESTORE는 해당 공개 보드 또는 미니홈의 운영 가림만 변경한다. 원본 private 기록과 공개 동의/정렬 snapshot은 바꾸지 않는다. 사용자가 공개를 철회하거나 원본을 삭제했으면 RESTORE로 다시 공개되지 않는다. 미니홈 가림은 별도로 공개된 보드 자체의 철회를 의미하지 않는다.
- 공개 이미지 승인 경로가 사용하는 publication reader도 보드 hidden을 확인한다. 실제 Storage/HTTP/CDN 캐시에서 즉시 전달이 중단되는지는 D01/D05의 실환경 검증을 별도로 해야 한다.
- RESTRICT_ACCOUNT는 그 사건을 근거로 새 공개 게시·공개 이미지 준비/완료·팔로우 쓰기를 제한한다. private 작성·백업/내보내기·공개 철회·신고·이의제기를 막는 전체 계정 정지가 아니다. RELEASE_ACCOUNT는 **해당 사건의 제한만** 해제하며 다른 활성 사건/기존 운영 계정 flag는 유지한다. 더 세분화된 제한과 이미 진행 중인 요청의 경합은 W15에서 확장 검증한다.
- 신고자가 계정을 삭제하면 reporter 참조는 null이 되고 사건/감사 기록 때문에 계정 삭제가 막히지 않는다. 신고 내용과 감사 행위자 기록의 실제 보존/익명화·삭제 일정은 D05 승인 전 미설정이다.

## 검증과 롤백

`tools/publication-boundary/run-local-postgres.sh`가 migration 전체와 `moderation-contract.sql`, `moderation-races.sh`를 실행한다. 실제 두 DB 연결로 신고 한도와 동시 운영자 조치를 검사한다. `tests/publication-ui.spec.ts`는 실제 Chromium과 합성 RPC로 접수 재시도·알림·이의제기·로그아웃 격리를 검사한다. 검증 수와 해시는 단일 작업판 W14 증거에 기록한다.

긴급 롤백은 신규 신고 flag를 끄고 해당 client 변경을 복원한다. 안전상 가림·제한·신고·알림·감사 table을 삭제하거나 migration을 역삭제하지 않는다. 오판은 정확한 사건/최신 버전을 확인한 RESTORE/RELEASE_ACCOUNT로 되돌리고 사유와 새 감사 기록을 남긴다. 전체 공개 활성화는 실제 담당자·연락처·신고 처리·이의 처리·보존·전달 차단 실검증과 최종 배포 승인 이후다.
