# 04. 카탈로그 데이터와 수집 파이프라인 명세

> **문서 상태: `GATED TARGET SPEC`**
> 내부 ID·provenance·표본 검증의 목표 기준이다. `SOURCE-01`과 `FULL-CATALOG-INGESTION-GATE-01` 통과 전 전체 수집·승격을 실행하지 않는다.

> 2026-08-18: `REPRESENTATIVE-100-INGESTION-01`이 승인되어 골든 10개를 포함한 `sample100` 로컬 표본까지 실행할 수 있다. 전체 3,998개 수집 게이트는 그대로 유지한다.

> 2026-08-18: `FULL3998-BATCH-CODE-01`로 100개 이하 순차 batch·resume·progress snapshot 코드 구현이 승인됐다. 사용자가 진술한 AniList 로컬 테스트 저장 허가 metadata를 Source Registry에 기록하되 실제 전체 네트워크 실행과 production 승격은 이번 승인에 포함하지 않는다.

## 1. 목적

여러 출처에서 필요한 raw facts를 수집하되, MOEMOA가 자체 내부 ID·스키마·정규화·검증·변경 이력을 운영할 수 있게 한다.

핵심 원칙:

- raw source record와 public catalog record를 분리한다.
- 사실 필드와 표현물·이미지를 분리한다.
- 출처·이용조건·수집 방법을 Source Registry에서 승인한다.
- 외부 값은 스키마를 바꿨다는 이유만으로 verified가 되지 않는다.
- 태그 어휘 후보와 작품별 태그 판단을 분리한다.
- 전체 수집 전에 대표 표본으로 파이프라인을 검증한다.

## 2. 수집 대상 필드

### Anime 기본

```text
id
nativeTitle
officialEnglishTitle
localizedTitles[]
releaseYear
season
startDate
endDate
format
episodeCount
status
officialSiteUrl
officialLinks[]            // service projection 후보 목록
sourceMaterialType
```

### 조직·관계

```text
studios[]
animeRelations[]
```

### 분류

```text
coreGenres[]
catalogTags[]
```

### 인물

```text
characters[]
voiceActors[]
castings[]
```

## 3. 권장 엔터티

```text
Anime
AnimeTitle
AnimeRelation
Organization
AnimeOrganizationRole
Genre
CatalogTag
AnimeTag
Character
Person
Casting
SourceRegistry
SourceRecord
FieldClaim
CatalogRevision
PrivateTitle
LegacyIdentifier
```

## 4. Source Registry

모든 자동 수집 소스는 코드 작성 전에 Registry 항목을 가진다.

```text
sourceId
sourceName
baseUrl
sourceRole              // direct_import, official_verify, crosscheck_only, blocked
licenseOrTerms
termsUrl
allowedMethod           // api, dump, feed, crawl, manual
allowedFields
commercialUseStatus
persistentStorageStatus
redistributionStatus
rateLimit
robotsReviewedAt
termsReviewedAt
reviewedBy
status                  // approved, pending, blocked
notes
```

### 소스 역할

- `direct_import`: 명시적 재사용 범위 안에서 raw 적재 가능.
- `official_verify`: 공식 사이트의 사실 확인. 소개문·이미지 복사와 분리.
- `crosscheck_only`: 누락·오류·후보 발견. 프로덕션 값 자동 승격 금지.
- `blocked`: 자동 접근 또는 재사용 금지·불명확.

## 5. 파이프라인 단계

```text
Source fetch
→ Raw immutable staging
→ Parse
→ Normalize
→ Entity resolution / deduplication
→ Field claims
→ Conflict detection
→ Automated validation
→ Human review where required
→ Publish catalog revision
→ Incremental refresh
→ Audit and rollback
```

### 5.1 Raw staging

- 소스 원문/응답의 최소 필요 부분과 fetch metadata를 보존한다.
- public schema로 바로 overwrite하지 않는다.
- source record ID와 retrieval time을 기록한다.
- 재현 가능한 parser version을 기록한다.

### 5.2 Normalize

- 문자열 trim/Unicode normalization
- 날짜 표준화
- format/status mapping
- 조직·인물 이름 alias 처리
- locale별 title 구분
- null과 zero 구분

### 5.3 Entity resolution

작품 중복 판별 후보:

- native title
- release year
- format
- official site/domain
- source identifiers
- sequel/relation context
- studio and start date

자동 병합은 높은 신뢰도에서만 허용하고, 애매한 경우 review queue로 보낸다.

### 5.4 Field claims

한 필드에 여러 출처의 값이 있을 수 있다.

기존 3,998개 `aliases.json` row의 `ko`는 고유한 AniList ID와 같이 검증될 때 로컬 테스트 canonical의 기본 한국어 제목 claim으로 보존한다. 같은 row의 나머지 `aliases`는 검색·매칭에 사용하지만 제목 claim으로 자동 승격하지 않는다. Wikidata·기타 출처의 한국어 제목은 교차검증·보완 후보로 별도 출처를 유지한다.

```text
FieldClaim
- entityType
- entityId
- fieldName
- normalizedValue
- sourceId
- sourceRecordId
- confidence
- status
- retrievedAt
- verifiedAt
- verifiedBy
```

상태:

```text
RAW
NORMALIZED
PENDING_REVIEW
VERIFIED
PUBLISHED
CONFLICTED
DEPRECATED
```

### 5.5 Publish

- public record는 승인된 FieldClaim으로 구성한다.
- 값 변경은 CatalogRevision에 남긴다.
- 이전 값을 복구할 수 있어야 한다.

### 5.6 Service projection

`CanonicalAnime`은 출처별 증거와 충돌을 보존하는 내부 기록이다. 실제 서비스 검색·표시에 쓰는 값은 별도 `ServiceProjection`으로 파생한다. 이 층은 canonical 증거를 삭제하거나 고치지 않는다.

한국어 제목 정책:

- 승인된 `legacy_aliases` row의 유일한 `ko` 제목을 대표 한국어 제목으로 사용한다.
- AniList·Wikidata 등에서 얻은 추가 한국어 제목은 NFKC·기호·공백을 정규화해 비교한다. 최소 길이와 유사도 기준을 만족하면 검색 별칭으로 자동 허용한다.
- 낮은 신뢰도 후보는 provenance를 유지하되 자동 검색·표시에서 격리하며, 수동 검토가 아닌 `KOREAN_TITLE_CANDIDATES_QUARANTINED` warning으로 집계한다.
- 불완전 legacy 제목은 닫히지 않은 괄호, 값 형태 이상, 짧은 조사형 제목과 충분히 긴 대체 제목의 조합, known anomaly로 감지한다. 사용 가능한 영문·로마자·일문 제목이 있으면 자동 fallback하고 warning을 남긴다.
- fallback도 만들 수 없어 REQUIRED 대표 제목이 비는 경우에만 수동 검토 대상으로 남긴다.

공식 링크 정책:

- `officialSiteUrl` claim의 단일 값·충돌 값에서 정규화된 `officialLinks[]` 후보를 파생한다.
- 같은 host/path의 HTTP·HTTPS 변형은 HTTPS를 우선하고, 같은 host에서 `/en`, `/ja` 같은 locale 경로만 다른 경우 하나의 동등 후보군으로 본다.
- 서로 다른 host 또는 path도 HTTPS, 비스트리밍·비배급 보조 사이트, 작품명과 일치하는 host, locale, 작품 전용 path 순으로 대표 링크를 결정론적으로 선택한다.
- 선택되지 않은 후보는 보조 링크로 보존하고 자동 선택 warning만 남긴다. 공식 링크 후보 때문에 수동 검토 큐를 만들지 않는다.
- 보고서에는 URL 원문 대신 후보 수와 자동 선택 상태만 기록한다.

서비스 완성도 등급:

```text
REQUIRED    externalIds, preferredTitle, format, status, cover
RECOMMENDED episodeCount, sourceMaterialType, studios, sourceGenres
OPTIONAL    officialLinks, coreGenres, characters, castings, relations,
            season, startDate, endDate
```

- REQUIRED 누락은 `BLOCKED`다.
- 검토 항목이 있으면 `READY_WITH_REVIEW`다.
- REQUIRED는 충족했지만 RECOMMENDED가 비면 `READY_WITH_GAPS`다.
- OPTIONAL 누락만으로 서비스 gate를 실패시키지 않는다.
- 구조·해시·표지 무결성 gate와 서비스 완성도 gate를 함께 보고하되 의미를 구분한다.

## 6. 정규화 규칙

### 6.1 Format

권장 enum:

```text
TV
MOVIE
OVA
ONA
SPECIAL
MUSIC
WEB_SHORT
OTHER
UNKNOWN
```

외부 `TVA`, `TV Series`, `Web` 등은 raw 값을 보존하고 enum에 매핑한다.

### 6.2 Status

```text
ANNOUNCED
UPCOMING
AIRING
FINISHED
PAUSED
CANCELLED
UNKNOWN
```

미정 화수는 `null`이다. `0`으로 대체하지 않는다.

### 6.3 Season

- `WINTER / SPRING / SUMMER / FALL`
- 국가별 방송 분기와 일본 애니 분기 기준을 혼동하지 않는다.
- 날짜로 계산한 분기와 출처 표기를 구분할 수 있다.

### 6.4 작품 단위

명시해야 할 사례:

- 시즌 1·2
- 분할 2쿨
- TV와 감독판
- TV와 총집편 영화
- OVA·Special
- Web 선행 공개와 TV 방영
- 리메이크
- 같은 세계관의 독립 작품

### 6.5 Relation

```text
SEQUEL
PREQUEL
SIDE_STORY
SPIN_OFF
ADAPTATION
REMAKE
RECAP
ALTERNATIVE_VERSION
SHARED_UNIVERSE
CHARACTER_CROSSOVER
OTHER
```

관계는 directed edge로 저장하고, reciprocal edge 생성 규칙을 명시한다.

### 6.6 제작사 역할

```text
ANIMATION_PRODUCTION
CO_PRODUCTION
PRODUCTION_ASSISTANCE
PLANNING
PRODUCTION_COMMITTEE
DISTRIBUTOR
BROADCASTER
OTHER
```

### 6.7 Source material

```text
ORIGINAL
MANGA
LIGHT_NOVEL
NOVEL
WEB_NOVEL
GAME
VISUAL_NOVEL
WEBTOON
OTHER
MIXED
UNKNOWN
```

### 6.8 Characters and casting

```text
Character
- canonicalName
- localizedNames

Person
- canonicalName
- localizedNames

Casting
- animeId
- characterId
- personId
- language
- roleType
- creditedName
- verificationStatus
```

같은 캐릭터의 시즌별 성우 변경과 다국어 더빙을 구분한다.

## 7. 태그 체계

### 7.1 Core Genre

작은 고정 목록을 MOEMOA가 관리한다.

예:

```text
Action, Adventure, Comedy, Drama, Fantasy, Horror,
Mystery, Romance, Sci-Fi, Slice of Life, Sports,
Supernatural, Thriller
```

### 7.2 Catalog Tag

설정·주제·서사 속성.

```text
Setting: School, Historical, Space
Theme: Coming of Age, Revenge, Found Family
Narrative: Time Travel, Reincarnation, Body Swap
```

### 7.3 Memory Tag

사용자 개인 기억 태그.

```text
Comforting, Bittersweet, Made Me Cry, Quiet, Rewatch
```

### 7.4 외부 태그 처리

```text
external raw tag
→ TagCandidate
→ canonical mapping 제안
→ 관리자 승인
→ AnimeTag
```

외부 설명문, 가중치, 스포일러 판정은 자동 복제하지 않는다.

## 8. Legacy data

- 삭제하지 않는다.
- `legacy_unverified`로 격리한다.
- title matching, duplicate candidate, user search fallback에만 사용한다.
- public verified catalog로 자동 승격하지 않는다.
- migration은 source/provenance와 rollback을 포함한다.

## 9. PrivateTitle → public catalog 승격

```text
PrivateTitle 생성
→ 동일·유사 요청 집계
→ candidate 생성
→ 중복 검색
→ source claims 추가
→ 관리자 검토
→ public Anime 생성/병합
→ 기존 MemoryCard 연결 재지정
```

사용자의 원본 입력과 개인 alias는 손실하지 않는다.

## 10. 첫 표본 파이프라인

전체 수집 전에 다음 사례를 포함한 작은 표본을 사용한다.

- 다가오는 분기 신작
- 최근 인기 TV 시리즈
- 시즌·분할 2쿨
- Movie·OVA·ONA·Special
- 리메이크·총집편
- 다국어 제목 충돌
- 복수 제작사
- 다국어 성우
- 관계가 복잡한 프랜차이즈

표본 규모는 저장소와 소스 상황에 따라 정하되, 모든 정규화 예외를 포함하는 것이 목적이다.

## 11. 멱등성·오류·재시도

- 같은 source record를 재수집해도 중복 entity를 만들지 않는다.
- parser version 변경을 추적한다.
- 부분 실패를 전체 성공으로 표시하지 않는다.
- rate limit과 backoff를 적용한다.
- source unavailable 시 기존 published 값은 유지한다.
- conflict 자동 overwrite를 금지한다.
- `catalog:rebuild --profile golden|sample100|full3998`은 저장된 SourceRecord와 CoverRecord만 사용하며 네트워크를 호출하지 않는다.
- offline rebuild는 모든 대상을 먼저 검증한 뒤 canonical pointer를 전환하고, 같은 입력을 반복했을 때 raw·image·claim·canonical 중복 성장이 없어야 한다.

### 11.1 full3998 batch 실행 계약

- `full3998` manifest는 기존 `aliases.json` 3,998개 row의 순서와 고유 AniList ID를 그대로 고정한다.
- 전체 profile 승인 수와 현재 batch 수를 분리해 검증한다. 100개 제한 source를 100개씩 반복 호출하는 방식으로 전체 범위를 우회할 수 없다.
- 사용자 진술 기반 로컬 테스트 전체 저장 허가가 Registry에 기록된 AniList만 `LOCAL_TEST_FULL_ROSTER_BATCHED` scope를 사용할 수 있다.
- 각 batch는 최대 100개이며 실제 작업이 있었던 batch 사이에는 매번 120~200초 범위의 랜덤 휴식을 둔다. AniList 요청 시작 간격도 매번 2.5~10초 범위에서 새로 선택하고, 더 낮은 server limit 또는 reset header가 요구하는 더 느린 하한은 우선 적용한다.
- CLI의 기본 범위는 120~200초이며 필요할 때만 `--pause-min-seconds`와 `--pause-max-seconds`로 안전 범위 안에서 함께 조정한다. 이전 고정값 `--pause-seconds` 옵션은 오해를 막기 위해 허용하지 않는다.
- `429`는 `Retry-After`를 따르고 `401/403` 또는 `SOURCE_PAUSED`는 다음 batch를 차단한다.
- batch 완료 직후 누적 target/canonical/cover/source-state/growth snapshot을 외부 TEST_ONLY workspace에 기록한다.
- 기본 재실행은 `COMPLETED` source-target과 저장된 cover를 재사용한다. `full3998 --refresh`는 우발적 전체 재수집을 막기 위해 허용하지 않는다.
- 전체 결과, raw payload, 표지는 Git·build·Vercel·APK에 포함하지 않는다.

## 12. 데이터 품질 지표

- 필수 필드 완성률
- source coverage
- conflict rate
- duplicate candidate rate
- manual review backlog
- stale record count
- import failure rate
- source별 오류율
- PrivateTitle 검색 실패·승격 수
- service readiness 상태별 수량
- 격리된 한국어 제목 후보 수
- 공식 링크 후보 및 검토 대기 수
- REQUIRED/RECOMMENDED/OPTIONAL 등급별 누락 수

## 13. 관리자 기능 최소 범위

- source record 확인
- field claim 비교
- 승인·반려
- 작품·조직·인물 병합
- relation 편집
- tag mapping
- revision history
- CSV/JSON import preview
- rollback

## 14. 완료 조건

- Source Registry가 구현되어 승인되지 않은 소스가 실행되지 않는다.
- 표본 수집이 재실행 가능하고 멱등적이다.
- raw와 published 데이터가 분리된다.
- 필드별 출처가 추적된다.
- conflict가 자동으로 사라지지 않는다.
- legacy data가 안전하게 격리된다.
- PrivateTitle이 카탈로그 부족을 우회한다.
- 전체 수집 전 사용자 승인 게이트가 있다.
