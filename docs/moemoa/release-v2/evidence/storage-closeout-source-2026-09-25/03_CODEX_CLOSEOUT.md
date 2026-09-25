# Codex · 무료 이미지 연동과 운영 설정의 최종 마감

2026-09-25 · 기존 release-v2에 연결하는 변경 지시다. 새 M단계·W계획·진행판을 만들지 않는다. 앱 코드 수정·운영 적용 승인은 별도다.

## 1. 현재 기준과 종료 지점

첫 출시: **Web-only, 개인 기록+계정+무료 비공개 최적화 이미지 연동+공개 Board+미니홈+팔로우+최소 운영.** ‘Web-only’는 휴대폰 브라우저를 제외한다는 뜻이 아니다. Android APK·원본 backup·결제·광고·서버 이전은 후속이다.

이미 반영된 W08 실패 재시도/W13 작성자 연결/Web-only gate와 hosted 공개 흐름을 되돌리지 않는다. 이번 요구는 **공개 사본만 제공하던 범위에 일반 Web 이미지 유입과 비공개 열람용 사본 연동을 포함하는 변화**다. 이미 구현되어 있다면 동작 근거로 인정하고, 없다면 실제 추가 구현으로 표시한다.

다음 조건을 만족하면 이번 기능 개발을 `CODE_COMPLETE_FOR_WEB_RC`라는 진행 요약으로 닫을 수 있다.

- 일반 사용자가 시험 fixture 없이 휴대폰/PC 웹에서 자신의 이미지로 Memory를 만들 수 있다.
- 비공개 원격 사본을 같은 계정의 다른 실제 기기에서 보고 감상·Board 변경이 반영된다.
- A/B/익명 접근, 실패/취소/재시도, quota·예산·삭제/철회·복구가 관련 C/Q를 충족한다.
- 무료 공간·사용량·연동 상태와 실제 서비스 약속이 일치한다.
- 운영자가 기존 도구로 상태 조회·정책 변경/rollback·제한·신고·사본 확인을 수행할 수 있다.
- 남은 필수 코드 변경이 없고, 실제 환경/정책 승인 대기는 해당 D/Q에 명시되어 있다.

이 요약은 `READY_FOR_DEPLOY`나 `LIVE_VERIFIED`가 아니며 W를 자동 DONE으로 바꾸지 않는다. 실제 코드·자동검사·실기기·운영승인 상태를 분리한다. 필수 코드 결함이 남았다면 위 요약도 사용하지 않는다.

## 2. 먼저 할 일 — 한 번만 현재 차이 확인

AGENTS/CODEX_START_HERE/확정 결정/단일 진행판을 읽고 기존 ExecPlan의 해당 W만 갱신한다. 현재 HEAD·dirty·관련 파일과 최신 증거를 확인하되 전체 저장소 감사·테스트 DB 준비를 다시 시작하지 않는다.

짧은 차이표 하나를 현재 W 기록에 쓴다: `이미 동작하는 것 / 이번 변경이 필요한 것 / 아직 실검증하지 않은 것`. 이번 패키지는 최신 실작업 tree의 정확한 base를 보장하지 않아 자동 덮어쓰기 patch를 제공하지 않는다. 이후 작업은 현재 코드에 수동으로 의미 병합한다.

## 3. 기존 문서에 반영할 곳

| 기존 위치 | 반영 내용 | 보존할 것 |
|---|---|---|
| `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md` | FREE private image sync, 50,000원 추가예산 정의,50MB/1MB 후보,원본/결제/광고 후속 | 별도 공개 동의·허용 표지·원본보호·기존 결정 이력 |
| 기존 제품/아키텍처/이미지 문서 | private 최적화 사본과 public 사본 역할,해시·revision·권한·상태 | 현행 모델/adapter와 증명된 공개/삭제 경계 |
| release-v2 `00`, `01` | 다음 본 작업을 현재 W06/W08·W15의 새 요구로 연결 | M0부터 재시작 금지,이미 완료한 W를 전부 재개방하지 않음 |
| release-v2 `02` C02/C04/C09/C10/C11/C12 | 아래 시나리오를 기존 Q의 세부 검증으로 추가 | 기존 Q번호/원래 의미/공개 계약 |
| release-v2 `03` | D03예산 갱신,D04/D05 연동 약속,W/Q별 구현·실검증 범위와 다음 행동 | 과거 로그·증거·승인·현재 진행수의 진실성 |
| 기존 operations 정책/runbook | 이 패키지의 운영 방식 반영 | 동일 내용의 두 번째 활성 원장 금지 |

설정은 기존 운영 정책 저장소를 우선 확장한다. `service-policy.candidate.json`을 임시 프런트 상수로 넣고 완료하지 않는다. sample을 product contract로 연결하는 서버 loader/RPC와 public-safe projection이 필요하다.

## 4. 기존 작업 안에서 닫을 네 개의 완료 결과

다음은 새 단계가 아니라 **기존 W의 수행 순서와 종료선**이다.

| 주 W | 이번의 완료 결과 | 연결 Q / D |
|---|---|---|
| **W06·W08** (필요한 W05 회귀) | 휴대폰의 비공개 최적화 이미지1장이 PC에서 실제로 보이고,변경·삭제가 반영됨 | Q01,Q03,Q05~Q07,Q10,Q14 / D01,D02,D04,D05 |
| **W15** (W18 표시) | 같은 서버 정책으로50MB/1MB·예약·전송·전체 예산과 사용량 표시가 작동 | Q10,Q19,Q22,Q24 / D03 |
| **W14·W16·W17** | 기존 공개·신고·갱신·복구 경계를 유지하며 운영자가 제한·조치·사본을 관리 | Q08~Q14,Q18~Q21 / D04,D05 |
| **W18·W19·W20** (W03연결) | 정확한 후보의 PC+휴대폰 Web 회귀와 문서/운영값을 마감 | Q22~Q24 및 변경 관련Q / D01~D06 |

원격 policy approval이 막혔다고 로컬 구현/테스트를 모두 대기시키지 않는다. 승인 없는 운영 쓰기만 중단한다. 수치 미정은 새 과금 기획 프로젝트를 만들지 않고 D03에서 처리한다.

## 5. W06/W08: private image의 최소 end-to-end 계약

### 경계와 객체

기존 `VisualAsset`, platform runtime, repository, `SupabasePublicationGateway`, `src/server/publicImages` 계열을 먼저 확인한다. 아래 명칭은 개념이며 현재 실제 테이블명이라고 가정하지 않는다.

```text
기기 원본(기존 localRef 유지)
  → 사용자가 고른 최적화 사본
  → 서버 확정 ManagedPrivateRepresentation(owner,assetId,sourceVersion,contentHash,bytes)
  → Memory metadata에서 참조
  → 동일 계정 PC/휴대폰이 읽음

명시적 공개 선택
  → 공개 가능한 고정 representation/revision의 검토
  → 별도 공개 전달 계약
```

서버 manifest에는 owner·asset/버전·pipeline revision·실제 hash/bytes·MIME·dimension·상태·생성/삭제 정보가 필요하다. 공개 DTO에는 private path·Auth UID·원본 파일명을 누출하지 않는다. bucket/object 권한은 서버 계정 경계를 확인하며 `isPublic` 클라이언트 값으로 우회할 수 없어야 한다.

### 이미지 최적화와 해시 — 필수 주의

- 먼저 기기에서 큰 원본을 제한된 픽셀/메모리/반복 횟수 안에서 처리하고, 작은 사본을 전송한다. 목표1MB와 source선택20MB는 별개의 값이다.
- 서버는 실제 bytes/MIME/magic/decode/픽셀/단일프레임을 확인한다. 브라우저가 ‘압축 완료’라고 말한 것만 신뢰하지 않는다.
- 서버가 정규화한 최종 사본의 hash/bytes를 계산하고 그 파일을 모든 기기에 제공한다. 불필요한 이중 손실압축은 줄이되 서버 파일 검증은 유지한다.
- 원본 hash와 최적화 파일 hash는 같지 않다. **기존 `checksum_sha256`를 덮거나 공개 `SOURCE_IMAGE_MISMATCH` 검사를 제거하지 않는다.**
- 신규 기록은 최적화 사본이 서버 canonical visual representation이 되도록 명확히 모델링할 수 있다. 기존 original 기반 자산은 원래 참조를 유지하고 managed representation을 연결하거나, 사용자 명시 선택으로 새 visual revision을 생성한다.
- 기존 original hash를 실제로 검증하지 않고, 클라이언트가 제출한 originalHash만으로 ‘원본과 일치 검증’이라고 기록하지 않는다. 서버가 attestation할 수 있는 것은 수신/확정 bytes와 owner/version 연결이다.
- 기존 공개 pipeline에는 **선택한 representation의 검증된 bytes/hash**를 읽는 adapter를 좁게 추가한다. 기존 old-source 카드·공개본은 호환 경로를 유지한다. 공개 승인 레코드의 asset/version 범위를 임의 복사하지 않는다.
- 공개용 이미지 준비가 내부적으로 다른 revision/파생본을 만든다면 검토에 보여준 내용과 게시 bytes가 연결되도록 한다. private 수정→public 자동업데이트 금지.

### 권장 최소 전송 방식

기존 Node 이미지 실행 환경을 사용한 작은 인증된 private-media 경계와 private Storage를 우선 검토한다. 기존 변환/안전 코드를 재사용하되 **private를 public controller로 통과시키지는 않는다.** 공개 심사 상태가 private 저장의 필수 조건이 되어서는 안 된다.

초기 private 읽기는 현재 서버의 계정 상태·한도와 연결해 작은 파일을 전달하고, private 콘텐츠를 공용 CDN/SW에 캐시하지 않는다. 불필요한 반복 다운로드는 현재 owner-scoped 로컬 cache/목록 썸네일로 줄인다. 계정 변경 후 다른 계정에 보이지 않도록 캐시 키·요청 owner·UI state를 검증한다.

기존 direct authenticated Storage 읽기를 재사용하는 편이 더 작다면 가능하지만, **사용자별 전송 강제 한도·정지·탈퇴 검사 우회와 비용을 함께 증명**해야 한다. signed URL은 유효기간 동안 공유/재사용될 수 있으므로 단순1회발급=1회전송으로 계산하거나 즉시 철회를 보장하지 않는다. 두 전달 구조를 동시에 구현하지 말고 작은 안전 경로 하나만 선택한다.

### 기록 완료와 연동 완료는 다른 상태

로컬 Memory COMPLETE를 cloud image 상태와 혼동하지 않는다. 구현 상태명은 기존과 조합해도 된다:

`LOCAL_READY → PREPARING → RESERVED/UPLOADING → VERIFYING → REMOTE_READY`

실패·대기는 `RETRYABLE_FAILED / PAUSED_QUOTA / PAUSED_SERVICE / AUTH_REQUIRED` 등 안전 code로 표시한다. 카드의 메타데이터만 온 기기는 image manifest/bytes가 준비되는 동안 적절한 상태와 재시도를 제공한다. 실패한 이미지를 이유로 이미 저장된 감상을 삭제하지 않는다.

### 작업 수명주기

1. 원격 업로드 전 계정·sourceVersion·활성 정책·예산을 확인하고 원자 예약한다.
2. operationId는 owner/asset/version/준비 표현에 결속한다. 같은 요청 재시도는 중복 파일/과금0.
3. 전송 중 취소·네트워크 응답 유실은 완료 여부를 먼저 조회한다. 확정 실패만 새 시도로 전환한다.
4. 서버 bytes 확정과 최종 quota commit을 원자적으로 연결하거나, 실패를 복구할 작업 기록을 남긴다. object storage와 DB가 단일 transaction이라고 가정하지 않는다.
5. 만료 예약 정리는 live 작업·READY 여부·참조를 재검사한다. 오래됐다는 이유로 무조건 삭제하지 않는다.
6. 교체에서는 이전 사본을 먼저 지우지 않는다. 최종 사용량이 quota 이내인지 보면서 제한된 **임시 교체 여유**를 운영 physical 한도에서 확보한다. 교체 반복으로 무제한 공간을 확보하면 안 된다.
7. 원본 Memory 삭제는 tombstone과 공개 철회 우선 계약을 유지하고 private/public 사본을 각각 정리한다. 계정 삭제도 포함한다.

한 사진당 정해진 main/thumb만 먼저 지원한다. 범용 rendition service·멀티파트 대형업로드·영상/GIF·임의 remote URL fetch·cross-user dedup은 제외한다.

## 6. W15: 설정·원자 quota·budget

필수 서버 계산:

`현재 사용량 + 유효 예약량 + 신규 최종 증가량 <= 해당 owner의 effective quota`

업로드 전에 예약하고 최종 server-measured bytes로 정산한다. 전송 전에 필요한 egress budget을 보수적으로 예약하되 실제/추정 송신·반환을 구분한다. 클라이언트 Content-Length가 작게 조작돼도 초과 payload를 읽지 않아야 한다. duplicate operation을 새 보유량으로 차감하지 않는다.

정책 변경은 서버권한·version CAS·이유·만료 예외·rollback을 가진다. **FREE 한 종류만 runtime에 활성**하고 미래 상품은 문서에만 둔다. 무료quota가 낮아져도 기존 자료는 삭제하지 않는다. Client에서 plan/usage/role을 바꿔도 서버의 저장·조회 경계를 바꿀 수 없다.

한 이미지 여러 Board의 논리 usage는1회, 실제 공개 사본은 글로벌 물리량이다. 계정 quota에 들어오지만 글로벌 저장/전송·수용 규모에 걸리는 경우도 별도 error와 안내를 제공한다.

외부 청구 API를 실시간 매 요청마다 호출하는 플랫폼은 만들지 않는다. 기존 metrics·서버 counters·정기 집계와 인보이스 대조로 시작한다. 알 수 없는 비용은0이 아니며, 고정비·예비비를 뺀 변동비 여유가 없으면 신규 서비스 범위 확대를 차단한다.

## 7. 실제 검증 — 기존 Q의 세부 시나리오로 추가

| 기존 Q | 이번 추가 수용 조건 |
|---|---|
| Q01,Q05 | 로그인하지 않으면 로컬, 계정 연동 선택 후에는 선택한 사본만 서버. 과거 사진 일괄 자동업로드0 |
| Q01,Q24 | 실제 휴대폰 웹에서1MB보다 큰 합성/승인 캡처 선택→최적화→PC에서 사본 열람. 테스트 adapter/작성자 cache로 대신하지 않음 |
| Q03,Q10 | 올바른 제목/감상 보존, 최적화/업로드 실패 후 재시도·취소·새로고침, 실제 확정 READY 응답 유실에서도 중복0 |
| Q05,Q07 | A업로드 중 B전환·로그아웃·만료 시 A파일이 B로 기록/표시되지 않음. 실제 UID/RLS/HTTP로 B와anon 다운로드 차단 |
| Q06 | metadata가 image manifest보다 먼저/나중 수신되는 순서, pending 표시, 실제 byte 준비 전 거짓완료0 |
| Q10 | 상한 미만/동일/초과 bytes, 거대pixel·가짜MIME·SVG·애니메이션·손상파일·헤더조작 거절. 서버/브라우저 각각 제한 |
| Q10,Q24 | 자막·얇은선·얼굴·암부·그라데이션·세로이미지·EXIF회전·투명영역을 PC/휴대폰에서 비교. 평균 크기·최대·시간·실패율 보고 |
| Q10,Q19 | 사용량49,000,000에서800,000bytes 두작업 병렬 요청 시 최종50MB 초과0. 같은operation 재시도·만료예약·finalize 실패 정산 일치 |
| Q19 | 썸네일 포함, 여러Board에 같은asset 추가 시 증가0, 공개파생본 추가 시 사용자와 global각각 올바른계산 |
| Q10,Q19 | quota 가득찬 상태의 동일/작은 사본 교체, 실패 시 이전사본 유지; 임시교체 여유를 반복 악용할 수 없음 |
| Q08,Q09,Q11 | 비공개 사본을 연동해도 공개본문/이미지0. 명시선택/preview/동의 뒤 새 방문자 실제 공개bytes. hash/권리 검사 유지 |
| Q12,Q13,Q14 | 공개철회→private유지. 카드자체삭제→모든공개위치차단·private정리. offline기기/오래된sync/원본유지와삭제 부활0 |
| Q14,Q20 | **새 private 최적화 사본 bytes**와 manifest 복구,최신철회/계정삭제 fence 적용. 기존72table재구축은 필요없음 |
| Q19,Q22 | 한도·비용경보·사용량관측미실행·만료override·동시policy수정·원화여유0 시나리오. 실제 경보 수신/중단/승인재개 |
| Q18,Q19 | 일반 사용자가 정책수정·무제한예외·계정정지 우회 불가. 개인원문 없이 지원·신고처리 가능 |
| Q23 | 기존 PWA→새 정책/빌드→rollback에서 로컬자료 유지,private이미지를 다른계정/공용cache에 노출0 |
| Q24 | 공간없음·연동대기·지원형식·비공개/공개/원본 차이를 사용자에게 정확히 설명. 현재 없는 결제 버튼0 |

지원 브라우저는 D02에 실제 조합으로 적는다. 최소 PC 한 대와 별개의 실제 휴대폰에서 테스트하고, 지원을 명시한 iOS Safari/Android Chrome 등은 각각 실행한다. 모두 지원했다고 주장하면서 하나만 테스트하지 않는다. Android 브라우저 검증은 Android 네이티브 앱 검증이 아니다.

## 8. 정책 후보 검사와 출시에 필요한 값

로컬 후보 JSON/schema/validator는 **설정 형태와 범위 이탈**을 검사한다. actual provider 비용·권한·증빙의 진위까지 검증하는 도구가 아니다. 현재값은 CANDIDATE이므로 release-preview 실패가 정상이다. 미정값을 가짜 숫자/증거/PASS로 채우지 않는다.

D03에서 실제 고정비·전송·수용규모·global physical한도·경보를, D04에서 연동약속/지원/권리를, D05에서 사본·삭제·복구를 채운다. 기존 RPO/국가/연령 제안을 확정으로 옮기지 않는다. 필요한 값은 한 번에 요청하고, 영향을 받지 않는 코드 테스트는 진행한다.

## 9. 우회·가지치기를 막는 규칙

- 기본 unit/DB/A·B/복원 환경을 실제 변경·실패 근거 없이 다시 구축하지 않는다.
- W08개발 중 ‘범용 파일 플랫폼’이 필요하다는 결론으로 넘어가기 전에 한 장의 비공개연동을 기존 adapter로 닫는다.
- W15는 FREE정책·서버한도·기존운영도구까지만. billing/광고/자동상품전환/결제webhook은 보류한다.
- W17은 운영자가 실제 필요한 조치를 할 수 있으면 종료한다. 디자인된 관리자 portal은 필수 아님.
- 같은 실패에 두 번 다른 접근을 했는데 진전이 없으면 원인·정확한 blocker를 해당 D/W에 남기고 다른 독립 작업으로 전환한다. 두 번 실패했다고 안전조건을 삭제하지 않는다.
- 새 필수 작업은 먼저 기존 W의 완료 조건 안으로 흡수한다. 독립 W가 정말 필요하면 기존 규칙의 형제행으로만 추가 제안하고 새 하위계획/번호체계를 만들지 않는다.
- 기존 ExecPlan을 갱신하는 것은 허용한다. 같은 문제의 설계/보완/재보완 문서를 끝없이 따로 만들지 않는다.
- 사용자 피드백이 없다는 이유로 개발을 계속 채우지 않는다. 예산/권리/실기기 승인 대기는 명확한 대기이며 ‘미구현’과 다르다.

## 10. 최종 배포 직전

변경한 정확한 SHA·migration 정의·catalog·활성policy hash·client/server 설정·이미지 origin·backup/철회 사본을 기존 W20 후보에 결속한다. 기존 실제 공개·follow·moderation 결과는 영향 범위에 맞춰 회귀하며 과거 검사를 이번 SHA로 옮겨 적지 않는다.

`코드 마감 → 관련 Q 실제검증 → D03~D05 운영인수 → RC_VERIFIED → D06 운영승인 → Git배포 → LIVE_VERIFIED`

이 순서에 새 상품 개발을 끼워 넣지 않는다. 공급자 플랜 구매/추가 compute/production migration/Public활성/운영 배포/원본 삭제는 별도 승인 없이 실행하지 않는다. 문서 승인과 개인정보 공개 승인은 다르다.

최종 보고 양식:

```text
현재W / 이번에 닫은 사용자 행동:
이미 있었던 기능과 재사용한 증거:
이번 소스·정책revision·환경·새 테스트:
미구현 코드 / 실환경 미검증 / 운영승인 대기:
원본·비공개·공개철회·quota 보존:
월5만원 조건의 실제 설정/관측 근거:
D03~D05에서 필요한 값:
CODE_COMPLETE_FOR_WEB_RC 판단과 이유:
다음 작업1개 / 운영 적용 승인 여부:
```

## 근거와 구현 경로 한계

W/Q/D 매핑은 최신 남은 ZIP의 release-v2 원문으로 확인했다. 파일명 예시와 서버 설계는 current-tree 확인 후 맞춘다. 이번에 source별 모든 변경을 재검토하거나 앱 테스트를 다시 수행한 것은 아니다. 공개 이미지 재시도·작성자 연결은 최신 자료에서 수정됐으므로 과거 bbff3d4 결함을 자동으로 재도입/재수정하지 않는다.

기술 참고는 `01_PRODUCT_AND_STORAGE_POLICY.md`의 WEB1~WEB5, 운영 참고는 `02_OPERATIONS_RUNBOOK.md`의 WEB6~WEB7이다. 외부 문서는 제품합의 대신이 아니며, SDK·호스팅 실제 버전은 구현 때 확인한다.
