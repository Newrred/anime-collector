MOEMOA 운영 보고 생성기 v0.1

이 코드가 하는 일
허용된 운영 집계와 사건 메타데이터를 받아 제목, 일반 텍스트, HTML, 중복 방지 키를 만듭니다. Node.js 기본 모듈만 사용합니다. DB 접근, 네트워크 요청, 메일 발송, 예약 작업 등록은 없습니다.

실행
node notification-renderer.test.mjs
node render-samples.mjs

산출물
../email-samples/daily.html 및 daily.txt
../email-samples/weekly.html 및 weekly.txt
../email-samples/urgent.html 및 urgent.txt
모든 예시는 synthetic=true로 표시합니다. weekly는 월요일 09:00 KST에 직전 월요일 09:00부터 이번 월요일 09:00 직전까지를 다루는 예시입니다. daily의 사건 집계는 최근 24시간입니다. quota는 각 관측 시각을 별도로 보여주며 UTC 일별 사용량을 전일 전체 실적으로 변환하지 않습니다.

입력 계약
examples/*.json이 실행 가능한 견본입니다. 알 수 없는 필드는 거절합니다. 개인 감상, 이미지, 신고자 연락처, 신고 원문, 임의 제목 필드는 허용하지 않습니다. 사건 번호는 불투명한 내부 식별자를 사용합니다. 실제 운영 연결에서는 수신자와 adminOrigin을 서버 설정에 고정합니다.
kind는 daily, weekly, urgent입니다. 사건 상태는 관리자 명세의 NEW, ACTIVE, WAITING_REQUESTER, FOLLOW_UP, RESOLVED, DUPLICATE와 맞춥니다. P3 계획 업무는 이 보고기 입력에서 제외하고 주간 계획 문서에 둡니다.
periodStart와 periodEnd는 UTC의 반개구간 [시작, 종료)입니다. 화면에는 timezone에 따른 시각을 씁니다. 값이 없으면 null, freshness=unavailable, coverage=unavailable로 전달합니다. 값이 오래되면 stale로 보존하고 0이나 정상으로 바꾸지 않습니다.
remainingCopies는 확인이 남은 공개 사본 수입니다. 0이어도 모든 법적 처리가 끝났다는 뜻이 아닙니다. 비공개 원본을 포함한 알려진 연결 자료와 보존/제거 범위, 결과 통지는 사건 시스템에서 별도로 확인합니다. legalDeadlineState는 not_applicable(이 단계에 해당없음), review_required(적용검토중), set(근거와 기한 확정)으로 구분합니다. 법정 기한은 적용 판단을 끝낸 규칙에서만 전달합니다.

중복 방지
dedupeKey는 kind, reportId, recipientKey, periodStart, periodEnd에 고정됩니다. 같은 보고를 다시 생성해도 generatedAt 변경만으로 새 키를 만들지 않습니다. 긴급 보고의 reportId에는 사건 ID와 이벤트 revision을 넣습니다. 개인정보를 키에 넣지 않습니다.
이 키 생성만으로 메일이 정확히 한 번 전송되는 것은 아닙니다. DB unique 제약, 업무 사건과 outbox의 원자적 저장, 발신기의 lease, 공급자 접수 ID와 불명 상태 처리는 관리자 연결 명세의 별도 구현 항목입니다.

실제 연결에 남는 일
1. 기존 RPC와 운영 작업의 안전한 집계 projection 작성
2. outbox·claim/lease·권한 검사·idempotency·재시도·불명 상태 구현
3. 발신 상품 및 전송 계약, 인증된 발신 도메인/주소, 고정 수신자 확정
4. 관리자 한 명에게 시험 발송하는 정확한 범위의 승인과 실제 수신 확인
5. 독립 예약 누락 감시와 비정상 메일 경로의 알림 대안 확인
6. 운영 모드에서 synthetic=false로 바꾸기 전 관측 구간·시간대·지표 출처 검증

검증 범위
개인 원문 유입 거절, 미수집/과거 관측 표시, 중복 방지 키 안정성, 임의 URL/HTML 식별자/근거 없는 법정 기한 거절, 빈 사건 목록의 정상 오인 방지를 확인합니다. 공급자별 배달, production DB 권한, DNS 인증, 실제 일정 실행은 이 로컬 검사로 검증하지 않습니다.
