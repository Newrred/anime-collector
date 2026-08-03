# MOEMOA 동남아 출시·수익화 설계

- 작성일: 2026-08-03
- 상태: 방향 승인, 구현 전 설계
- 1차 시장: 필리핀
- 교차 검증 시장: 싱가포르
- 후속 후보: 베트남, 태국
- 초기 유료 광고 실험 한도: 600,000원 / 4주

## 1. 결정 요약

MOEMOA는 애니메이션 정보를 소비하는 데이터베이스가 아니라, 사용자가 감상한 작품과 그때의 감정을 빠르게 남기고 다시 발견하는 개인 기록 서비스로 포지셔닝한다.

초기 출시 원칙은 다음과 같다.

1. 영어 우선으로 필리핀과 싱가포르에서 제품 적합성을 검증한다.
2. 필리핀을 사용자 확보의 주 시장, 싱가포르를 구매력·영어 UX·광고 효율의 교차 검증 시장으로 사용한다.
3. 베타 기간에는 서비스 내부 광고와 유료 기능을 넣지 않는다.
4. 600,000원의 광고비는 수익 회수 비용이 아니라 타깃과 메시지를 검증하는 학습 비용으로 취급한다.
5. AniList API 및 표지 이미지의 사용 권리를 서면으로 확인하기 전에는 광고·스폰서십 등 상업화를 시작하지 않는다.
6. 핵심 기록 기능은 장기적으로도 무료로 유지하고, 정착 이후 제한적 광고와 선택형 서포터 기능을 검토한다.

## 2. 제품 포지셔닝

### 핵심 약속

> Remember what you watched, and how it felt.

사용자가 얻어야 하는 가치는 작품 데이터의 양이 아니라 다음 흐름의 편의성이다.

```text
작품 검색 → 내 라이브러리에 추가 → 짧은 감상 기록 → 다시 발견 → 연간 회고·티어 정리
```

### 기존 대형 트래커와의 차별점

- 작품 정보 탐색보다 개인 기억과 감상 로그를 전면에 둔다.
- 점수만 남기는 대신 짧은 메모, 감정, 다시 보고 싶은 이유를 기록하게 한다.
- 과거 기록을 resurfacing 카드, 연간 회고, 티어 보드로 다시 보여준다.
- 공개 팔로워 수 경쟁보다 개인 아카이브의 소유감과 정리 만족도를 우선한다.
- 기본은 offline-first이고 로그인과 클라우드 동기화는 안전한 백업·멀티기기 편의로 설명한다.

## 3. 초기 타깃

### 1차 페르소나

- 18~34세 영어 사용 가능 애니메이션 시청자
- 여러 스트리밍 서비스와 SNS에서 작품을 발견하지만 감상 이력이 흩어져 있는 사용자
- 기존 트래커가 복잡하거나 점수·커뮤니티 중심이라 부담스러운 사용자
- Instagram, Facebook, TikTok에서 애니 관련 콘텐츠를 소비하는 사용자
- 긴 리뷰보다 짧고 시각적으로 정돈된 개인 기록을 선호하는 사용자

### 시장 역할

| 시장 | 역할 | 운영 원칙 |
| --- | --- | --- |
| 필리핀 | 저비용 사용자 확보와 메시지 검증 | 광고 예산의 약 70%, 모바일 우선, 감정 기록 메시지 |
| 싱가포르 | 영어 UX와 상대적으로 높은 구매력 교차 검증 | 광고 예산의 약 20%, 프라이버시·정돈·회고 메시지 |
| 공통 예비비 | 성과가 좋은 소재·시장에 재배분 | 약 10%, 2주차 이후 사용 |

베트남어와 태국어 현지화는 영어 버전의 활성화 및 재방문 지표가 확인된 이후 진행한다. 초기부터 네 국가를 동시에 운영하지 않는다.

## 4. 출시 전 기능 보완 범위

### P0: 출시를 막는 항목

#### 실제 사용자 데이터와 데모 데이터 분리

- 신규 사용자의 라이브러리는 실제로 비어 있어야 한다.
- 예시 작품은 제품 설명용 데모로만 보여주고 저장 데이터로 취급하지 않는다.
- 데모 데이터를 추가하려면 사용자의 명시적 선택을 받는다.

#### 퀵로그의 원자적 저장

- 퀵로그 화면을 열기만 해서는 빈 로그가 생성되지 않아야 한다.
- 사용자가 저장을 확정한 시점에만 로그를 생성한다.
- 취소, 뒤로가기, 브라우저 종료 후 빈 기록이 남지 않아야 한다.

#### 빈 상태 온보딩

- 첫 화면의 단일 목표는 첫 작품 추가로 제한한다.
- 작품 1개 추가 후 첫 로그 작성, 작품 3개 추가 후 회고·티어 기능을 안내한다.
- 처음부터 모든 기능을 동시에 노출하지 않는다.

#### 동기화 상태의 정직한 표현

- Supabase가 구성되지 않았거나 로그인하지 않은 경우 클라우드 데이터가 존재하는 것처럼 보이지 않게 한다.
- 로컬 저장, 동기화 대기, 동기화 완료, 충돌, 설정 미완료 상태를 구분한다.
- 자동 병합이 불가능한 경우 사용자가 로컬·클라우드 중 하나를 선택할 수 있게 한다.

#### 영어 품질

- 메뉴·상태·오류·빈 화면·동기화·백업 문구를 모두 자연스러운 영어로 통일한다.
- 작품 제목은 영어 제목을 기본으로 하되 romaji와 원제를 보조 검색 키로 유지한다.
- 날짜와 시간은 사용자 로캘과 시간대를 사용한다.

### P1: 초기 리텐션을 위한 항목

- 최근 기록, 다시 보고 싶은 작품, 기록하지 않은 작품을 홈의 우선 영역으로 재구성한다.
- Tier 기능은 Labs가 아니라 핵심 회고 기능으로 승격한다.
- Minihome·공개 프로필은 초기 핵심 탐색에서 후순위로 둔다.
- 기록 완료 후 다음 행동은 광고가 아니라 `다른 작품 기록`, `과거 기록 보기`, `티어에 배치`로 연결한다.
- JSON 내보내기와 복원은 무료로 유지하고, 사용자가 자신의 기록을 소유한다는 메시지를 강화한다.

### P2: 성장 이후 항목

- 연간·분기별 감상 회고
- 기록 패턴과 장르 변화 통계
- 텍스트·도형 중심 공유 카드
- 사용자 정의 리스트와 테마
- 국가별 합법 스트리밍 서비스 연결

## 5. 데이터·이미지 권리 설계

### 확인된 위험

- AniList API 약관은 월 매출 150달러 미만의 상업 서비스 사용을 허용하지만, 애니·만화 목록 및 트래커와 같은 경쟁 서비스는 별도 승인 대상이라고 명시한다.
- 표지 이미지 URL이 API에 포함된다는 사실만으로 이미지 저작권의 상업적 재사용 허락이 자동으로 주어지는 것은 아니다.
- 광고 네트워크는 저작권 침해 콘텐츠뿐 아니라 외부 복제 콘텐츠에 독자적 가치가 부족한 화면에도 광고를 제한할 수 있다.

참고 자료:

- [AniList API Terms of Use](https://docs.anilist.co/guide/terms-of-use)
- [AniList MediaCoverImage Reference](https://docs.anilist.co/reference/object/mediacoverimage)
- [Google Publisher Policies](https://support.google.com/adsense/answer/10502938?hl=en-15)
- [AdSense account approval guidance](https://support.google.com/adsense/answer/81904?hl=en)

### 출시 전 필수 조치

AniList에 다음 내용을 포함해 서면으로 문의한다.

- 서비스명과 공개 URL 또는 데모 URL
- 개인 감상 기록 및 회고가 핵심이라는 설명
- AniList와의 동기화 여부 및 API 호출 범위
- 검색 결과, 상세 정보, 표지 이미지의 표시 방식
- 이미지 캐싱·리사이징·CDN 저장 여부
- 베타 이후 광고와 선택형 유료 기능 도입 가능성
- 필리핀·싱가포르 대상 서비스라는 점
- 트래커 성격의 서비스 운영 허가 여부
- 표지 이미지의 상업 서비스 내 표시가 API 허가에 포함되는지 여부
- 필요한 표시 문구, 링크, attribution, 상업 라이선스 조건

### 구현상 안전장치

- 외부 작품 데이터 접근을 공급자 인터페이스 뒤로 분리한다.
- 작품 데이터에 `provider`, `providerMediaId`, `imageSourceUrl`, `fetchedAt`, `rightsStatus`를 보관한다.
- 표지 이미지를 전체 또는 공급자별로 즉시 숨길 수 있는 feature flag를 둔다.
- 이미지가 없을 때도 완성된 화면이 되도록 색상·타이포그래피 기반 placeholder를 준비한다.
- 권리가 확인되지 않은 이미지는 광고 소재와 공유 카드에 포함하지 않는다.
- 저작권 신고 및 삭제 요청 주소와 처리 절차를 마련한다.
- 허가 범위가 명시되지 않으면 이미지를 자체 서버에 대량 저장하거나 재배포하지 않는다.

### AniList 답변별 분기

| 답변 | 대응 |
| --- | --- |
| 트래커와 이미지의 상업 이용을 명시적으로 허용 | 조건과 attribution을 기록하고 출시 진행 |
| API 사용은 허용하지만 이미지 권리는 불명확 | 이미지 없는 모드 또는 별도 권리 확보 공급자로 출시 |
| 비상업 베타만 허용 | 광고·후원 없이 제한 베타를 진행하고 대체 공급자 조사 |
| 트래커 사용 불허 | AniList 의존 기능을 중단하고 수동 입력·다른 정식 공급자 구조로 전환 |
| 답변 없음 | 공개 상업 출시를 보류하고 대체 데이터 전략을 먼저 확정 |

## 6. 수익화 설계

### 채택 모델

```text
무료·무광고 베타
  → 권리와 리텐션 확인
  → 독자 콘텐츠 화면의 제한적 광고·스폰서 실험
  → 선택형 Supporter 기능
```

### 베타 기간

- 모든 핵심 기록 기능을 무료로 제공한다.
- 서비스 내부 광고를 표시하지 않는다.
- 600,000원의 사용자 획득 광고비를 서비스 내부 광고 수익으로 즉시 회수하려 하지 않는다.
- 가격보다 기록 습관과 재방문이 만들어지는지 측정한다.

### 광고 도입 조건

다음 조건을 모두 충족한 뒤에만 광고 실험을 시작한다.

1. AniList 및 이미지 권리 문제가 서면으로 해결되어 있다.
2. 30일 리텐션이 최소 두 코호트에서 안정적이다.
3. 월 100,000 이상의 광고 표시 가능 페이지뷰가 발생한다.
4. 회고·통계·공개 큐레이션처럼 서비스가 직접 만든 콘텐츠 화면이 충분하다.
5. 개인정보 동의와 국가별 광고·쿠키 설정이 준비되어 있다.

### 광고 허용·금지 위치

| 허용 후보 | 금지 |
| --- | --- |
| 긴 연간 회고의 섹션 사이 | 퀵로그 입력 중 |
| 독자적 설명이 있는 공개 리스트 하단 | 저장 직후 전면광고·팝업 |
| 장문 통계·회고 페이지 하단 | 작품 검색 결과의 포스터 사이 |
| 향후 에디토리얼·시즌 결산 페이지 | 작품 상세 모달, 로그인, 백업, 충돌 해결 화면 |

첫 광고 실험은 사용자의 10%에만 노출한다. 기록 완료율이 대조군보다 5% 이상 하락하면 해당 배치를 중단한다.

### 정착 이후 선택형 유료 기능

초기에는 구독보다 일회성 `Supporter Pack`을 먼저 검증한다.

- 광고 제거
- 추가 테마와 라이브러리 꾸미기
- 고급 연간 회고 레이아웃
- 추가 공유 카드 스타일
- 서포터 표시

다음 기능은 신뢰를 위해 무료로 유지한다.

- 기본 작품 추가 및 감상 기록
- 기본 검색과 라이브러리
- JSON 내보내기·복원
- 계정 삭제와 데이터 삭제
- 필수 동기화 안전 기능

## 7. 4주 출시 실험

### 주차별 운영

#### 준비 주간

- 제품 분석 이벤트와 퍼널 정의
- 개인정보처리방침·이용약관·저작권 신고 창구 준비
- 영어 랜딩 페이지와 모바일 온보딩 점검
- 자체 UI만 사용하는 광고 소재 제작
- AniList 승인 또는 대체 데이터 방안 확정

#### 1주차: 메시지 탐색

- 필리핀과 싱가포르에서 소액으로 동일한 세 가지 메시지를 비교한다.
- 광고 최적화 이벤트는 단순 방문이 아니라 회원가입 또는 첫 작품 추가로 설정한다.
- 국가·소재별 표본이 너무 작을 때 성급하게 중단하지 않는다.

메시지 후보:

1. `Your anime memories, not just a score.`
2. `Remember why an anime mattered to you.`
3. `A quiet personal anime journal.`

#### 2주차: 소재와 온보딩 최적화

- 클릭률보다 활성화 사용자당 비용을 기준으로 소재를 줄인다.
- 랜딩 페이지와 실제 첫 화면의 문구·비주얼을 일치시킨다.
- 이탈이 가장 큰 온보딩 단계를 한 번에 하나씩 수정한다.
- 예비비를 성과가 좋은 국가·소재 조합에 배분한다.

#### 3주차: 리텐션 확인

- 신규 유입 확대보다 7일 재방문을 관찰한다.
- 첫 로그를 남긴 사용자와 작품만 추가한 사용자의 차이를 비교한다.
- 재방문 유도 이메일·알림은 명시적 동의를 받은 사용자에게만 최소한으로 시험한다.

#### 4주차: 판단

- 국가별 활성화율, 활성화 사용자당 비용, 7일 리텐션을 비교한다.
- 광고를 중단해도 직접 방문과 기록이 이어지는지 확인한다.
- 베트남·태국 확장, 필리핀 집중, 제품 재작업 중 하나를 선택한다.

## 8. 광고 예산 원칙

초기 가안:

- 필리핀: 420,000원
- 싱가포르: 120,000원
- 재배분 예비비: 60,000원

Meta의 일일 예산 변동을 고려해 캠페인 전체 한도를 별도로 관리하고, 4주 누적 지출이 600,000원을 넘지 않도록 한다. 초기에는 Instagram과 Facebook을 하나의 Meta 캠페인 안에서 테스트하고, TikTok은 유기적 짧은 영상 또는 별도의 소액 검증으로 분리한다.

광고에는 애니 캐릭터·포스터·공식 키아트를 사용하지 않는다. 제품의 실제 UI, 타이포그래피, 색상, 사용 흐름을 소재로 사용한다.

## 9. 측정 체계

### 핵심 이벤트

- `landing_view`
- `signup_started`
- `signup_completed`
- `first_title_added`
- `third_title_added`
- `first_log_saved`
- `recap_viewed`
- `tier_entry_added`
- `backup_exported`
- `sync_enabled`

### 활성화 정의

가입 또는 첫 방문 후 24시간 안에 다음을 완료한 사용자를 활성화 사용자로 정의한다.

- 작품 3개 이상 추가
- 감상 로그 1개 이상 저장

### 우선 지표

1. 랜딩 방문 대비 활성화율
2. 활성화 사용자당 획득 비용
3. 활성화 사용자의 D1, D7, D30 리텐션
4. 월간 활성 사용자당 감상 로그 수
5. 자연 유입·직접 방문 비율
6. 오류 없는 동기화 성공률

첫 100명의 가입자까지는 수치를 업계 기준과 비교하기보다 퍼널의 큰 장애를 찾는 데 사용한다. 이후 코호트부터 국가별 목표치를 재설정한다.

### 600,000원 실험의 성공 판단

다음 중 하나만 좋다고 성공으로 판단하지 않는다.

- 클릭률이 높지만 활성화가 낮은 경우
- 가입이 저렴하지만 기록을 남기지 않는 경우
- 첫 기록은 많지만 7일 안에 모두 이탈하는 경우

활성화 비용과 7일 리텐션이 함께 개선되고, 유료 유입이 중단된 뒤에도 일부 사용자가 다시 기록하러 돌아올 때 다음 단계로 진행한다.

## 10. 출시 의사결정 기준

### 계속 진행

- 영어 UX에서 첫 기록 흐름이 안정적으로 완료된다.
- 특정 국가·메시지 조합에서 반복 가능한 활성화가 나타난다.
- 활성화 사용자의 재방문이 비활성 사용자보다 명확히 높다.
- 데이터·이미지 권리 조건이 문서로 확보되어 있다.

### 제품 수정 후 재시험

- 광고 클릭은 발생하지만 첫 작품 추가에서 이탈한다.
- 데모 데이터나 동기화 상태 때문에 제품을 오해한다.
- 첫 작품은 추가하지만 감상 로그를 남기지 않는다.
- 모바일에서 기록 완료 시간이 길다.

### 확장 보류

- AniList 사용 허가 또는 대체 공급자를 확보하지 못했다.
- 두 개 이상의 코호트에서 7일 재방문이 거의 발생하지 않는다.
- 유료 광고를 중단하면 신규·재방문 사용이 동시에 사라진다.
- 광고나 유료화 없이는 운영비를 감당할 수 없는데 광고 표시 가능 트래픽이 충분하지 않다.

## 11. 현재 범위에서 제외

- 출시 초기 구독형 프리미엄
- 기록 기능 자체의 유료화
- 크리에이터 협업과 경품 캠페인
- 네 국가 동시 현지화
- 권리 확인 전 배너 광고·제휴 링크·스폰서십
- 애니 포스터·캐릭터를 사용한 유료 마케팅 소재

## 12. 다음 산출물

이 설계가 최종 승인되면 별도의 구현 계획에서 다음을 파일·컴포넌트 단위로 나눈다.

1. 데모 데이터 분리와 신규 사용자 빈 상태
2. 퀵로그 저장 시점 수정
3. 온보딩과 정보 구조 개편
4. 영어 카피와 로캘 점검
5. 데이터 공급자·이미지 권리 추적 구조
6. 분석 이벤트와 출시 대시보드
7. 권리 상태에 따른 feature flag
8. 베타 배포·검증·광고 실험 절차

이 문서는 법률 자문을 대신하지 않는다. 실제 상업 출시 전에는 AniList의 서면 답변을 보관하고, 답변이 불명확하거나 규모가 커질 경우 관련 국가의 전문가 검토를 받는다.

## 부록 A. AniList 문의 메일 초안

```text
Subject: Permission inquiry for a personal anime journaling service using the AniList API

Hello AniList team,

I am preparing a small anime journaling web service called MOEMOA. Its main purpose is to help users privately record what they watched, add short personal notes, and revisit their memories through recaps and tier boards.

The service is not intended to reproduce the AniList social experience. It currently uses the public AniList GraphQL API for anime search, basic metadata, and cover image URLs. User journals and lists are stored by MOEMOA, and the service does not currently sync with AniList user accounts.

I would like to launch an English beta for users in the Philippines and Singapore. The beta will initially be free and ad-free. If the service gains stable usage, I may later test limited display advertising on original recap or editorial pages and optional supporter features.

Before launch, could you please clarify the following?

1. May MOEMOA use the AniList API as a personal anime journaling/list service under these conditions?
2. Would written authorization be required because the service includes anime list/tracking functionality?
3. Does permitted API use include displaying the cover image URLs returned by the API in a commercial or ad-supported service?
4. Are image caching, resizing, or CDN proxying allowed? If so, under what conditions?
5. Are there required attribution, links, rate-limit, or AniList account integration requirements?
6. At what point would a commercial license be required, and what information would you need from me?

I can provide a private demo URL, screenshots, and a more detailed description of the API calls if helpful.

Thank you for your time.

Best regards,
[Name]
[Contact email]
[Demo URL, if available]
```
