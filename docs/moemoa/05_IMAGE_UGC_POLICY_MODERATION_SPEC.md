# 05. 이미지 UGC 정책·신고·관리 구현 명세

> **문서 상태: `GATED TARGET SPEC`**
> Private 이미지 lifecycle과 Public UGC의 목표 기준이다. 일반 UGC gate와 이미지 유형별 권리 gate를 모두 통과하기 전 Public 기능을 활성화하지 않는다.

## 1. 목적

Pinterest처럼 시각적 수집과 공유의 자유도를 제공하되, 모든 이미지가 동일한 저장·공개·권리 상태를 갖는다고 가정하지 않는다.

정책 문서와 실제 시스템은 함께 구현한다.

## 2. 핵심 분리

### 입력 허용과 공개 허용

- 다양한 이미지를 카드에 연결하는 기능과 서비스 내 Public 권한을 분리한다.
- 사용자가 업로드했다는 사실은 공개 권리를 자동 증명하지 않는다.

### 일반 UGC 게이트와 이미지 권리 게이트

- 신고·차단·삭제 체계가 있어도 애니 캡처나 타인 팬아트의 권리가 자동 확보되지 않는다.
- `UGC-GATE-01`, `SCREENSHOT-PUBLIC-GATE-01`, `THIRD-PARTY-FANART-GATE-01`을 별도로 운영한다.

## 3. 이미지 유형

```text
SYSTEM_DESIGN
TEXT_DESIGN
USER_ORIGINAL
USER_CREATED_FANART
ANIME_SCREENSHOT
THIRD_PARTY_FANART
OTHER_MEDIA
UNKNOWN
```

이미지의 내용 유형인 `imageType`과 공개 근거인 `rightsBasis`는 분리한다. 같은 `imageType`이라도 저장 범위와 권리 근거에 따라 허용 범위가 달라질 수 있다.

`rightsBasis` 예시:

```text
SYSTEM_GENERATED
USER_ORIGINAL
USER_CREATED_FANART
OPEN_LICENSE
EXPLICIT_PERMISSION
ANIME_SCREENSHOT_PRIVATE_ONLY
THIRD_PARTY_UNKNOWN
UNKNOWN
```

## 4. 저장 상태

```text
LOCAL_ONLY
PRIVATE_CLOUD
PUBLIC
```

### LOCAL_ONLY

- 기기에 저장.
- 비로그인 가능.
- Web에는 이미지 대신 디자인 카드 또는 로컬 전용 표시.
- 계정 로그인만으로 자동 업로드하지 않는다.

### PRIVATE_CLOUD

- 로그인 필요.
- 사용자의 명시적 백업 선택 필요.
- private object ACL/signed URL.
- Public 검색·피드에 포함하지 않는다.

### PUBLIC

- 로그인, 권리 메타데이터, 정책 동의, 게이트 통과 필요.
- 공개 파생본과 원본 수명주기를 분리한다.
- 신고·삭제·복구 대상이다.

## 5. VisualAsset 최소 모델

```text
VisualAsset
- id
- ownerId
- intakeSource
- imageType
- storageScope
- visibility
- rightsBasis
- creatorName
- sourceUrl
- licenseType
- permissionEvidenceRef
- contentRating
- spoilerLevel
- moderationStatus
- state
- exactHash
- perceptualHash
- originalObjectKey
- derivativeGroupId
- createdAt
- publishedAt
- restrictedAt
- deletedAt
```

## 6. Private 저장·백업과 Public 게시 흐름 분리

### LOCAL_ONLY 카드 저장

```text
이미지 선택
→ 카드 Draft
→ 이미지 유형 선택/추론 보조
→ 승인된 local storage adapter에 보존
→ 로컬 decode·MIME·크기 검증
→ VisualAsset와 Complete Card 로컬 저장
```

- 네트워크, 로그인, cloud upload, Public 게시 권리 확인을 요구하지 않는다.
- 실제 로컬 보존 방식은 `STORAGE-LOCAL-01`에서 결정한다.

### PRIVATE_CLOUD 백업 — 별도 opt-in

```text
기존 LOCAL_ONLY VisualAsset
→ 로그인
→ private backup 범위·용량·삭제 정책 안내
→ 사용자의 명시적 백업 동의
→ PRIVATE quarantine upload
→ MIME·크기·해상도·악성 파일 검사
→ EXIF/GPS 제거와 안전한 포맷 변환
→ private object + metadata
→ 기기별 assetAvailability 갱신
```

- 백업 동의는 Public 게시 동의가 아니다.
- private object는 검색·피드·공개 URL에 노출하지 않는다.
- `IMAGE-SYNC-01`, `STORAGE-01`, `PRIVACY-01` 승인 전 구현 범위를 고정하지 않는다.

### PUBLIC 게시 요청 — 권리·운영 gate 별도

```text
사용자의 명시적 Public 요청
→ 이미지 유형·출처·rightsBasis·증빙 입력
→ Public 게시 권한 확인과 정책 동의
→ private 원본 또는 quarantine object 검사
→ exact/perceptual hash와 공개 파생본 생성
→ 자동 규칙
→ 필요 시 운영자 검토
→ generic UGC gate + image type rights gate 확인
→ 승인
→ PUBLIC derivative/CDN
```

Public 승인 전 원본을 공개 버킷에 두지 않는다. Public 파생본과 private 원본의 수명주기·삭제 전파를 분리해 추적한다.

## 7. 파일 처리

초기 권장:

- JPEG, PNG, WebP
- SVG 비허용
- 영상 비허용
- animated GIF는 후속 검토
- 실제 MIME 확인
- 확장자 불일치 차단
- 최대 크기·해상도 설정
- EXIF/GPS 제거
- 재인코딩
- 악성 파일 검사
- 썸네일·중간·공개용 파생본

구체 수치는 `STORAGE-01` 결정 후 설정한다.

## 8. 범위별 사용자 동의와 라이선스

### LOCAL_ONLY

- OS 파일 접근과 기기 내 처리 범위를 설명한다.
- 서버 저장이나 Public 게시 동의를 요구하지 않는다.

### PRIVATE_CLOUD

최소 확인:

```text
[ ] 이 이미지를 내 계정의 비공개 백업에 업로드하는 데 동의합니다.
[ ] 저장 용량·보관·삭제·복원 범위를 확인했습니다.
```

### PUBLIC 게시 요청

최소 확인:

```text
[ ] 이 콘텐츠를 공개 게시할 권한이 있습니다.
[ ] 출처와 라이선스 정보를 정확히 입력했습니다.
[ ] 제3자의 개인정보·초상권을 침해하지 않습니다.
[ ] 콘텐츠 정책과 신고·삭제 절차에 동의합니다.
```

서비스 약관은 사용자의 권리 소유를 유지하면서, 사용자가 **각 단계에서 선택한 범위**의 저장·복제·포맷 변환·썸네일 생성·표시·전송에 필요한 비독점적 라이선스를 정의한다. Private 백업 허용을 Public 게시나 서비스 홍보 허용으로 확장 해석하지 않는다.

서비스 홍보 활용은 별도 동의를 기본으로 한다.

## 9. 금지·제한 콘텐츠 범주

최소 정책 범주:

```text
COPYRIGHT_OR_LICENSE_VIOLATION
PRIVACY_OR_PERSONAL_DATA
IMPERSONATION
NON_CONSENSUAL_IMAGE
CHILD_SAFETY
SEXUAL_CONTENT
GRAPHIC_VIOLENCE
HATE
HARASSMENT
SELF_HARM
ILLEGAL_CONTENT
SPAM_OR_MANIPULATION
SPOILER_POLICY
OTHER
```

실제 문구와 연령 정책은 법률·스토어 검토 후 확정한다.

## 10. 신고 모델

```text
ContentReport
- id
- reporterId or contact
- targetType
- targetId
- reason
- jurisdiction
- description
- evidenceRefs
- priority
- status
- assignedTo
- resolution
- createdAt
- resolvedAt
```

### 신고 상태

```text
RECEIVED
TRIAGED
TEMP_RESTRICTED
UNDER_REVIEW
ACTIONED
REJECTED
APPEALED
RESTORED
CLOSED
```

## 11. 사용자 차단

- 차단한 사용자의 공개 카드·Board를 숨긴다.
- 차단 관계와 신고를 혼동하지 않는다.
- 차단이 원본 삭제를 의미하지 않는다.
- 관리자·안전 조사에는 필요한 범위에서 접근 가능하다.

## 12. ModerationAction

```text
ModerationAction
- id
- targetType
- targetId
- actionType
- policyVersion
- reasonCode
- actorType
- actorId
- userNotificationStatus
- appealAvailable
- createdAt
```

Action 예시:

- restrict visibility
- remove public derivative
- delete asset
- warning
- upload limit
- temporary suspension
- permanent suspension
- restore

## 13. 반복 침해자

```text
UserStrike
- userId
- strikeType
- severity
- sourceReportId
- status
- expiresAt
```

자동 영구 정지 규칙은 법률·운영 검토 없이 단순 횟수로 고정하지 않는다. 운영자가 근거와 이력을 볼 수 있어야 한다.

## 14. 이의제기

- 업로더에게 조치 사유와 정책 버전을 알린다.
- 이의제기 가능 여부와 기한을 표시한다.
- 원본 evidence와 action log를 보존한다.
- 복구 시 모든 파생 상태를 일관되게 복원한다.

## 15. 삭제 전파

한 이미지의 제한·삭제는 다음에 전파된다.

```text
원본 object
썸네일·리사이즈
CDN cache
Public MemoryCard
Public Board reference
검색 색인
추천 캐시
공유 미리보기
SavedReference
```

다른 사용자의 Board에는 파일을 복제하지 않고 원본 카드 참조만 저장한다.

## 16. 기능 플래그와 kill switch

최소 플래그:

- public publishing globally
- public image by imageType
- private cloud upload
- public Board
- public SavedReference
- new uploads pause
- public media hide all
- source/provider image disable
- country/region restriction

전역 이미지 숨김은 앱 업데이트 없이 동작해야 한다.

## 17. 초기 Public 권장 매트릭스

| 이미지 유형 | Private | Public v1 | 추가 게이트 |
| --- | ---: | ---: | --- |
| SYSTEM_DESIGN | 허용 | 후보 | generic UGC gate |
| TEXT_DESIGN | 허용 | 후보 | generic UGC gate |
| USER_ORIGINAL | 허용 | 후보 | 권리 동의·UGC gate |
| USER_CREATED_FANART | 허용 | 제한 후보 | 원작 IP 정책·국가 검토 |
| ANIME_SCREENSHOT | 허용 후보 | 비활성화 | screenshot rights gate |
| THIRD_PARTY_FANART | 로컬도 주의 | 비활성화 | 작가 허가·IP 정책 |
| OTHER_MEDIA | `rightsBasis`에 따라 결정 | 기본 비활성화 | 유형·권리 근거·UGC gate |
| UNKNOWN | LOCAL_ONLY | 금지 | 권리 상태 해결 |

Public 허용은 `imageType`, `storageScope`, `visibility`, `rightsBasis`와 증빙, moderation 상태, 이미지 유형별 gate를 모두 만족해야 한다. `OPEN_LICENSE`나 `EXPLICIT_PERMISSION`은 이미지 유형이 아니라 이 판정의 권리 축이다.

## 18. 연령과 소셜 범위

초기 공개 베타 권장안:

- 18+ 검토
- 댓글·DM·멘션·채팅 제외
- Public 카드·Board 열람과 저장 참조만 제공
- 성인·폭력·스포일러 가림

최종 연령 정책은 `AGE-01`로 사용자 확정이 필요하다.

## 19. 관리자 도구

### Queue

- 신고 우선순위
- 이미지 미리보기
- 권리 메타데이터
- 작성자 이력
- 동일 이미지 그룹
- 관련 Board·SavedReference

### Actions

- temporary restrict
- approve/reject publish
- delete derivatives
- warn/suspend
- request evidence
- resolve appeal
- audit log

### Operational dashboard

- report volume
- response time
- repeat violation rate
- appeal/restoration rate
- queue age
- public upload count
- storage/egress cost

## 20. 개인정보·보안

- signed URL과 least privilege.
- private object를 public URL로 추측할 수 없어야 한다.
- 자유 텍스트와 이미지 bytes를 일반 로그에 남기지 않는다.
- 관리자 접근을 role-based로 제한한다.
- 신고자 정보와 피신고자 정보를 필요한 기간만 보관한다.
- 계정 삭제와 법적·감사 보존을 구분한다.

## 21. UGC 게이트 완료 조건

- 약관·정책 버전 동의 기록.
- 신고·차단·심사·삭제·이의제기 E2E.
- 원본·파생본·CDN 삭제 검증.
- 비공개 이미지 무단 접근 테스트.
- public kill switch 테스트.
- 운영 담당자와 SLA.
- 스토리지·전송 비용 측정.
- generic UGC gate와 별도 rights gate 상태가 UI와 관리자 화면에 표시.
