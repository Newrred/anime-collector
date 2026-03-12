# anime-collector

브라우저만으로 동작하는 개인 애니 기록 서비스입니다.  
핵심 목표는 `검색 → 보관 → 감상 기록 → 회고/정리`를 하나의 흐름으로 묶는 것입니다.

## 서비스 요약

- 서버 없이 작동하는 `offline-first` 구조
- 페이지 축: `홈 / 보관함 / 티어 / 데이터`
- 상단 공통 UI: `홈 | 보관함 | 티어` + 우측 `도움말 아이콘` + `관리(톱니) 아이콘`
- 관리 메뉴에서 JSON 백업/복원 및 모바일 공유를 처리

## 핵심 사용자 흐름

1. 보관함에서 작품 검색/추가
2. 상세 모달에서 상태, 별점, 메모, 재시청 정보 기록
3. 감상 로그와 캐릭터 로그가 자동 축적
4. 홈에서 회고 카드/연간 리캡 확인
5. 티어에서 작품을 드래그로 재정렬
6. 관리 메뉴로 데이터 내보내기/불러오기

## 주요 기능

### 1) 보관함 (`/library/`)

- 한글 강화 검색: `aliases + AniList + Wikidata`
- 검색 단계 표시 + 로딩 점 애니메이션
- 라이브러리 필터: 텍스트/장르/상태
- 정렬 + 카드 밀도 슬라이더 + 포스터/메타 뷰 전환
- 상단 섹션(추가/통계/검색·정렬) 공통 접기/펼치기

### 2) 상세 기록(작품 모달)

- 상태 변경(완료/보는중/보류/하차/미분류)
- 별점: 5점 만점, 0.5 단위
- 메모, 재시청 횟수, 마지막 재시청일
- 감상 기록(WatchLog) 추가/편집/삭제
- 캐릭터 기반 로그(대표 캐릭터, affinity, reason tag, 노트)
- 관련 시리즈 조회 및(애니 포맷일 때) 보관함 바로 추가

### 3) 홈 (`/`)

- 최근 감상/재노출 카드
- 캐릭터 기반 인사이트
- 연도별 리캡(Top 작품/Top 캐릭터/시즌 분포)
- 리캡 공유(텍스트/공유 API/이미지 카드)

### 4) 티어 (`/tier/`)

- Drag & Drop 티어 편집
- 감상 기록 기반 필터(연도/시즌/재시청/캐릭터/포인트 태그)
- 필터 관점으로 티어를 재해석 가능

### 5) 데이터/백업 (`/data/`)

- 저장 엔진/용량/저장 보호(persisted) 상태 확인
- 백업 파일 내보내기/불러오기
- 불러오기 모드: `이어붙이기(merge)` / `덮어쓰기(overwrite)`
- 모바일 공유/클립보드 백업 시나리오 지원

## 구현 포인트

### 검색 파이프라인

- `aliases`로 빠른 선매칭
- AniList GraphQL 기본 검색
- 한글 검색 보강용 Wikidata/WDQS 확장
- 최종 결과를 중복 제거/정렬 후 UI에 단계적으로 반영

### 데이터 구조

- `LibraryItem`: 현재 상태 스냅샷
- `WatchLog`: 시점 이벤트 로그
- `CharacterPin`: 캐릭터 고정 데이터
- `TierState`: 티어 배치 상태

### 저장 아키텍처

- 우선 저장소: IndexedDB
- 보조 미러: localStorage
- 레거시 localStorage 데이터 자동 마이그레이션
- 백업 포맷 버전 관리(`version: 3`)

### UI 아키텍처

- Astro + React(`client:only`) 혼합
- 상단 공통 메뉴 컴포넌트: `TopNavDataMenu`
- 테마 토큰(`src/styles/global.css`) 기반 색상 시스템
- 커스텀 스크롤바(세로/가로 칩 스크롤) 적용

## 백업 JSON 형식

```json
{
  "app": "ani-site",
  "version": 3,
  "exportedAt": "2026-03-10T00:00:00.000Z",
  "list": [],
  "tier": {},
  "watchLogs": [],
  "characterPins": [],
  "preferences": {
    "cardsPerRowBase": 5,
    "cardView": "meta"
  }
}
```

- `v1`(배열 또는 `{ list, tier }`) 입력도 호환
- 검색/미디어 캐시는 export 대상에서 제외

## 프로젝트 구조

- `src/pages`: Astro 라우트 엔트리
- `src/components`: 주요 화면 컴포넌트
- `src/components/home`: 홈 세부 컴포넌트
- `src/domain`: 도메인 정규화/셀렉터
- `src/repositories`: 데이터 접근 계층
- `src/storage`: IDB/localStorage 계층 + 마이그레이션
- `src/lib`: 외부 API(AniList, Wikidata) 연동

## 기술 스택

- Astro 5
- React 19
- AniList GraphQL API
- Wikidata / WDQS
- PWA (manifest + service worker)

## 로컬 실행

```bash
npm install
npm run dev
```

기본 주소: `http://localhost:4321`

```bash
npm run build
npm run preview
```

## 테스트

```bash
npm run test:e2e
```

외부 API 실시간 품질 점검:

```bash
npm run test:e2e:live
```

## 배포

GitHub Pages Actions 기반 자동 배포

- 워크플로 파일: `.github/workflows/astro.yml`
- 기본 브랜치 push 시 자동 빌드/배포

## 참고 문서

- UI 수정 가이드: `docs/UI_EDIT_GUIDE.md`
