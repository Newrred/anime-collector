# 연도별 애니 카탈로그 증분 갱신

기존 `full3998` 카탈로그는 불변 기준선으로 유지한다. 새 작품은 `increment-YYYY-MM` 프로필에서 발견·검토·수집한 뒤 동일한 `SourceRecord → FieldClaim → CanonicalAnime → ServiceProjection` 파이프라인으로 검증한다.

## 안전 규칙

- 연도 페이지의 제목 일치는 신규/기존 작품을 구분하기 위한 후보 신호일 뿐, 자동 승인 근거가 아니다.
- 카탈로그의 주 식별자는 `anime:<UUID>` 형식의 MOEMOA 내부 ID다. AniList ID는 선택적인 외부 연결값이다.
- AniList ID가 없으면 공개 연도 목록의 AniLife content ID를 `ANILIFE:<id>` 대상 키로 사용하고 `SOURCE_REVIEWED`로 명시한다.
- AniList ID가 있으면 기존과 같이 `ANILIST:<id>`를 사용한다. 기존 `aliases.json`의 ID 및 증분 내부의 외부 ID 중복은 거부한다.
- 발견 증거는 SHA-256 주소로 고정한다. 검토 중 제목·연도·공개 URL이 발견 증거와 달라지면 manifest 생성을 거부한다.
- AniLife 내부 API, 재생·영상·댓글·계정 경로는 사용하지 않는다. 캡처와 산출물은 외부 TEST_ONLY 작업공간에만 둔다.
- AniList 자료의 Production 저장·표시·배포 승인과 AniLife 작품 정보·표지의 무제한 사용·재배포 허가가 사용자로부터 확인됐다. 다만 작품 연결과 필드·이미지 검토를 통과한 값만 Production 후보가 된다.
- 연도 페이지의 `year`는 발견 출처가 주장한 값으로만 보존하며 독립 검증된 실제 초방영 연도로 승격하지 않는다. 실제로 2026 목록에 잡힌 `25세 여고생`은 작품 공식 사이트상 2018-01-07 방영작이므로, 연도 목록만으로 2026 신작을 확정할 수 없다.

## AniLife 도메인 변경 절차

AniLife 주소는 코드가 아니라 `tools/catalog-lab/config/source-registry.json`의 `anilife_public` 항목에서 관리한다. 다음 수집 시 도메인이 바뀌었다면 `baseUrl`, `originReviewedUrl`, `termsUrl`, `robotsUrl`, `evidenceUrls`, `coverOrigins`, 검토 일자와 검토 상태를 한 변경으로 갱신하고 catalog 테스트를 통과시킨다. 페이지 URL과 이미지 URL의 origin이 다를 수 있으므로 `baseUrl`과 `coverOrigins`는 구분한다.

저장된 과거 발견·상세 증거는 당시 도메인을 포함한 해시 증거로 계속 유효하다. 새로 가져오는 연도 캡처만 현재 `baseUrl`과 일치해야 하며, HTTP·경로가 붙은 base URL·서로 맞지 않는 약관/robots origin은 거부한다. 도메인이 바뀌었다는 이유만으로 이용조건이나 이미지 재배포 권리가 승계됐다고 간주하지 않는다.

## 2026년 9월 실행 순서

외부 작업공간에 브라우저로 확인한 공개 연도 목록을 다음 위치에 둔다.

```text
<MOEMOA_CATALOG_LAB_DIR>/imports/anilife-season-2026.json
```

그다음 저장소 루트에서 실행한다.

```powershell
$env:MOEMOA_CATALOG_LAB_DIR='<외부 TEST_ONLY 작업공간의 절대 경로>'
npm run catalog:discover-year -- --year 2026 --profile increment-2026-09 --as-of 2026-09-03
```

생성된 `reviews/increment-2026-09.json`을 검토한다. 특정 작품의 AniList 연결을 확인했다면 `anilistId`에 숫자 ID를 기록할 수 있다. 연결하지 않은 신규 후보는 `anilistId: null`로 유지한다.

```json
{
  "decision": "APPROVED_NEW",
  "anilistId": null,
  "aliases": ["선택적 검색 별칭"],
  "reviewedAt": "ISO 8601 UTC 시각",
  "reviewedBy": "검토자 식별값"
}
```

제목·바인딩 중복 검사에서 `NEW_CANDIDATE`인 행만 로컬 시험용으로 일괄 승인할 때는 다음 명령을 사용한다. `--reviewed-by`에는 어떤 기준으로 승인했는지 추적 가능한 식별값을 넣는다.

```powershell
npm run catalog:approve-new -- --profile increment-2026-09 --reviewed-by owner-approved-automated-diff-v1
npm run catalog:targets -- --profile increment-2026-09
npm run catalog:seed-increment -- --profile increment-2026-09
```

`catalog:seed-increment`는 캡처된 공개 시즌 증거를 기존과 같은 `SourceRecord → FieldClaim → CanonicalAnime → ServiceProjection` 흐름으로 통과시킨다. AniList 연결이 없어도 제목, AniLife ID, 형식, 에피소드 수, 장르 증거를 보존한다. 이 단계에서는 연도 목록에 없는 상태·커버·제작진·캐릭터를 추측하지 않으므로 readiness는 `BLOCKED`가 정상이다. 이후 검토된 AniLife 상세 페이지를 수집하면 상태·형식과 권리 승인된 표지가 `FIELD_REVIEW_REQUIRED`로 추가되며, 표지는 이미지 안전성·작품 연결·품질 검토까지 통과해야 한다.

일반 수집기의 서버 연결이 AniLife 쪽 연결 정책 등으로 차단되지만 공개 페이지가 브라우저에는 정상 표시되는 경우, 검토된 브라우저 캡처를 오프라인으로 가져오는 보조 경로를 사용할 수 있다. 캡처는 숫자형 content 페이지의 최소 JSON-LD·작품 배지와 현재 페이지가 실제로 불러온 해당 작품 표지만 저장해야 한다. import 시 manifest/binding/content ID/제목/표지 URL과 캡처·이미지 SHA-256을 다시 확인한다.

```powershell
npm run catalog:capture-anilife-details -- --profile increment-2026-09 --allow-network
npm run catalog:import-browser-captures -- --profile increment-2026-09
```

첫 명령은 이미 해시 검증된 작품을 자동으로 건너뛰고, 최대 100편 단위와 120~200초 배치 휴식으로 재개 가능한 캡처를 만든다. 로컬 Chromium도 연결 종료되는 환경에서는 같은 수집 모듈에 정책 승인된 앱 브라우저 탭을 주입해 실행할 수 있다. 두 번째 import 명령은 네트워크 요청을 하지 않는다. 캡처 파일이 빠졌거나 작품·표지 연결이 맞지 않으면 해당 대상만 `PENDING_REVIEW`로 남기며, 모든 대상이 통과한 뒤 아래의 offline rebuild와 품질 검증을 수행한다.

AniList로 빈 필드를 보강할 때는 먼저 별도 binding 보고서를 만든다. 정규화 제목·연도·형식·표지 일치가 강한 작품만 자동 승인하고, 중복 ID·기존 카탈로그 ID·근거 부족은 수동 검토로 남긴다.

```powershell
npm run catalog:match-anilist -- --profile increment-2026-09 --allow-network
npm run catalog:collect -- --profile increment-2026-09 --sources anilist --allow-network --batch-size 100 --pause-min-seconds 120 --pause-max-seconds 200
```

기존 `ANILIFE:<id>` target key와 MOEMOA ID는 유지된다. 기존 scalar `VALUE`와 AniLife 표지는 덮어쓰지 않고, AniList는 빈 scalar·제작사·관계·장르·캐릭터·일본어 성우 등을 provenance와 함께 추가한다.

```powershell
npm run catalog:rebuild -- --profile increment-2026-09
npm run catalog:validate -- --profile increment-2026-09
npm run catalog:report -- --profile increment-2026-09
```

로컬 검색 화면에서 기존 3,998건과 신규 226건을 함께 시험하려면 개발 서버 실행 전에 두 프로필을 선택한다.

```powershell
$env:MOEMOA_CATALOG_PROFILES='full3998,increment-2026-09'
```

나중에 AniList ID를 확인한 작품은 검증된 증분 binding 파일에 추가하거나, 다음 월의 새 증분 프로필에서 연결한다. AniList API 수집은 `ANILIST:<id>` target 또는 AniList ID가 별도 검증된 `ANILIFE:<id>` target에만 적용한다. 공식 API가 중지되어 있거나 403을 반환하면 재시도해 우회하지 않는다.

## 현재 캡처 결과

2026-09-03 기준 공개 연도 목록 312건을 발견 큐로 만들었다. 기존 제목과 정확히 일치하는 후보 84건, 제목 변형 후보 1건, 복수 기존 작품과 충돌하는 후보 1건, 신규 후보 226건이다.

현재 외부 TEST_ONLY 작업공간에는 신규 후보 226건이 `SOURCE_REVIEWED`로 materialize되어 있다. AniLife 상세·표지 226건은 모두 유지되며, AniList 2026 후보 439건과 제목 검색을 교차 비교해 115건을 고유 ID로 승인·상세 수집했다. 111건은 근거 부족 70건, 증분 중복 ID 30건, 기존 카탈로그 ID 중복 11건으로 강제 연결하지 않았다.

AniList 보강 후 `READY` 72건, `READY_WITH_GAPS` 154건이며 품질·서비스 게이트가 모두 통과했다. 신규 `VALUE` 보강은 시즌 113건, 시작일 115건, 종료일 72건, 화수 10건, 원작 유형 114건, 공식 링크 110건, 제작사 113건, 관계 111건, core genre 110건, 캐릭터 114건, 일본어 성우 112건이다. 총 1,888개 캐릭터와 1,829개 casting이 provenance를 포함해 저장됐다. 기존 populated scalar 408개와 AniLife 표지 226개는 변경 0건으로 확인했다.

기존 `full3998` 3,998건은 그대로이며 canonical/service projection 합계는 4,224건이다. 나머지 86건은 기존 작품 여부를 더 확인할 수 있도록 증분 manifest에서 제외했다. 이 완료 상태는 권리·필드 검토가 기록된 외부 staging 작업공간 기준이며, 실제 Production release 게시·활성화는 별도 실행이다.
