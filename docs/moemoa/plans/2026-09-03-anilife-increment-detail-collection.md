# AniLife 2026 증분 상세 수집 ExecPlan

> **계획 상태: `COMPLETE`**
> 작성일: 2026-09-03
> 관련 결정: `CATALOG-01`, `CATALOG-02`, `CATALOG-PROD-01`, `ANILIFE-PROD-01`

## 1. 목적과 사용자 결과

`increment-2026-09`의 신규 226건을 AniLife 공개 상세 페이지와 정확히 연결해 상태·형식·표지 정보를 외부 TEST_ONLY 작업공간에 수집한다. 수집 후 동일한 canonical/service projection과 품질 게이트를 다시 생성해 Production 후보와 보류 대상을 구분한다.

## 2. 관련 확정 결정

- AniLife 작품 정보와 표지의 저장·가공·상업적 표시·재배포 권리는 사용자가 제한 없이 허가받았다고 확인했다.
- 외부 값은 출처와 검토 상태를 유지하며, 작품 식별·스키마·이미지 안전성·품질 검토 전에는 Production에 게시하지 않는다.
- MOEMOA 내부 ID를 유지하고 AniList ID는 필수값으로 만들지 않는다.

## 3. 현재 상태와 저장소 증거

- 연도 목록 312건 중 신규 후보 226건이 `SOURCE_REVIEWED` manifest로 고정돼 있다.
- seed 결과 canonical/service projection 합계는 4,224건이지만 신규 226건은 상태·표지가 없어 모두 `BLOCKED`다.
- `tools/catalog-lab/cli.mjs`는 increment profile을 최대 100건 배치로 처리하고 명시적 `--allow-network`를 요구한다.
- `anilife_public` Registry는 공개 sitemap과 숫자형 content 페이지만 허용하고 1.5초 단일 요청 간격을 강제한다.

## 4. 범위

### 포함

- 현재 Registry origin과 공개 sitemap/detail 구조의 사전 확인.
- `increment-2026-09` 226건의 AniLife 상세 metadata와 표지 수집.
- raw/normalized/claim/canonical/cover/service projection의 immutable 로컬 기록.
- 수집 후 offline rebuild, strict validation, 품질 보고서, 재실행 멱등성 확인.

### 제외

- 제외된 중복·모호 후보 86건의 자동 병합 또는 신규 승인.
- AniLife 내부 API, 재생, 댓글, 로그인 경로 접근.
- Supabase Production 업로드, catalog release 활성화, Web/Android 배포.
- 사용자 이미지나 개인 데이터 취급.

## 5. 아키텍처·데이터 흐름

```text
approved increment manifest
→ public sitemap/content fetch
→ immutable SourceRecord
→ status/format/cover normalization
→ exact AniLife content-id identity match
→ bounded cover download + signature/Chromium decode
→ canonical revision + ServiceProjection
→ quality report
```

## 6. 변경 파일 지도

- 외부 TEST_ONLY 작업공간의 `raw`, `normalized`, `claims`, `canonical`, `covers`, `images`, `current`, `service-projections`, `state`, `runs`, `reports` 아래에 수집 산출물을 추가한다.
- 이 ExecPlan에 승인·진행·결과를 누적한다.
- 파서 또는 수집기가 현재 공개 구조를 처리하지 못할 때만 관련 코드와 fixture 테스트를 최소 수정한다.
- 반복 작업은 `tools/catalog-lab/capture/anilife-detail-browser.mjs`와 정책 승인된 앱 브라우저 주입 모듈로 자동화하며, 유효한 기존 캡처는 건너뛴다.

## 7. 데이터·스키마 마이그레이션

앱 DB와 Supabase schema migration은 없다. 기존 3,998건과 기존 immutable revision은 삭제·덮어쓰기하지 않는다. 잘못된 새 revision은 이전 `current` pointer로 되돌릴 수 있다.

## 8. 마일스톤

1. 현재 origin과 대표 상세 페이지가 Registry allowlist 및 parser 계약을 통과하는지 확인한다.
2. 최대 100건 배치, 단일 동시성, 설정된 요청 간격과 배치 휴식으로 226건을 수집한다.
3. 저장 결과를 offline rebuild하고 품질 게이트의 상태·표지·readiness 집계를 확인한다.
4. 네트워크 없는 재빌드에서 추가 raw/image 성장이 없는지 확인하고 결과를 기록한다.

## 9. 테스트와 검증

- `npm run catalog:test`
- `npm run catalog:collect -- --profile increment-2026-09 --sources anilife_public --allow-network --refresh`
- `npm run catalog:import-browser-captures -- --profile increment-2026-09` (일반 서버 HTTP가 차단될 때 검토된 공개 브라우저 캡처를 오프라인 import)
- `npm run catalog:rebuild -- --profile increment-2026-09`
- `npm run catalog:validate -- --profile increment-2026-09`
- `npm run catalog:report -- --profile increment-2026-09`
- `npm run catalog:guard`
- 필요 시 수집 재실행 또는 offline rebuild의 성장량 0 확인.

## 10. 보안·개인정보·권리 영향

허용된 공개 GET 경로만 사용한다. redirect, 사설 IP, MIME/signature 불일치, 최대 byte 제한, decode 실패는 차단한다. 사용자 데이터와 인증정보는 사용하지 않는다. 표지는 사용자 확인된 허가 범위로 수집하되 내부 검토 상태를 유지한다.

## 11. 관찰 가능성·분석 이벤트

배치별 처리 수, source stage, error code, 저장 표지 수, service readiness, immutable artifact 성장량을 외부 작업공간의 snapshot과 품질 보고서로 확인한다. 서비스 analytics는 추가하지 않는다.

## 12. 롤백·복구

기존 immutable 산출물은 유지된다. 수집 도중 중단되면 checkpoint에서 재개한다. 새 canonical pointer가 잘못된 경우 이전 pointer로 복구하고 Production에는 아무 변경도 전파하지 않는다.

## 13. 위험과 완화

- 도메인 또는 DOM 변경: 사전 점검과 schema drift 차단.
- 과도한 요청: 1.5초 단일 요청 간격, 최대 100건 배치, 배치 간 120~200초 휴식.
- 잘못된 작품 표지: reviewed content ID와 exact identity 규칙을 모두 요구.
- 손상 이미지·redirect: 고정 origin, global IP, byte/signature/dimension/Chromium decode 검증.
- 부분 실패: 실패를 성공으로 표시하지 않고 target별 checkpoint와 오류 코드를 유지.

## 14. 필요한 사용자 결정

사용자는 2026-09-03 이 대화에서 신규 226건 상세 수집을 명시적으로 요청했다. 이는 TEST_ONLY 상세 수집 승인으로 기록한다. Production 게시와 제외 후보 86건의 병합은 별도 실행 범위다.

## 15. 진행 기록

```text
[2026-09-03] 승인: 사용자 요청으로 increment-2026-09 신규 226건 AniLife 상세 수집 실행.
[2026-09-03] 확인: 수집 전 신규 226건 모두 status/cover 누락으로 BLOCKED, 저장 표지 0건.
[2026-09-03] 사전 점검: 현재 origin `https://anilife01.tv/content/1036`은 공개 브라우저에서 정상 표시됐고 JSON-LD, 작품 배지, 현재 origin 표지를 확인했다.
[2026-09-03] 계획 변경: 로컬 서버 HTTP는 `ECONNRESET`로 종료됐으므로 공개 브라우저 렌더링의 최소 허용 필드와 실제 로드된 표지를 캡처한 뒤 오프라인 import하는 검증 경로를 추가했다.
[2026-09-03] 규칙 확인: 정식 표지 경로는 `/images/anime/<id>`, `<id>.poster`, `/posters/<id>-<공개 파일명>` 형태가 혼재한다. 허용 origin, exact content ID prefix, 확장자, MIME, checksum을 모두 요구한다.
[2026-09-03] 자동화: 수작업 반복을 중단하고 기존 캡처 재검증·자동 건너뛰기·checkpoint·100건별 휴식을 포함하는 전용 스크립트로 전환했다.
[2026-09-03] 수집 완료: 공개 상세 캡처 226건, 표지 파일 226건(26,015,564 bytes), 누락·실패 0건.
[2026-09-03] import 완료: source/canonical/cover/service projection 226건 완료, `PENDING_REVIEW` 0건, 모두 `READY_WITH_GAPS`.
[2026-09-03] 품질 확인: offline rebuild network 0회, artifact validation 통과, quality/service gate 모두 통과, 재실행 성장량 전부 0.
```

## 16. 발견 사항과 계획 변경

- 브라우저 보안 정책은 백그라운드 탭 조작을 허용하지 않았다. 우회하지 않고 활성 도구 호출 안에서 짧은 묶음으로 수집하며, Registry의 단일 동시성·최소 간격·100건별 휴식을 유지한다.
- 13개 `.jpg` 공개 URL은 브라우저 자산 메타데이터가 JPEG라고 표시했지만 실제 바이트는 PNG였다. URL 확장자나 서버 표기를 신뢰해 통과시키지 않고 JPEG/PNG/WebP 시그니처 파서에서 정확히 하나로 판별되는 경우만 실제 MIME으로 저장했다.

## 17. 완료 보고

- 상세 캡처/표지: 226/226, 보류 0.
- 상태: `AIRING` 138, `FINISHED` 76, `UPCOMING` 12.
- 형식: `TV` 206, `MOVIE` 17, `OVA` 3.
- canonical/service projection: 226/226, `READY_WITH_GAPS` 226.
- 품질 보고서: catalog gate 통과, service gate 통과, blocker 0.
- 멱등성: 재실행 성장량 source record/claim/canonical/image/service projection 모두 0.
- 테스트: catalog tests 219개 중 217 통과, Windows 권한 관련 2개 skip, 실패 0. Astro build 통과.
- 별도 기존 검사 상태: catalog guard는 이번 변경과 무관한 `test-results/title-hub-review.png` 때문에 차단됐으며 해당 사용자 파일은 삭제하지 않았다.
- Production 게시·release 활성화는 이번 범위에 포함하지 않았다.
