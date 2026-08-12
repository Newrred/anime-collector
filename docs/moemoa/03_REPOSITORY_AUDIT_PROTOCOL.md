# 03. 저장소 감사 프로토콜

> **문서 상태: `CURRENT AUDIT PROTOCOL / FIRST RUN COMPLETE`**
> 최초 감사는 2026-08-11 완료되었다. 현재 결과는 `reports/repository-audit.md`를 사용하고 code·config·migration이 크게 바뀌면 이 protocol로 재검증한다.

## 1. 목적

개발 전에 현재 저장소의 사실을 확인하고, 과거 문서의 상태 메모와 현재 제품 결정을 비교한다.

첫 감사에서는 코드 수정, 의존성 설치, 데이터 마이그레이션, 포맷 전체 변경을 하지 않는다.

## 2. 필수 산출물

```text
docs/moemoa/reports/repository-audit.md
docs/moemoa/reports/implementation-gap-analysis.md
docs/moemoa/reports/architecture-options.md
docs/moemoa/reports/open-decision-questions.md
```

각 주장은 파일 경로, 설정 키, 코드 심볼, 명령 결과 등 검증 가능한 근거를 포함한다.

## 3. 감사 순서

### 3.1 저장소 기본 정보

- Git root
- 현재 브랜치와 status
- 최근 커밋
- monorepo 여부
- package manager
- 언어와 프레임워크
- 앱·패키지·서버 디렉터리 구조
- README와 기존 AGENTS/CONTRIBUTING/architecture 문서

### 3.2 실행·테스트

- 설치 명령
- 개발 서버 명령
- production build
- unit/integration/E2E test
- lint/typecheck/format
- CI workflow
- 환경 변수 예시

위험한 명령은 실행하지 않고 문서만 확인한다. 안전한 상태에서 가능한 검증만 실행한다.

### 3.3 Web

- 라우팅
- 상태 관리
- API client
- 반응형 모바일 UX
- PWA/service worker 여부
- Archive·Library·Tier·Board 관련 기존 화면
- 인증·계정 화면
- 공개 페이지·SEO 구조
- 관리자 기능

### 3.4 Android

- Android 프로젝트 존재 여부
- native, hybrid, wrapper, cross-platform 여부
- Share Target/Intent filter
- Photo Picker 또는 갤러리 권한
- 로컬 DB
- 파일 저장
- offline queue
- deep link/App Link
- push notification

Android 코드가 없으면 현재 Web 스택과 재사용 가능한 경로를 비교한다.

### 3.5 백엔드

- API framework
- DB와 ORM
- migrations
- object storage
- auth/session
- queues/jobs
- rate limiting
- admin authorization
- background processing
- deployment configuration

### 3.6 작품 데이터

- AniList API 호출 위치
- 검색·상세·이미지 의존
- provider abstraction 여부
- aliases 또는 legacy data 파일
- 데이터 모델과 내부 ID
- 캐시와 영구 저장 구분
- source/provenance 필드
- admin import/edit tools

특히 다음을 확인한다.

```text
src/data/aliases.json 또는 동등 파일
anilistId 의존 관계
외부 이미지 URL 저장 방식
기존 migration 안정화 코드
```

### 3.7 Memory Card·Archive·Board

- 현재 Log/QuickLog/Library 엔터티
- 원자적 저장 보장
- 작품당 하나의 기록으로 제한되는지
- 이미지 연결 구조
- Board 또는 Tier 구조
- N:M 관계 가능성
- 데이터 export/restore/delete

### 3.8 계정·동기화

- 비로그인 식별자
- 로그인 시 로컬 데이터 처리
- sync source of truth
- conflict resolution
- offline state
- status UI
- logout·account deletion

### 3.9 이미지

- 이미지 입력 경로
- local URI/reference/copy 방식
- server upload
- thumbnail/resize
- EXIF 처리
- public/private storage
- CDN
- delete propagation
- external image kill switch

### 3.10 UGC 운영

- terms acceptance
- content report
- user report/block
- moderation queue
- takedown/appeal
- strike/suspension
- audit log
- feature flags
- admin roles

### 3.11 분석과 로그

- analytics provider
- crash/error tracking
- event schema
- PII redaction
- user note/image logging 위험
- version/release tagging

### 3.12 보안·개인정보

- secrets handling
- access control
- object storage ACL
- signed URLs
- data retention
- account deletion
- backups
- third-party processors

## 4. Gap 분류

| 등급 | 의미 |
| --- | --- |
| `KEEP` | 새 방향에서도 그대로 유지 |
| `ADAPT` | 기반은 유지하되 도메인·UX 수정 |
| `MIGRATE` | 데이터/구조를 단계적으로 이전 |
| `ISOLATE` | adapter 또는 feature flag 뒤에 격리 |
| `DEPRECATE` | 사용 중단 예정, 즉시 삭제 금지 |
| `REMOVE` | 승인된 마이그레이션 후 제거 |
| `UNKNOWN` | 증거 부족, 추가 확인 필요 |

## 5. 구현 Gap 표 형식

| 요구사항 | 현재 상태 | 근거 | Gap | 권장 조치 | 위험 | 승인 필요 |
| --- | --- | --- | --- | --- | --- | --- |

## 6. 아키텍처 옵션 보고 형식

각 옵션에 다음을 포함한다.

- 현재 코드 재사용 범위
- Web/Android 공유 방식
- native 기능 지원
- offline/local storage
- 배포 복잡도
- 테스트 전략
- 예상 마이그레이션
- 주요 장점·단점
- 권장안과 이유

## 7. 감사 단계 금지사항

- package lock 변경
- 자동 formatter 전체 실행
- DB migration 실행
- 코드 삭제
- legacy data 변환
- 전체 catalog scrape
- production credential 사용
- public feature enable

## 8. 감사 완료 조건

- 실행 가능한 앱·서버 단위를 식별했다.
- 기존 테스트와 실제 통과 여부를 확인했다.
- AniList와 외부 이미지 의존을 파일 단위로 추적했다.
- `legacy_unverified` 후보를 식별했다.
- Web+Android 구현 옵션을 현재 스택 근거로 비교했다.
- 첫 vertical slice를 시작하기 전에 필요한 사용자 결정 목록을 만들었다.
- 모든 불확실성을 사실처럼 표현하지 않았다.
