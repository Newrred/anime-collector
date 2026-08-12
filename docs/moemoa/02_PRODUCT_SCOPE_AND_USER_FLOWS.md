# 02. 제품 범위와 사용자 흐름

> **문서 상태: `CURRENT PRODUCT SPEC`**
> `01`의 확정 결정을 사용자 흐름과 상태 모델로 구체화한다. 기술 선택과 Public 활성화는 각각 Phase 2 및 권리·UGC gate 승인이 필요하다.

## 1. P0 목표

P0의 목표는 공개 SNS를 완성하는 것이 아니라 다음 핵심 루프를 안정적으로 만드는 것이다.

```text
이미지를 확보한다
→ 작품과 연결한다
→ 카드를 만든다
→ Archive에 쌓인다
→ Board로 묶는다
→ 필요할 때 계정과 Web으로 확장한다
```

여기서 `P0`는 첫 제품 범위이지 한 번에 구현하는 단일 phase가 아니다. local Card/Archive, Board/Web read path, account metadata sync 등 여러 마일스톤이 합쳐져 P0를 완성한다. 실제 순서는 Phase 2의 승인된 ExecPlan에서 정한다.

## 2. P0 포함

### 작품

- 공용 작품 검색
- 검색 실패 시 PrivateTitle 생성
- 공용 작품과 PrivateTitle의 시각적 구분
- 작품 장르 자동 연결

### Memory Card

- 한 작품에 여러 카드
- 사용자 이미지 강력 권장
- 시스템 디자인 카드 대체
- 짧은 감상·감정·날짜·장면 선택
- 스포일러
- Draft/Complete 상태
- 수정·삭제

### Archive

- 최근 카드
- 작품별 카드
- 날짜별 카드
- 장르·개인 태그 필터
- 같은 작품의 여러 카드
- 카드 상세와 수정

### Board

- Private Board 생성·수정·삭제
- N:M 카드 배치
- 순서 변경
- 카드 3개 이후 제안

### 계정·동기화

- 비로그인 로컬 사용
- 익명 소유자 ID
- 첫 카드 후 로그인 권장
- 로컬 데이터 계정 승격
- 메타데이터 동기화 상태 표시
- Web에서 카드·Archive·Board 확인

### 데이터 소유권

- JSON 내보내기
- 복원
- 카드·이미지·계정 삭제
- 동기화 실패와 로컬 저장 상태 구분

### 운영 기반

- 오류 추적
- 최소 분석 이벤트
- 기능 플래그
- 개인정보·약관·신고 경로

## 3. P0에서 기반만 준비하고 기본 비활성화

- `PRIVATE_CLOUD` 이미지 백업
- Public 카드·Board
- 다른 사용자 카드의 원본 참조 저장
- 관리자 UGC 검토 큐
- 신고·차단·이의제기

이 기능들은 스키마와 플래그를 준비할 수 있지만 게이트 통과 전 활성화하지 않는다.

## 4. P0 제외

- 댓글, DM, 멘션, 채팅
- 무한 추천 피드
- 팔로워 수 경쟁
- 애니 캡처 무제한 Public
- 타인 팬아트 무허가 Public
- AI 감상 분석
- 광고·구독
- 전체 역사 카탈로그 완성
- iOS 동시 구현
- 스트리밍 앱 화면을 직접 캡처하는 기능

## 5. 핵심 사용자 흐름

### Flow A — Android Share Target

```text
사용자가 갤러리/다른 앱에서 이미지 공유
→ MOEMOA 선택
→ 임시 Draft 화면
→ 이미지 미리보기와 변경
→ 작품 검색 또는 PrivateTitle
→ 자동 장르 확인
→ 선택적 기억 신호
→ LOCAL_ONLY 저장
→ Archive
→ 로그인/백업 권장
```

수용 기준:

- 공유받은 이미지를 바로 확정 저장하지 않는다.
- 사용자가 작품과 이미지를 검토한다.
- 취소하면 빈 카드가 남지 않는다.
- 네트워크가 없어도 저장 가능하다.
- 중복 탭으로 카드가 중복 생성되지 않는다.

### Flow B — Android Photo Picker

```text
앱에서 카드 만들기
→ 작품 선택
→ Photo Picker
→ 승인된 local storage adapter에 내구성 있게 보존
→ 선택적 기억 신호
→ 저장
```

실제 보존 방식이 앱 전용 filesystem, DB Blob, source URI 중 무엇인지는 `STORAGE-LOCAL-01`에서 결정한다. 선택 전 문서가 특정 저장 방식을 확정하지 않는다.

### Flow C — 시스템 디자인 카드

```text
작품 선택
→ 이미지 없음
→ 시스템 디자인 생성
→ 제목·장르·패턴·타이포그래피
→ 카드 저장
```

이미지 중심 제품이지만 이미지 확보 실패가 기록 실패로 이어지지 않게 한다.

### Flow D — 첫 로그인과 로컬 승격

```text
로컬 카드 존재
→ 로그인 권장
→ 인증
→ 로컬 데이터를 계정에 연결할지 확인
→ 메타데이터 동기화
→ 이미지 백업은 별도 선택
→ Web에서 확인
```

### Flow E — Board

```text
카드 3개 생성
→ Board 제안
→ 제목 입력
→ 카드 선택
→ 순서 지정
→ Private Board 저장
```

### Flow F — Public 게시 요청

```text
로그인
→ 카드 공개 요청
→ 이미지 유형·권리·출처 확인
→ 정책 동의
→ Quarantine/검토
→ 승인 또는 반려
→ Public URL
```

Private beta에서는 Public UI를 기본 비노출한다. 개발용 feature flag로 검증하더라도 게이트 미통과 상태에서는 실제 Public 전환이 불가능해야 한다.

## 6. 상태 모델

### MemoryCard

| 상태 | 의미 |
| --- | --- |
| `DRAFT` | 작품 또는 VisualAsset이 미완성 |
| `COMPLETE_PRIVATE` | 작품 + VisualAsset, 개인 Archive 저장 가능 |
| `PUBLISH_PENDING` | Public 요청, 검토 중 |
| `PUBLIC` | 공개 승인 |
| `RESTRICTED` | 신고·권리·안전 문제로 노출 제한 |
| `DELETED` | 사용자 삭제 또는 운영 삭제 |

### VisualAsset storageScope

- `LOCAL_ONLY`
- `PRIVATE_CLOUD`
- `PUBLIC`

### VisualAsset rightsBasis 예시

- `USER_ORIGINAL`
- `USER_CREATED_FANART`
- `EXPLICIT_PERMISSION`
- `OPEN_LICENSE`
- `ANIME_SCREENSHOT_PRIVATE_ONLY`
- `THIRD_PARTY_UNKNOWN`
- `SYSTEM_GENERATED`
- `UNKNOWN`

## 7. UX 원칙

- Private가 기본값이다.
- 저장 위치와 공개 상태를 문구로 명확히 표시한다.
- 로그인 유도는 첫 카드 전에 막지 않는다.
- 이미지 권한 거부가 서비스 사용 불가로 이어지지 않는다.
- 사용자가 입력한 메모 원문은 분석 이벤트에 보내지 않는다.
- Board는 첫 카드 작성 성공보다 앞에 나오지 않는다.
- 공개할 수 없는 이유를 이미지 유형과 권리 상태에 따라 설명한다.

## 8. 주요 분석 이벤트

```text
card_creation_started
image_selected
system_design_selected
anime_selected
private_title_created
first_memory_card_saved
second_memory_card_saved
third_memory_card_saved
archive_revisited
first_board_created
card_added_to_board
login_prompt_shown
sync_enabled
private_image_backup_enabled
publish_requested
publish_approved
publish_rejected
report_submitted
user_blocked
backup_exported
account_deletion_requested
```

이벤트 속성에는 자유 텍스트, 이미지, 개인 Board 제목을 포함하지 않는다.
