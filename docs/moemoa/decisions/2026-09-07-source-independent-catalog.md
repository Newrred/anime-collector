# SOURCE-INDEPENDENT-CATALOG-01

2026-09-07 사용자가 AniList ID를 내부 확인용으로만 보관하고 사용자에게 AniList 이동 기능을 제공하지 않는 방향과 후속 구현을 승인했다.

- 검색·상세·작품 저장·Memory 연결은 MOEMOA anime UUID로 가능해야 한다.
- 외부 source binding은 선택적인 출처 정보다. binding 부재를 데이터 검증 완료로 해석하지 않는다.
- 승인된 AniLife 표지도 동일한 bytes/hash/권리 검증을 거쳐 제공한다.
- 기존 numeric Library 저장소를 재작성하지 않고 UUID 작품 저장을 별도 로컬 영역으로 추가한다. Title Hub/내 작품은 두 영역을 함께 읽는다. 작품 상태 remote sync는 기존 미정 게이트를 유지한다.
- 226건의 게시 여부는 작품 식별·중복·시즌 검토 결과로 결정한다. provider 지원만으로 일괄 게시하지 않는다.
- 기존 원본과 사용자 데이터는 삭제하지 않는다. 롤백 시 추가 저장 영역도 보존한다.
