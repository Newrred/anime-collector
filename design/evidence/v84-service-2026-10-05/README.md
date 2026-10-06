# V8.4 실제 서비스 캡처

2026-10-05 실제 `src/`와 Memory runtime을 실행한 Chromium 캡처다. 제품 사용자 브라우저와 분리된 테스트 context에서 합성 기록/PNG를 생성했다. 시안 사진이나 사용자 개인 자료는 없다.

- bookshelf-1280 / archive-1280 / detail-1280: 실제 로컬 저장·책장·분류·감상 변경·Board 연결.
- images-1440 / images-390 / images-320: 파일 선택기로 로컬에 저장한 실제 합성 PNG의 원본 비율 목록.
- image-detail-1440 / image-detail-320 / image-detail-dark: 실제 상세와 테마 버튼 전환 후 안정된 스타일.
- titles-320: 실제 작품 화면의 모바일 탐색/키보드 전환.

검증 원본: `tests/channel-service.spec.ts`. 고유51개 Chromium 검사 PASS와 해당5개 테마 추가 재검사 PASS. 모바일 viewport가 실제 휴대폰 검증을 뜻하지는 않는다. 운영/hosted 환경은 이번 캡처 범위 밖이다. [실행 보고](../../../docs/moemoa/reports/2026-10-05-v84-web-application.md) 참조.
# 21차 추가 증거

`film-left-1280.png`, `film-left-390.png`: 합성 Memory 한 장의 왼쪽 배치. 두 장도 실제 bounding box 검증.
`wordmark-dark-hover.png`: 실제 dark 테마 로고 hover 배경 투명.
`status-menu-1440.png`, `status-menu-390.png`, `status-menu-320.png`, `status-menu-dark.png`: 실제 서비스의 공용 메뉴, 키보드/선택/취소/포커스/테마 검증. 모바일은 Chromium viewport이다.

위7장은 이번 추가분이며 앞서 보존한 기존10장과 실행 시점·범위를 구분한다. 실제 카탈로그 표지5작품이 포함된 캡처는 `.cache/v84-service/catalog-*.png`의 로컬 검토용으로만 보존한다.


# 22차 추가 증거

`classification-1440.png`, `classification-390.png`, `classification-320.png`: 실제 src/runtime의 카드별 캐릭터·커스텀 태그 편집 및 접힌 관리 도구. 합성 카드/캐릭터를 사용한 격리 Chromium context이며 개인 사진이나 사용자 감상은 아니다. 이번 회귀61개와 그중 마지막12개 재검사 PASS, 앞선51/64개와 합산하지 않는다. 모바일 viewport는 실물폰 검증이 아니다. 실제 프리렌 catalog 캐릭터 표시 확인은 별도 브라우저 관찰이며 이3장과 구분한다.

# 23차 추가 증거 — 2026-10-06

`detail-read-1440.png`, `detail-read-390.png`, `detail-read-320.png`: 입력 폼을 접은 실제 기억 상세의 읽기/짧은 정보·액션/기억·관리 탭.
`detail-picker-1440.png`, `detail-picker-390.png`, `detail-picker-320.png`: 명시적 기억 수정에서 별도 캐릭터 선택창. 화면이 로드된 뒤 캡처했고 모달은 viewport 캡처다.
`detail-picker-long-dark-320.png`:35명 합성 목록/12명 선택·추가 제한/dark/320px, 적용 footer가 화면 내에 남는 실제 실행 증거.

위7장은 격리 Chromium의 실제 src와 합성 기록이다. 이번 고유66 PASS(기본63+새 긴 목록1+private2), 반복·이전 회차와 합산하지 않는다. 실제 프리렌 표지/30명 캐릭터를 읽은6장과 결과 JSON은 `.cache/v84-service/catalog-detail-*.png`, `detail-23-catalog-evidence.json`에만 보존한다. QA의 합성 감상/임시 Memory는 별도 context이며 사용자 기록이나 운영 데이터가 아니다. [23차 보고](../../../docs/moemoa/reports/2026-10-05-v84-web-application.md#23차-후속--상세-읽기수정관리-분리-2026-10-06) 참조. 과거22차 캡처는 당시 레이아웃 근거로 보존했다.
