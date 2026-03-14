# anime-collector

브라우저만으로 동작하는 개인 애니 기록 서비스입니다.  
핵심 흐름은 `검색 -> 보관 -> 감상 기록 -> 회고 -> 티어 정리 -> 백업`입니다.

## 개요

- 서버 없이 동작하는 `offline-first` 구조
- 주요 페이지: `홈 / 보관함 / 티어 / 데이터`
- 저장소: `IndexedDB 우선 + localStorage 미러 + 레거시 마이그레이션`
- 상단 공통 메뉴에서 `라이트/다크`, `한/영`, `도움말`, `백업/복원` 제공
- PWA 설치와 JSON 백업/복원 지원

## 현재 기능

### 1. 홈 (`/`)

- 최근 감상 기록 카드
- 기록이 아직 없는 작품 회상 카드
- 캐릭터 기반 회상/인사이트
- 연도별 리캡
- 리캡 텍스트 복사 / 공유 / 이미지 저장

### 2. 보관함 (`/library/`)

- AniList + Wikidata + alias 기반 검색
- 초기 상태를 지정해서 작품 추가
- 상태, 점수, 메모, 재시청 정보 관리
- 감상 로그 추가 / 수정 / 삭제
- 캐릭터별 감정 태그, 이유 태그, 메모 기록
- 관련 시리즈 탐색 및 바로 추가
- 필터 / 정렬 / 장르 칩 / 카드 밀도 조절 / 포스터/메타 뷰 전환

### 3. 티어 (`/tier/`)

- 드래그 앤 드롭 티어 보드
- `전체 작품`, `장르 주제`, `커스텀 주제` 저장
- 주제별로 서로 다른 랭킹 상태 유지
- 커스텀 주제에서 작품을 직접 선택해 별도 보드 생성
- 백업 JSON에 `tierTopics`까지 함께 저장

### 4. 데이터 (`/data/`)

- 저장 엔진 상태 확인
- 사용량 / quota 확인
- storage persistence 상태 확인 및 요청
- 백업 이력 요약

## UI / UX 기준

- 공통 상단 네비게이션과 관리 메뉴 사용
- `ko/en` locale 토글 지원
- `light/dark` theme 토글 지원
- 공통 버튼, 아이콘 버튼, 통계 카드, 리스트 카드, 세그먼트 버튼 스타일 사용
- self-host 폰트 사용:
  - 한국어: `Noto Sans KR`
  - 영어: `Noto Sans`

## 기술 스택

- Astro 5
- React 19
- Playwright
- AniList GraphQL
- Wikidata / WDQS
- IndexedDB + localStorage

## 데이터 구조

주요 저장 데이터는 다음과 같습니다.

- `list`: 보관 중인 작품의 현재 상태 스냅샷
- `watchLogs`: 감상 이벤트 로그
- `characterPins`: 고정한 캐릭터 정보
- `tier`: 레거시 단일 티어 상태
- `tierTopics`: 현재 주제형 티어 보드 번들

백업 JSON은 현재 `version: 4`를 사용합니다.

```json
{
  "app": "ani-site",
  "version": 4,
  "exportedAt": "2026-03-15T00:00:00.000Z",
  "list": [],
  "tier": {},
  "tierTopics": {
    "version": 1,
    "activeTopicId": "default-all",
    "topics": []
  },
  "watchLogs": [],
  "characterPins": []
}
```

호환성 메모:

- 예전 `tier` 단일 상태도 읽을 수 있습니다.
- 검색/미디어 캐시는 백업 대상이 아닙니다.

## 프로젝트 구조

```text
src/
  components/
    home/
    library/
    ui/
  data/
  domain/
  hooks/
  layouts/
  lib/
  pages/
  repositories/
  services/
  storage/
  styles/
tests/
  unit/
  library.spec.ts
  home-data.spec.ts
  tier.spec.ts
  live-search.spec.ts
```

구조 설명:

- `src/pages`: Astro 라우트 엔트리
- `src/components`: 페이지와 UI 컴포넌트
- `src/domain`: 정규화, 셀렉터, UI preference, tier topic 로직
- `src/repositories`: 저장소 접근 계층
- `src/storage`: storage key, IDB, 마이그레이션
- `src/lib`: 외부 API 연동
- `src/services`: 리캡 공유 등 페이지 보조 서비스

## 로컬 실행

```bash
npm install
npm run dev
```

기본 주소:

```text
http://127.0.0.1:4321
```

빌드 / 프리뷰:

```bash
npm run build
npm run preview
```

## 테스트

단위 테스트:

```bash
npm run test:unit
```

Playwright E2E:

```bash
npm run test:e2e
```

실시간 외부 검색 확인:

```bash
npm run test:e2e:live
```

테스트 스펙 구분:

- `tests/library.spec.ts`: 보관함 레이아웃, 검색, 모달, 로그, 데이터 메뉴
- `tests/home-data.spec.ts`: 홈 / 데이터 페이지 렌더와 저장 표면
- `tests/tier.spec.ts`: 티어 페이지 메뉴, 드래그, 초기화, 레이아웃
- `tests/live-search.spec.ts`: 외부 API 기반 실검색 확인

## 배포

GitHub Pages 배포를 사용합니다.

- 워크플로: `.github/workflows/astro.yml`
- 대상 브랜치: `master`
- `astro build --site --base` 형태로 Pages 기준 경로를 주입

## 참고 문서

- UI 수정 가이드: `docs/UI_EDIT_GUIDE.md`
