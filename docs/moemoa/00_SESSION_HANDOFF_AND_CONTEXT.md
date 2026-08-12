# 00. 세션 인수인계와 프로젝트 맥락

> **문서 상태: `CURRENT_CONTEXT`**
> 제품 맥락은 이 문서를 사용하되, 구현 사실은 repository code/tests/config와 `reports/repository-audit.md`가 우선한다.

## 1. 문서 목적

이 문서는 현재 대화를 이동할 수 없는 상황에서, Codex가 제품 의도와 기술 작업의 경계를 잃지 않도록 최소한의 전체 맥락을 제공한다.

## 2. 제품의 현재 정의

> MOEMOA는 애니를 본 뒤 기억하고 싶은 장면을 이미지 중심 Memory Card로 저장하고, Archive와 Board를 통해 수집·재분류·재발견하며, 권리와 운영 체계가 준비된 범위 안에서 공유하는 서비스다.

MOEMOA가 우선 해결하려는 문제는 일반 애니 목록 관리가 아니다.

- 사용자는 장면 스크린샷과 짧은 감정을 여러 앱에 흩어 저장한다.
- 작품 목록만으로는 왜 그 작품이 남았는지 보존되지 않는다.
- 긴 리뷰보다 빠른 시각 기록과 다시 보는 경험이 필요하다.
- 카드가 쌓이며 수집 욕구와 개인 아카이브의 소유감을 형성해야 한다.

## 3. 핵심 제품 구조

```text
Anime / PrivateTitle
  1 ─ N MemoryCard

MemoryCard
  N ─ M Board         // BoardCard가 순서와 저장 시각 관리
  1 ─ 1 VisualAsset   // 사용자 이미지 또는 시스템 디자인 카드

Public reference
  원본 카드와 이미지 파일을 복제하지 않고 참조
```

## 4. 이번 세션에서 사용자가 확정한 내용

- Web + Android.
- Android는 이미지 수집, Share Target, 빠른 카드 작성의 주력 클라이언트.
- Web은 Archive, Board, 공개 페이지, 계정, 관리 기능의 공통 기반.
- 같은 백엔드와 데이터 모델 사용.
- 작품 제목 + 시각 요소가 카드 완료 조건.
- 사용자 이미지를 강력 권장하되 서비스 디자인 카드 허용.
- 작품 장르 태그는 카탈로그에서 자동 연결.
- 감상·감정·날짜·장면은 선택.
- Archive 자동, Board 선택, 카드 3개 이후 Board 제안.
- Board N:M.
- 모든 이미지 유형을 데이터 모델에서 구분 지원.
- Public은 이미지 유형별로 분리하고 기능 플래그로 제어.
- 로그인 없이 로컬 사용, 첫 카드 뒤 로그인 권장.
- 백업·Web·다기기·공개 기능은 로그인 필요.
- 다가오는 분기와 최근 2~3년 주요 작품부터 자체 카탈로그 구축.
- 없는 작품은 개인 전용으로 즉시 생성.
- 기존 데이터는 `legacy_unverified`.
- 여러 사이트에서 필요한 사실 필드를 raw data로 수집한 뒤 MOEMOA 구조로 정규화.
- 자유로운 이미지 사용을 지향하되 정책, 신고, 차단, 심사, 삭제, 이의제기, 반복 침해자 처리를 실제 구현한 뒤 공개 범위를 확대.

## 5. 카탈로그에 필요한 데이터 필드

- 원제
- 공식 영문 제목
- 공식 현지화 제목
- 방영 연도·분기
- 시작일·종료일
- 형식: TV, Movie, OVA, ONA, Special 등
- 화수
- 방영 상태
- 제작사 및 역할
- 공식 사이트
- 원작 유형
- 작품 관계
- 장르와 작품 속성 태그
- 등장 캐릭터
- 캐릭터별 성우 및 언어·배역 관계

태그는 외부 설명문·가중치·명명 체계를 복제하는 것이 아니라 raw candidate를 자체 태그 체계로 재구성한다.

## 6. 과거 문서에서 계승한 제품 원칙

- 작품 데이터는 카드 제작을 돕는 보조 인덱스이며 사용자가 만든 카드가 주인공이다.
- 같은 작품에서도 여러 장면과 시기마다 여러 Memory Card를 만들 수 있다.
- 공개 경쟁보다 개인 Archive의 수집감과 Board의 재해석을 우선한다.
- 공개 공유는 개인 경험과 운영 안전 장치가 검증된 뒤 단계적으로 연다.
- 데이터 내보내기·복원·삭제를 제공한다.
- 이미지가 없어도 시스템 디자인 카드로 완성 가능해야 한다.
- 다른 사용자의 카드를 Board에 저장할 때는 원본 참조와 작성자·출처를 유지한다.

## 7. 과거 구현 상태 메모 — 2026-08-11 감사로 대체됨

2026-08-10 기준 문서에는 다음이 기록되어 있었다.

- master에 동남아 출시·수익화 설계, 구현 계획, 제품 안정화 작업이 병합됨.
- 신규 사용자 빈 상태, 영어 UX, 퀵로그 원자적 저장, 저장·동기화·레거시 마이그레이션 안정화는 구현·검증 완료.
- 런타임 검색·상세·표지 이미지는 AniList 의존.
- 자체 카탈로그, `legacy_unverified` 마이그레이션, Memory Card·Archive·Board·제한적 공유는 구현 전.

Codex는 이 메모를 현재 사실로 간주하면 안 된다. 실제 브랜치·커밋·파일·테스트 결과는 아래 감사 snapshot과 현재 code를 사용한다.

### 2026-08-11 재검증 결과

근거: `reports/repository-audit.md`, `master@e71f211`.

- 현재 실행물은 Astro 5 + React 19 기반 Web/PWA이며 Android project, Share Target, Photo Picker는 없다.
- 현재 핵심 도메인은 Library, WatchLog, Character Memory, Tier다. 신규 MemoryCard, VisualAsset, Archive/Board, PrivateTitle 도메인은 구현 전이다.
- 현재 catalog/search는 AniList와 Wikidata runtime adapter에 의존하며 자체 canonical catalog ingestion은 없다.
- Supabase split record와 snapshot fallback이 공존하고 일부 일반 쓰기는 dirty tracking이 누락될 수 있다. 실제 제품 데이터도 계정별 local namespace로 분리되지 않았다.
- unit preflight 40/40, build 8 pages, Chromium 단일 worker 36 pass·live-only 2 skip를 확인했다. 기본 병렬 E2E는 cold-start/timeout 실패가 있어 단일 worker를 감사 기준으로 사용했다.

이 snapshot은 코드·인프라가 바뀌면 다시 검증한다. 세부 Gap과 권장 migration 순서는 `reports/implementation-gap-analysis.md`에 있으나, 그 순서는 승인된 ExecPlan이 아니다.

## 8. 리서치에서 얻은 핵심 제품 판단

- 일반 트래커 대체보다 개인 시각 기억 아카이브 포지셔닝이 유효하다.
- 첫 카드보다 두 번째·세 번째 카드와 Archive 재방문이 중요하다.
- 이미지 중심 수집 욕구를 유지하되 시스템 디자인 카드가 대체 경로여야 한다.
- Board는 데이터 구조상 P0이지만 첫 카드 흐름에서 강제하지 않는다.
- 공개 이미지 SNS를 첫 핵심으로 삼으면 저작권·모더레이션·스토리지·콜드스타트가 동시에 발생한다.
- 따라서 Private vertical slice와 UGC 기반을 구분해 단계적으로 구현한다.

## 9. 프로젝트에서 피해야 할 방향

- AniList 축소 복제처럼 보이는 작품 상세 중심 제품.
- 작품 제목만 추가해도 완성되는 일반 목록 앱.
- Web과 Android가 서로 다른 도메인 모델과 저장 개념을 갖는 구조.
- 로그인 시 사용자의 로컬 이미지를 자동 업로드하는 구조.
- 공개 UGC 정책 문서만 있고 실제 신고·차단·삭제 도구가 없는 구조.
- UGC 시스템을 구현했다는 이유로 애니 캡처나 타인 팬아트의 공개 권리가 자동 확보된다고 보는 구조.
- 외부 데이터를 스키마만 바꾸면 검증된 자체 데이터가 된다고 보는 구조.
- 전체 카탈로그 수집을 핵심 제품 흐름보다 먼저 끝내려는 접근.

## 10. 최우선 검증 질문

1. 사용자는 Android에서 이미지를 받아 90초 안에 카드를 완성할 수 있는가?
2. 이미지 중심 카드가 두 번째·세 번째 카드 작성으로 이어지는가?
3. Archive와 Board가 실제 재방문 이유가 되는가?
4. Web과 Android의 동기화 상태가 오해 없이 표시되는가?
5. 이미지가 `LOCAL_ONLY / PRIVATE_CLOUD / PUBLIC` 중 어디에 있는지 사용자가 이해하는가?
6. 공개 UGC가 신고·삭제·권리 요청에 실제로 대응 가능한가?
7. 카탈로그가 불완전해도 PrivateTitle로 기록을 계속할 수 있는가?
