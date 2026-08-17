# AniList·Wikidata·AniLife 로컬 카탈로그 랩 디자인 명세

> **문서 상태: `APPROVED DESIGN — IMPLEMENTATION GATED`**
> 승인일: 2026-08-17
> 승인자: 사용자
> 적용 범위: 기존 3,998개 작품 목록을 출발점으로 하는 로컬 전용 카탈로그 수집·검증 파이프라인
> 실행 계획: `../../moemoa/plans/2026-08-17-three-source-local-catalog-lab.md`
> 전체 수집 상태: `FULL-CATALOG-INGESTION-GATE-01` 미통과

## 1. 결정 요약

MOEMOA의 기존 3,998개 별칭 목록을 우선 수집 대상 명단으로 사용하고, AniList API·Wikidata·AniLife 공개 페이지에서 얻을 수 있는 후보 데이터를 출처별 원본으로 분리해 수집한다. 각 출처의 값을 곧바로 정식 카탈로그로 덮어쓰지 않고 `SourceRecord → FieldClaim → CanonicalAnime` 흐름으로 정규화·충돌 검증한다.

반복 네트워크 수집은 결정론적인 로컬 수집기가 담당한다. 저비용 언어 모델은 자동 규칙으로 해결되지 않은 제목·작품 매칭 후보를 제한된 묶음으로 검토할 뿐, 웹 수집·이미지 다운로드·정식 발행을 수행하지 않는다.

첫 실행 범위는 다음과 같다.

```text
세 출처 기술 조사
→ 골든 샘플 10개
→ 대표 표본 100개 전체 파이프라인
→ 반복 실행·장애·이미지 무결성 검증
→ Web 내부 테스트에서 조회
→ Source Registry와 전체 수집 게이트 재검토
→ 별도 승인 후에만 3,998개 로컬 수집
```

## 2. 기존 결정과의 관계

이 설계는 다음 확정 결정을 변경하지 않는다.

- MOEMOA는 AniList와 경쟁하는 일반 목록·평점 서비스가 아니라 이미지 중심 개인 기억 아카이브다.
- 자체 `Anime` ID를 사용하며 AniList ID를 canonical primary key로 승격하지 않는다.
- 기존 `src/data/aliases.json`은 `legacy_unverified` 상태를 유지한다.
- 수집 원본, 정규화 후보, 발행 가능한 카탈로그를 분리한다.
- 전체 수집 전에 Source Registry, 표본 검증, 멱등성, 오류 복구, 품질 보고가 필요하다.
- 실제 표지 이미지는 로컬 테스트에서만 사용하고 Git·Vercel·APK·테스터에게 배포하지 않는다.
- 카탈로그 표지는 사용자 Memory Card의 `VisualAsset`과 별개다.

이 문서의 승인으로 프로덕션 재사용 권리, AniList의 서비스 사용 허가, AniLife 이미지 배포 권한, 전체 3,998개 수집이 승인되는 것은 아니다.

## 3. 목표와 제외 범위

### 목표

- 실제 프로덕션에서 사용할 논리 데이터 계약과 동일한 로컬 테스트 데이터를 만든다.
- 작품별로 제목, 형식, 방영 정보, 화수, 상태, 원작 유형, 제작사, 공식 사이트, 장르, 관계 작품, 캐릭터, 일본어 성우, 메인 표지 후보를 수집한다.
- 모든 값에서 원본 출처와 수집 시점까지 추적할 수 있게 한다.
- 중간 중단 후 재개, 같은 입력의 안전한 재실행, 출처별 장애 격리를 보장한다.
- Web UI가 외부 provider 응답 대신 canonical catalog port를 통해 표본 데이터를 읽을 수 있게 준비한다.

### 제외

- 프로덕션 카탈로그 발행과 Vercel 배포.
- 이미지의 Git 커밋, 클라우드 업로드, APK 포함, 테스터 전달.
- AniLife 내부 `/api/` 호출, 영상·재생 URL·댓글·에피소드 스트림 수집.
- 배너, 캐릭터 이미지, 성우 이미지 수집.
- 저비용 모델을 이용한 무제한 반복 작업 또는 자동 발행.
- Public UGC, Memory Card 이미지 정책, 사용자 이미지 저장 방식 변경.
- 전체 3,998개 수집의 암묵적 승인.

## 4. 출처 조사 결과와 역할

### 4.1 기존 3,998개 목록

`src/data/aliases.json`은 감사 시점 기준 3,998개의 고유 AniList ID와 `ko`, `aliases`를 가진다. 모든 row의 AniList ID가 고유하고 한국어 제목이 하나이므로, `ko`는 ID에 구속된 **로컬 테스트 기본 한국어 제목**으로 canonical에 보존한다. `aliases`는 검색·매칭 seed로만 사용한다. 이 결정은 출처·수집 시각·parser version이 없는 legacy 자료의 프로덕션 재배포나 자동 게시까지 승인하지 않는다.

```text
역할: target roster + TEST_ONLY Korean title baseline + legacy matching seed
자동 발행: 금지
보존 상태: LEGACY_UNVERIFIED
```

목록 밖 작품은 사용자 검색·요청 또는 누락 발견 시 별도 target으로 추가할 수 있지만, 기존 3,998개와 같은 검증 절차를 거친다.

### 4.2 AniList API

실제 GraphQL 응답과 공식 문서에서 다음 후보 필드를 확인했다.

- AniList/MAL 식별자
- romaji, English, native title과 synonyms
- format, status, 시작·종료일, season, season year, episode count, duration, source material
- genres
- 메인 제작사
- 관계 작품과 relation type
- MAIN/SUPPORTING 캐릭터와 일본어 성우
- 공식 사이트를 포함한 external links
- cover image URL

캐릭터·성우 connection은 페이지 단위로 조회한다. 필요한 필드 정의는 [AniList Media](https://docs.anilist.co/reference/object/media), pagination 계약은 [AniList Connections](https://docs.anilist.co/guide/graphql/connections)을 따른다.

AniList 약관은 API를 백업·데이터 저장 수단으로 이용하거나 대량 보관하는 행위와 일부 목록·트래커 성격 서비스 사용을 제한한다. 따라서 AniList는 이 설계에서 **로컬 기술 표본의 구조화 후보 출처**로만 승인한다. 전체 3,998개 수집과 프로덕션 발행은 별도 서면 허가 또는 허용되는 대체 출처가 필요하다. [AniList API Terms](https://docs.anilist.co/guide/terms-of-use)

```text
sourceRole: crosscheck_only
executionScope: LOCAL_TEST_MAX_100
catalogPromotion: PROHIBITED
imageRedistribution: PROHIBITED
```

### 4.3 Wikidata

Wikidata의 AniList ID 속성 `P8729`로 기존 AniList ID를 Wikidata entity에 연결할 수 있다. entity의 다국어 label, aliases, claims, sitelinks를 이용해 제목·공식 식별자·일부 관계와 사이트 정보를 교차검증한다.

Wikidata structured data는 CC0다. 알려진 QID는 `wbgetentities`로 묶어서 조회하고, WDQS는 `P8729` 매핑이나 관계 후보 탐색에 제한한다. fuzzy title search나 전체 dump처럼 사용하지 않는다. [Wikidata Data access](https://www.wikidata.org/wiki/Wikidata:Data_access), [Wikidata Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)

```text
sourceRole: direct_import
executionScope: LOCAL_SAMPLE; 전체 범위는 FULL-CATALOG gate에서 재승인
catalogPromotion: 출처·필드 검증 후 허용
imageCollection: OFF
```

### 4.4 AniLife 공개 페이지

`https://anilife1.tv/sitemap.xml`에는 조사 시점 약 6,847개의 `/content/{id}` 페이지가 있었다. 공개 HTML의 OpenGraph와 JSON-LD에서 제목, 원제/대체 제목, 설명, 표지 URL, 연도, 화수 후보를 확인했다.

`robots.txt`는 `/api/` 접근을 금지하며 내부 API는 공식 공개 계약이 아니다. 수집기는 공개 sitemap과 raw content HTML에 포함된 JSON-LD/OpenGraph만 읽는다. 화면 렌더링을 통해 내부 API를 우회 호출하지 않는다. [AniLife robots.txt](https://anilife1.tv/robots.txt), [AniLife sitemap](https://anilife1.tv/sitemap.xml)

```text
sourceRole: crosscheck_only
allowedMethod: public sitemap + public content HTML
executionScope: LOCAL_TEST_MAX_100
catalogPromotion: PROHIBITED
imageRedistribution: PROHIBITED
blockedPaths: /api/*, 영상·재생·댓글 관련 데이터
```

공개 페이지에 이미지가 있다는 사실은 저장·재배포 권리를 의미하지 않는다. AniLife 표지는 로컬 테스트 후보로만 저장한다.

## 5. Source Registry 실행 규칙

Registry는 `status` 외에 실제 실행 범위를 강제하는 다음 필드를 가진다.

```text
sourceId
sourceName
baseUrl
sourceRole
status
executionScope
allowedMethod
allowedPaths
blockedPaths
allowedFields
catalogPromotion
commercialUseStatus
persistentStorageStatus
redistributionStatus
rateLimit
robotsReviewedAt
termsReviewedAt
evidenceUrls[]
reviewedBy
notes
```

수집기는 Registry에 없는 출처, `status=blocked`인 출처, 현재 target 수가 `executionScope`를 넘는 출처를 실행하지 않는다. `catalogPromotion=PROHIBITED` claim은 테스트 canonical snapshot에는 포함될 수 있지만 프로덕션 publish adapter가 읽을 수 없다.

초기 Registry 상태는 다음과 같다.

| 출처 | 로컬 100개 표본 | 전체 3,998개 | 프로덕션 발행 |
| --- | --- | --- | --- |
| 기존 aliases | 승인 | target roster로만 승인 | 금지 |
| AniList | 기술 표본 승인 | 보류 | 금지 |
| Wikidata | 승인 | 전체 gate에서 재확인 | 검증된 CC0 필드만 후보 |
| AniLife 공개 페이지 | 기술 표본 승인 | 보류 | 금지 |

## 6. 수집기 아키텍처

수집기는 Web/Android runtime과 분리한 Node 기반 로컬 도구로 만든다. 구현 위치의 기준안은 다음과 같다.

```text
tools/catalog-lab/
├─ cli.mjs
├─ config/
├─ contracts/
├─ sources/
│  ├─ aliases-seed.mjs
│  ├─ anilist-test.mjs
│  ├─ wikidata.mjs
│  └─ anilife-public-page-test.mjs
├─ pipeline/
│  ├─ load-targets.mjs
│  ├─ fetch-source.mjs
│  ├─ normalize.mjs
│  ├─ resolve-entities.mjs
│  ├─ build-claims.mjs
│  ├─ download-covers.mjs
│  ├─ validate.mjs
│  └─ publish-local-snapshot.mjs
├─ review/
├─ reports/
└─ test-fixtures/
```

각 모듈은 한 가지 역할만 가진다.

- source adapter: 외부 응답을 raw record로 저장한다.
- normalizer: source별 raw 값을 공통 후보 형식으로 바꾼다.
- resolver: target과 source entity의 동일성만 판단한다.
- claim builder: 필드별 출처 후보를 만든다.
- canonical builder: 승인 규칙에 따라 테스트 snapshot을 조립한다.
- image downloader: canonical 값과 분리해 표지 파일만 검증·저장한다.
- validator: 스키마, provenance, 관계, 이미지, 멱등성을 확인한다.
- reporter: 누락, 충돌, 실패, 출처 coverage를 사람이 읽을 수 있게 출력한다.

기존 `src/lib/anilist.js`, `src/lib/wikidata.js`는 브라우저 runtime 코드이므로 수집기가 직접 재사용하지 않는다. 필요한 query 의미는 참고할 수 있지만 수집 전용 adapter와 contract를 별도로 둔다.

## 7. 로컬 저장 경계

실제 수집 데이터는 환경 변수 `MOEMOA_CATALOG_LAB_DIR`로 지정한 저장소 밖 절대 경로에만 저장한다. 예시는 `D:\moemoa-catalog-lab-data`이며 코드에 고정하지 않는다.

```text
<MOEMOA_CATALOG_LAB_DIR>/
├─ TEST_ONLY.json
├─ registry/
├─ targets/
├─ raw/<source>/<targetKey>/
├─ normalized/<source>/<targetKey>/
├─ claims/
├─ canonical/
├─ images/covers/<animeId>/
├─ state/<source>/<targetKey>.json
└─ reports/
```

안전 조건:

- 경로가 Git worktree 내부이면 실행을 거부한다.
- `TEST_ONLY.json` sentinel이 없으면 다운로드·publish 단계를 실행하지 않는다.
- 실제 payload와 cover는 Git ignore에 기대지 않고 처음부터 저장소 밖에 둔다.
- test fixture에는 합성 데이터 또는 재배포 가능한 최소 구조만 사용한다.
- Web production build는 이 경로를 import하거나 정적 asset으로 복사하지 않는다.
- 수집 결과를 APK, Vercel, CI artifact, 테스트 보고서 attachment에 포함하지 않는다.

## 8. 논리 데이터 계약

### 8.1 TargetRecord

```text
targetKey
moemoaAnimeId
seedSource
seedExternalIds[]
seedTitles[]
targetStatus
createdAt
```

`moemoaAnimeId`는 최초 target 등록 때 생성해 mapping에 보존한다. AniList ID에서 계산하지 않으며 source ID가 바뀌어도 유지한다.

### 8.2 SourceRecord

```text
sourceRecordId
targetKey
sourceId
sourceEntityId
fetchStatus
fetchedAt
requestFingerprint
responseStatus
payloadHash
parserVersion
rawPayloadRef
```

raw payload는 immutable이다. 같은 source entity의 응답이 바뀌면 기존 파일을 덮어쓰지 않고 새 fetch revision을 만든다.

`legacy_aliases` 한국어 기본 제목은 네트워크 fetch가 아니므로 별도 raw payload를 만들지 않는다. 대신 검증된 TargetRecord의 `targetKey + AniList ID + ko + source path`를 해싱한 결정적 evidence ID를 FieldClaim의 `sourceRecordId`로 사용한다. canonical 인증 시에는 저장된 claim을 신뢰하지 않고 TargetRecord에서 같은 claim을 재생성해 비교한다.

### 8.3 FieldClaim

```text
claimId
entityType
entityId
fieldPath
rawValue
normalizedValue
sourceId
sourceRecordId
ruleId
confidenceClass
status
retrievedAt
reviewedAt
reviewedBy
```

`confidenceClass`는 `EXACT_ID`, `EXACT_RULE`, `REVIEWED`, `AMBIGUOUS` 중 하나다. 임의의 소수점 점수만으로 병합하지 않는다.

### 8.4 CanonicalAnime

```text
id
externalIds[]
titles[]
format
status
season
startDate
endDate
episodeCount
sourceMaterialType
officialSiteUrl
studios[]
relations[]
sourceGenres[]
coreGenres[]
characters[]
castings[]
cover
fieldProvenance
reviewState
revision
```

`characters`는 MAIN/SUPPORTING만 포함하고 `castings`는 원본 일본어 성우만 포함한다. `sourceGenres`는 출처별 원문을 보존하고, `coreGenres`는 별도 승인된 12~15개 MOEMOA 어휘로 매핑한다.

모든 필드는 다음 상태 중 하나를 가져야 한다.

```text
VALUE
SOURCE_NOT_AVAILABLE
NOT_FETCHED
CONFLICTED
```

`null`만으로 미정·누락·실패를 함께 표현하지 않는다.

## 9. 데이터 흐름과 우선순위

```text
aliases 3,998 target roster
→ AniList ID에 구속된 legacy `ko`를 TEST_ONLY 기본 제목 claim으로 보존
→ source별 immutable fetch
→ source별 normalize
→ exact identity resolution
→ field claims 생성
→ conflict detection
→ local test canonical 조립
→ cover 후보 다운로드·검증
→ schema/quality validation
→ Web용 read-only sample adapter
```

필드 처리 원칙:

1. 기존 AniList ID는 legacy `ko`를 정확한 작품에 구속하고, AniList fetch와 Wikidata `P8729` 연결에 사용한다.
2. ID와 유일하게 결합된 legacy `ko`는 TEST_ONLY canonical의 기본 한국어 제목으로 보존하고, legacy `aliases`는 자동 승격하지 않는다.
3. AniList 값은 테스트 canonical의 구조 검증에 사용할 수 있지만 production promotion은 금지한다.
4. Wikidata 값은 CC0 source claim으로 독립 보관한다.
5. Wikidata·AniLife의 한국어 제목은 legacy 기본값의 교차검증·보완 후보로 보존한다.
6. 출처 충돌 시 priority로 조용히 덮어쓰지 않고 `CONFLICTED` claim을 만든다.
7. 값이 없는 필드는 추측하지 않고 누락 상태와 확인한 출처를 기록한다.

## 10. 작품 자동 매칭 규칙

### AniList

- target의 legacy AniList ID와 응답 ID가 같을 때만 `EXACT_ID`로 연결한다.
- GraphQL 검색 결과의 제목 유사도만으로 target을 교체하지 않는다.

### Wikidata

- Wikidata `P8729` 값이 target AniList ID와 같을 때만 `EXACT_ID`로 연결한다.
- title search 결과는 후보 발견에만 사용하고 자동 병합하지 않는다.

### AniLife

다음 중 하나만 자동 연결한다.

- 정규화된 제목 또는 seed alias가 정확히 일치하고 방영 연도도 일치한다.
- 제목이 정확히 일치하며 후보가 하나뿐이고 화수도 일치한다.

다음은 `PENDING_REVIEW`로 보낸다.

- 제목은 비슷하지만 정확히 일치하지 않는다.
- 리메이크, 총집편, 극장판, 분할 cour, 시즌 번호가 충돌한다.
- 연도 또는 화수가 서로 다르다.
- 같은 제목의 후보가 둘 이상이다.

자동 연결 규칙은 rule ID와 비교 근거를 남긴다. 사람이나 모델의 검토도 기존 raw 근거를 변경하지 않는다.

## 11. 표지 이미지 처리

표지는 애니당 하나의 메인 cover만 선택한다. 우선순위는 고정된 provider 순서가 아니라 **정확히 매칭되고 파일 검증을 통과한 허용 범위의 후보**다. 현재 AniList와 AniLife 후보는 모두 로컬 테스트 전용이다.

```text
cover
- localRef
- sourceId
- sourceUrl
- sourceRecordId
- retrievedAt
- mimeType
- extension
- byteSize
- width
- height
- checksum
- validationStatus
- rightsStatus: TEST_ONLY_UNKNOWN
- distributionStatus: PROHIBITED
```

검증 규칙:

- HTTP 성공 응답만 받는다.
- 파일 signature와 MIME이 일치해야 한다.
- JPEG, PNG, WebP만 허용한다.
- 정상적으로 decode할 수 있어야 한다.
- checksum으로 동일 파일을 중복 저장하지 않는다.
- 지나치게 작은 크기나 비정상 비율은 자동 폐기 대신 warning으로 기록한다.
- 실패한 cover가 있어도 텍스트 catalog record는 보존한다.
- 사용자 Memory Card 이미지와 같은 폴더·엔터티·수명주기를 사용하지 않는다.

## 12. 실행 상태와 멱등성

각 `targetKey + sourceId`는 다음 상태를 가진다.

```text
PENDING
FETCHED
NORMALIZED
MATCHED
CLAIMS_BUILT
IMAGE_VALIDATED
VALIDATED
COMPLETED
FAILED_RETRYABLE
FAILED_PERMANENT
PENDING_REVIEW
SOURCE_PAUSED
```

- 상태 파일은 임시 파일에 쓴 뒤 원자적으로 교체한다.
- 완료한 단계는 같은 input hash와 parser version에서 다시 실행하지 않는다.
- `--refresh`도 기존 raw를 덮어쓰지 않고 새 revision을 만든다.
- source adapter는 네트워크 I/O만 담당하고 canonical 파일을 직접 수정하지 않는다.
- canonical snapshot은 검증된 claims를 정렬한 입력으로 매번 결정론적으로 다시 생성한다.
- 두 번째 동일 실행에서 entity, claim, image copy가 늘어나면 실패다.

## 13. 오류·재시도 정책

| 오류 | 처리 |
| --- | --- |
| timeout, connection reset, 일시적 DNS, 5xx | 지수 backoff와 jitter, 최대 4회 |
| 429 | `Retry-After` 우선, 최대 5회 |
| 404 또는 source entity 없음 | 재시도 없이 `SOURCE_NOT_FOUND` |
| 401, 403 | source 전체 `SOURCE_PAUSED` |
| 필수 응답 구조 변경 | source 전체 `SOURCE_PAUSED`와 schema drift 보고 |
| 단일 레코드 parse 실패 | raw 보존, 해당 record만 `FAILED_PERMANENT` |
| identity 또는 field conflict | `PENDING_REVIEW`, 자동 overwrite 금지 |
| image timeout/5xx | 최대 3회 |
| image MIME/signature/decode 불일치 | `IMAGE_INVALID`, 텍스트 record 유지 |

부분 실패를 전체 성공으로 표시하지 않는다. 한 출처가 멈춰도 다른 출처와 기존 canonical snapshot은 보존한다. 재시도 횟수를 모두 사용한 record는 사람이 원인을 확인하기 전 무한 반복하지 않는다.

## 14. 품질 게이트

### 14.1 골든 샘플 10개

다음 예외를 포함해 기존 3,998개 안에서 고정한다.

- TV, Movie, OVA/ONA/Special
- 시즌 번호와 분할 cour
- 리메이크 또는 총집편
- 다국어 제목 충돌
- 복수 제작사
- MAIN/SUPPORTING 캐릭터와 일본어 성우
- 관계가 복잡한 프랜차이즈

통과 조건:

- 원문과 비교한 작품 오연결 0건.
- 필드 provenance 누락 0건.
- conflict의 무단 overwrite 0건.
- 다운로드된 cover의 출처·checksum 누락 0건.
- 사람이 확인한 필드와 canonical 값의 설명되지 않은 차이 0건.

### 14.2 대표 표본 100개

통과 조건:

- schema validation 100%.
- 모든 필드가 값 또는 명시적 상태를 가짐.
- source record와 field provenance 추적률 100%.
- 검토한 범위의 자동 매칭 오탐 0건.
- 다운로드된 이미지의 signature·decode·checksum 검증 100%.
- 같은 입력의 두 번째 실행에서 신규 entity·claim·image 중복 0건.
- 모든 실패가 정의된 error class로 분류됨.
- 한 source 중단 후에도 다른 source 결과와 이전 snapshot이 유지됨.
- Web read adapter가 외부 네트워크 없이 100개 표본을 검색·조회할 수 있음.

공식 사이트나 화수처럼 원래 없거나 미정일 수 있는 필드의 `VALUE` 비율은 합격 조건이 아니다. 대신 `SOURCE_NOT_AVAILABLE`, `NOT_FETCHED`, `CONFLICTED`를 포함한 coverage 보고서를 낸다.

### 14.3 전체 3,998개 실행 전 게이트

다음 조건을 모두 통과해야 한다.

- Source Registry에서 해당 규모와 방식이 승인됨.
- AniList와 AniLife는 서면 허가 또는 허용 가능한 대체 출처 결정이 있음.
- 골든 10개와 대표 100개 품질 게이트 통과.
- retry, schema drift, 중단·재개, rollback 모의 테스트 통과.
- 로컬 저장 공간 예상치와 삭제 절차 확인.
- 전체 실행 report 형식과 사람이 처리할 review backlog 상한 설정.
- 사용자의 별도 전체 수집 승인.

## 15. 저비용 모델 검토 계약

저비용 모델은 필수가 아니라 선택 가능한 `ReviewAdvisor` adapter다. 기본 파이프라인은 모델 없이 완료될 수 있어야 한다.

입력:

- 한 번에 20~50개의 `PENDING_REVIEW` 항목.
- 정규화된 제목, 연도, 형식, 화수, relation context.
- 각 후보의 source ID와 source record reference.
- 원문 전체나 이미지 bytes 대신 필요한 최소 증거.

출력:

```text
targetKey
candidateId
decision: MATCH | NO_MATCH | NEEDS_HUMAN
ruleEvidence[]
reasonCode
```

제한:

- 모델이 직접 네트워크 요청이나 이미지 다운로드를 하지 않는다.
- 모델이 코드, Registry, raw record, canonical snapshot을 직접 수정하지 않는다.
- 결과는 JSON contract 검증 후 `advisor suggestion`으로만 저장한다.
- 두 번의 검토에도 불확실하면 `NEEDS_HUMAN`으로 종료한다.
- 모델 판단만으로 production publish 상태를 만들지 않는다.
- API key, 원본 응답, 자유 형식 사용자 데이터는 로그에 남기지 않는다.

현재 Codex 작업 환경에서 반복 검토를 별도 작업으로 실행할 경우 사용 가능한 저비용 선택지는 `gpt-5.6-terra`다. 향후 별도 OpenAI API runner가 필요하고 계정에서 지원한다면 비용 민감형 모델로 adapter를 교체할 수 있다. 모델 선택은 수집기 코드와 분리한다. [OpenAI Models](https://developers.openai.com/api/docs/models)

## 16. 검증 전략

### Unit

- title Unicode normalization.
- enum mapping과 null/status 구분.
- source response parser fixture.
- exact identity rule과 ambiguous rule.
- FieldClaim 생성과 conflict detection.
- image signature/MIME/checksum.
- retry class와 backoff 상한.
- path guard와 `TEST_ONLY` sentinel.

### Integration

- source adapter → raw → normalized record.
- 세 source record → claims → canonical snapshot.
- 부분 source 실패 후 snapshot 보존.
- parser version 변경 후 새 revision 생성.
- 두 번 실행한 결과의 content hash 동일.

### End-to-end

- 고정 10개 전체 수집과 사람 대조 보고서.
- 대표 100개 fetch·normalize·resolve·image·validate.
- 네트워크 없이 Web sample adapter 검색·상세 조회.
- 429, 5xx, timeout, invalid JSON-LD, image corruption 모의 실행.
- local test payload가 build output, Git staged files, APK에 포함되지 않는지 검사.

실제 외부 source contract test는 기본 unit suite와 분리하고 명시적 opt-in으로만 실행한다. CI가 대규모 수집을 자동 시작하지 않는다.

## 17. 관찰 가능성과 보고서

개별 작품 제목이나 raw payload를 일반 운영 로그에 반복 출력하지 않는다. 로컬 report는 다음 집계와 안전한 record key를 제공한다.

- source별 요청·성공·오류·retry 수.
- 단계별 완료·실패·검토 대기 수.
- 필수 필드 coverage와 누락 사유.
- conflict와 duplicate candidate 수.
- 자동 매칭 rule별 사용·오탐 수.
- 이미지 성공·중복·손상·누락 수와 총 byte size.
- parser version과 source schema drift.
- 첫 실행과 반복 실행의 output hash 비교.

로그에는 API key, 인증 header, 사용자 Memory note, 사용자 이미지 경로·bytes를 포함하지 않는다.

## 18. 롤백과 삭제

- 수집기는 기존 `aliases.json`과 runtime IndexedDB를 수정하지 않는다.
- canonical snapshot은 revision 단위로 생성하고 이전 revision을 유지한다.
- 실패한 새 revision은 current pointer를 변경하지 않는다.
- source adapter를 비활성화해도 기존 raw와 report를 자동 삭제하지 않는다.
- 로컬 테스트 데이터 삭제는 `MOEMOA_CATALOG_LAB_DIR`의 resolved absolute path와 `TEST_ONLY.json` sentinel을 확인한 별도 명령으로만 수행한다.
- 구현 롤백은 tracked collector code를 되돌리는 것이며 사용자 Memory Card나 app-private image를 삭제하지 않는다.

## 19. 구현 단계

### 단계 A — 계약과 안전 경계

- Source Registry 실물 항목.
- logical schema와 test fixtures.
- 외부 저장 경로와 `TEST_ONLY` guard.
- target roster snapshot과 내부 ID mapping.

### 단계 B — 골든 10개 수집기

- AniList test adapter.
- Wikidata adapter.
- AniLife public-page test adapter.
- raw/normalize/claim/canonical 흐름.
- cover 검증과 수동 대조 보고서.

### 단계 C — 대표 100개

- checkpoint, retry, source pause, resumability.
- conflict review queue.
- 반복 실행·장애·schema drift 검증.
- Web read-only sample adapter.

### 단계 D — Web 사용성 개발 입력

- Web 모바일·데스크톱에서 실제 표본 검색과 Card 제목 선택을 검증한다.
- catalog 사실 데이터와 사용자 Memory Card 데이터를 혼합 저장하지 않는다.
- 표지 이미지는 catalog 테스트 화면 외에 사용자 카드 자산으로 복사하지 않는다.

### 단계 E — 전체 수집 재승인

- 100개 품질 보고서와 source 권리 상태를 사용자에게 제시한다.
- `FULL-CATALOG-INGESTION-GATE-01`을 통과한 source만 전체 범위로 확장한다.
- 저비용 모델 review가 필요하면 예상 건수·비용·사람 검토량을 먼저 산정한다.

## 20. 완료 조건

이 설계의 구현은 다음이 모두 충족됐을 때 완료로 본다.

1. 실제 데이터가 repository 밖 `TEST_ONLY` workspace에만 존재한다.
2. 세 source adapter의 허용·차단 경계가 자동 검사된다.
3. raw, normalized, claim, canonical 데이터가 분리된다.
4. 자체 Anime ID와 provider external ID가 분리된다.
5. 골든 10개와 대표 100개가 정해진 품질 게이트를 통과한다.
6. 중단·재개와 동일 입력 반복 실행이 안전하다.
7. 손상·충돌·schema drift가 자동 overwrite되지 않는다.
8. Web이 외부 네트워크 없이 sample catalog를 조회할 수 있다.
9. 실제 cover가 Git·build·APK·Vercel·테스터 결과물에 포함되지 않는다.
10. 전체 3,998개 실행은 여전히 별도 사용자 승인으로 남는다.

## 21. 승인 결과

2026-08-17 사용자는 다음을 승인했다.

1. 기존 3,998개 목록을 우선 수집 target roster로 사용한다.
2. AniList, Wikidata, AniLife 공개 페이지를 분리된 source adapter로 조사·수집한다.
3. AniList와 AniLife는 로컬 100개 기술 표본과 교차검증으로 제한한다.
4. 실제 표지 이미지는 로컬 `TEST_ONLY` workspace에만 저장한다.
5. 결정론적 수집기가 반복 작업을 수행하고 저비용 모델은 예외 검토에만 사용한다.
6. 골든 10개와 대표 100개 검증을 통과하기 전 전체 3,998개 수집을 실행하지 않는다.
7. 전체 수집과 프로덕션 발행은 Source Registry·권리·품질 게이트 통과 후 별도로 승인한다.
