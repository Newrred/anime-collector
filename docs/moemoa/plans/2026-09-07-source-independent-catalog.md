# MOEMOA 자체 ID 기반 카탈로그

사용자 승인: AniList ID는 선택적인 내부 확인용이며 외부 이동 기능을 제공하지 않는다. AniList ID 없이도 검색·상세·작품 저장·Memory 작성을 지원한다.

1. Catalog repository/resolver와 Title Hub/collection의 자체 ID 경로를 우선한다. 기존 AniList 기반 저장 기록은 호환한다.
2. 표지 게시의 AniList 고정 조건을 승인된 AniLife 출처까지 확장하되 검증·권리·작품 ID·hash 조건은 유지한다. DB 제약은 additive migration으로 변경한다.
3. AniList 외부 이동 버튼을 제거한다. 내부 출처 증거와 선택적인 외부 ID는 보존한다.
4. AniList ID가 없는 작품의 검색→상세→저장→목록→Memory 경로 및 기존 기록 호환을 테스트한다. React Doctor와 빌드 검증을 수행한다.
5. 226개는 별도 staging 검증에서 신규 지원 경로로 검사한다. 코드 지원이 완료돼도 시즌·표지 근거가 미검증인 데이터는 자동 게시하지 않는다.

기존 원본과 사용자 데이터는 삭제하지 않는다. 변경 전 결정 문서 01, 데이터 사양 04, 변경 관리 09를 따른다. 실행 후 변경 파일, 검증, 미완료 범위, DB migration과 복구를 보고한다.


## 실행 구조와 데이터 흐름

관련 결정은 SOURCE-INDEPENDENT-CATALOG-01. 실제 catalogRepository/resolver가 숫자 binding을 필수로 요구하고 Library IDB가 anilistId keyPath를 사용하는 것을 확인했다. 범위는 catalog 조회·Title Hub·저장·Memory 선택·승인 표지 export이며, Public/이미지 cloud/새 Android APK/미검증 자료 게시는 제외한다.

숫자 Library는 유지한다. UUID 전용 저장은 기존 IDB meta와 localStorage mirror에 추가하고 읽기 서비스에서 합친다. Memory는 nullable sourceBinding과 UUID sourceKey를 지원한다. 이 변경으로 legacy 원본을 승격하거나 삭제하지 않는다.

## 파일 지도와 마이그레이션

catalogRepository/catalogConsumer, Supabase resolver, Memory domain/selector, Title services/projection, titleLibraryRepo, 전역 검색·AddAnime·LibraryDetailModal, catalog-preview/export-v2, service-projection-v2가 구현 경로다. SQL provider check 확장 파일은 별도이며 운영 미적용. DB/웹 릴리스는 별도 검증 후 수행한다.

## 검증·보안·관찰 가능성

두 UUID가 검색/저장/Memory에서 섞이지 않는지, 실제 IndexedDB 새로고침 유지, legacy Hub/320px 회귀를 검증한다. cover provider와 bytes/hash는 별도 검사한다. 사용자 이미지·공개 범위·분석 이벤트는 변경하지 않는다. 로그에 사용자 기록이나 비밀값을 추가하지 않는다.

## 복구·위험·결정

변경 파일만 되돌리고 새 저장 영역은 보존한다. 기존 working tree 작업을 reset하지 않는다. 새 저장 영역은 legacy export/remote sync에 미포함이며 TITLE-STATE-SYNC-01 범위로 남긴다. 226개 transport 통과는 identity 승인과 구분한다. 추가 승인 질문 없이 사용자의 기존 ㅇㅋ 범위에서 구현했다.

## 진행 기록과 완료 보고

- 검색/상세의 외부 binding 선택화, 저장·Memory 연결, AniList 이동 버튼 제거 완료.
- 226건 offline transport 검사 PASS 226, 운영 게시 0.
- Chromium 4개 통과, catalog 245 pass/2 skip, React Doctor 72점 기존 6경고 유지.
- SQL 파일 준비, 실제 DB migration 적용 검증과 운영 배포는 미실행.
- 전체 변경/테스트/권리/복구/남은 범위는 ../reports/2026-09-07-source-independent-catalog.md.
