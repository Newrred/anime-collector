# AniLife 검토형 출처 승격과 회전 도메인 ExecPlan

> **계획 상태: `COMPLETE`**
> 작성일: 2026-09-03
> 관련 결정: `CATALOG-01`, `CATALOG-02`, `SOURCE-01`, `FULL-CATALOG-INGESTION-GATE-01`

## 1. 목적과 사용자 결과

AniLife 공개 상세 페이지의 사실 데이터가 출처·작품 식별·스키마 검증을 통과했을 때 무조건 `PROHIBITED`로 버려지지 않고 필드 검토 대상으로 남게 한다. AniLife 도메인은 코드에 고정하지 않고 Source Registry에서 교체하며, 과거에 저장한 증거는 당시 origin과 해시를 유지한다.

## 2. 관련 확정 결정

- `CATALOG-01`: 새 작품은 MOEMOA 내부 ID와 출처 증거를 유지한다.
- `CATALOG-02`: 상태·형식·화수 등 사실 필드를 자체 enum으로 정규화한다.
- `FULL-CATALOG-INGESTION-GATE-01`: 이번 변경은 대량 네트워크 수집이나 Production 게시 승인이 아니다.
- `SOURCE-01`: AniLife 전체를 직접 적재 출처로 확정하지 않는다. 사실 필드의 기술적 승격 가능성과 실제 권리 승인을 분리한다.

## 3. 현재 상태와 저장소 증거

- `tools/catalog-lab/sources/anilife-public-page-test.mjs`와 `tools/catalog-lab/pipeline/covers.mjs`가 `anilife1.tv`를 고정한다.
- `tools/catalog-lab/discovery/anilife-season.mjs`와 증분 claim 검증은 `anilife01.tv`를 별도로 고정한다.
- 현재 공개 상세 페이지는 JSON-LD에 제목·연도·화수·표지 URL을 제공하고 `.tv-work-badges`에 `완결`과 형식을 표시한다.
- `source-registry.json`의 AniLife promotion은 전 필드 `PROHIBITED`이며, 소개문·표지와 사실 필드를 구분하지 않는다.

## 4. 범위

### 포함

- AniLife 페이지 origin과 표지 asset origin을 Source Registry 설정으로 이동.
- 상세 페이지의 제한된 badge 구조에서 상태·형식을 수집하고 내부 enum으로 정규화.
- AniLife의 식별자·제목·형식·상태·연도·화수 사실 claim은 `FIELD_REVIEW_REQUIRED`로 분류.
- 사용자 확인된 무제한 허가에 따라 표지 claim을 `FIELD_REVIEW_REQUIRED`로 전환하고 권리 근거를 보존.
- 과거 증분 증거는 저장된 origin 내부 일관성으로 검증하고, 새 캡처는 현재 Registry origin과 일치시킴.
- fixture 기반 회귀 테스트와 실제 공개 페이지 구조 교차 확인.

### 제외

- AniLife 데이터나 표지의 실제 Production 게시 실행.
- AniLife 약관 또는 권리 상태를 자동으로 승인하는 기능.
- 대량 네트워크 수집 실행, 기존 4,224건 외부 작업공간 재작성, Supabase migration.
- 재생·영상·댓글·로그인·내부 API 접근.

## 5. 아키텍처·데이터 흐름

```text
Source Registry(baseUrl, coverOrigins, fieldPromotion)
→ season/detail endpoint allowlist
→ immutable SourceRecord
→ status/format normalization
→ field별 promotion claim
→ CanonicalAnime provenance/review state
→ validated TEST_ONLY cover observation
```

도메인 변경은 Registry의 `baseUrl`, `originReviewedUrl`, `termsUrl`, `robotsUrl`, `evidenceUrls`, `coverOrigins`, 검토 일자·상태를 함께 갱신해야 적용된다. 실행 시 Registry 검증을 통과하지 못하면 네트워크 요청 전에 실패한다.

## 6. 변경 파일 지도

- `tools/catalog-lab/config/source-registry.json`: 현재 AniLife origin, asset allowlist, 필드별 승격 정책.
- `tools/catalog-lab/contracts/catalogContracts.mjs`: 회전 가능한 HTTPS origin과 필드 정책 계약.
- `tools/catalog-lab/sources/anilife-public-page-test.mjs`: Registry 기반 URL과 상태·형식 파싱.
- `tools/catalog-lab/discovery/anilife-season.mjs`: 캡처 origin 고정 제거와 현재 Registry 대조.
- `tools/catalog-lab/pipeline/normalize.mjs`: AniLife status/format 정규화와 cover 권리 분리.
- `tools/catalog-lab/pipeline/claims.mjs`, `canonical.mjs`: 필드별 promotion과 redistribution 판정.
- `tools/catalog-lab/pipeline/covers.mjs`, `runner.mjs`, `cli.mjs`: 동적 표지 origin 전달.
- 관련 `tests/catalog-lab/*.test.mjs`: 설정 회전, 파싱, 승격 경계 회귀.
- `docs/moemoa/04_CATALOG_DATA_AND_INGESTION_SPEC.md`, `05_INCREMENTAL_CATALOG_UPDATE.md`: 운영·권리 게이트 기록.

## 7. 데이터·스키마 마이그레이션

앱 DB와 Supabase migration은 없다. 외부 TEST_ONLY workspace의 기존 SourceRecord와 canonical revision은 수정하지 않는다. 새 payload는 status/format을 포함하지만 구형 AniLife payload schema도 읽을 수 있게 유지한다. parser version과 설정이 바뀐 새 수집만 새 immutable revision을 만든다.

## 8. 마일스톤

1. Registry와 URL 계약을 origin 설정 기반으로 전환한다.
2. 상세 페이지 상태·형식과 표지를 정규화한다.
3. 사실/표현물별 promotion 경계를 claim과 canonical에 반영한다.
4. 관련 catalog test를 통과시키고 live DOM 구조와 다시 대조한다.

## 9. 테스트와 검증

- `node --test tests/catalog-lab/anilife-source.test.mjs`
- `node --test tests/catalog-lab/anilife-season-discovery.test.mjs`
- `node --test tests/catalog-lab/workspace-targets.test.mjs`
- `node --test tests/catalog-lab/canonical-pipeline.test.mjs`
- `node --test tests/catalog-lab/cover-validation.test.mjs`
- `npm run catalog:test`

네트워크 기반 전체 수집은 실행하지 않는다. 실제 페이지는 읽기 전용 브라우저로 JSON-LD, `og:image`, `.tv-work-badges` 구조만 교차 확인한다.

## 10. 보안·개인정보·권리 영향

공개 page/sitemap만 접근하며 기존 blocked path를 유지한다. 도메인은 Registry code review 없이는 바꿀 수 없고 HTTPS origin만 허용한다. 사용자 확인된 허가 범위는 Registry에 기록하되 표지 bytes는 이 수집 단계에서 외부 TEST_ONLY workspace에만 저장하고, 내부 이미지 검토 전 Production 게시하지 않는다. 사용자 데이터·로그인 정보는 취급하지 않는다.

## 11. 관찰 가능성·분석 이벤트

서비스 analytics는 추가하지 않는다. 기존 source stage, schema drift, cover failure, readiness 집계를 재사용한다.

## 12. 롤백·복구

변경 파일을 revert하면 기존 고정-origin TEST_ONLY 동작으로 돌아간다. 외부 workspace migration이 없으므로 데이터 롤백은 필요 없다. 새 origin이 잘못되면 Registry를 이전 검토된 값으로 되돌린다.

## 13. 위험과 완화

- HTML badge 변경: 인식한 제한된 구조와 어휘만 claim으로 만들고 나머지는 누락 또는 schema drift 처리.
- 도메인 탈취/오입력: HTTPS, origin-only base URL, endpoint path, asset origin allowlist 검증.
- 상태 의미 과대해석: raw `완결` provenance를 보존하고 `FIELD_REVIEW_REQUIRED`로만 분류.
- 이미지 오승격: 권리 승인과 별개로 cover promotion을 `FIELD_REVIEW_REQUIRED`로 고정하고 작품 연결·origin·디코드·품질 검토를 요구.

## 14. 필요한 사용자 결정

검토형 구조와 Production 게시 절차는 승인됐다. 사용자는 2026-09-03 14:07 KST에 AniLife 작품 정보와 표지의 영구 저장, 상업적 Production 표시, 재배포, 리사이즈·가공을 포함한 제한 없는 허가를 받았다고 확인했으며 증빙 원문은 사용자 보관이다. 외부 권리 게이트는 충족됐고 내부 필드·이미지 검토가 남아 있다.

## 15. 진행 기록

```text
[2026-09-03] 완료: 저장소 정책·기존 파이프라인·현재 AniLife 상세 DOM을 교차 확인.
[2026-09-03] 완료: origin 설정화, 상태·형식 파싱, 필드별 승격 경계, 구형 payload 호환성 구현.
[2026-09-03] 완료: catalog 전체 213개(통과 211, 플랫폼 스킵 2)와 production build 검증.
[2026-09-03] 결정: 별도 AniLife 출처 승인 증빙과 내부 필드 검토가 모두 완료된 뒤 Production 게시 진행.
[2026-09-03 14:07 KST] 사용자 확인: AniLife 재배포 허가 수령. 세부 허가 범위 확인 요청.
[2026-09-03] 사용자 확인: 작품 정보·표지·영구 저장·상업적 표시·재배포·리사이즈·가공에 제한 없음. 권리 정책 반영 완료.
```

## 16. 발견 사항과 계획 변경

- 현재 페이지 origin은 `https://anilife01.tv`지만 JSON-LD 표지 origin은 `https://anilife1.tv`다. page origin과 asset origin을 별도로 설정해야 한다.
- 현재 이용 약관 화면 자체에는 데이터·표지 재배포 권리가 명시되지 않지만, 사용자가 별도 무제한 허가를 받았다고 확인했다. 공개 약관 검토 상태와 사용자 보유 허가 증빙을 별도 provenance로 유지한다.
- 현재 origin의 robots 문서는 브라우저 클라이언트에서 확인할 수 없었다. Registry에 `UNAVAILABLE_REVIEW_REQUIRED`를 기록하고 이를 권리 승인으로 사용하지 않는다.

## 17. 완료 보고

- Registry가 현재 page/asset origin, 필드별 promotion, 도메인 검토 상태를 단일 계약으로 제공한다.
- AniLife 상세 adapter는 Registry origin만 사용하고 `.tv-work-badges`의 제한된 어휘에서 상태·형식을 수집한다.
- 식별자·제목·형식·상태·연도·화수와 권리 승인된 cover claim은 `FIELD_REVIEW_REQUIRED`로 검증된다.
- 저장된 과거 도메인 증거와 구형 payload는 그대로 읽을 수 있으며 migration은 없다.
- `npm run catalog:test`: 213개 중 211개 통과, Windows 플랫폼 조건 2개 스킵, 실패 0.
- `npm run build`: 성공. 기존 대형 chunk 경고만 유지된다.
- Production 사용·재배포 권리 게이트는 사용자 확인으로 충족했지만, 대량 네트워크 수집과 내부 필드·이미지 검토 및 실제 게시 실행은 이번 변경에 포함하지 않았다.
