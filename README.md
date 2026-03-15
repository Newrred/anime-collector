# anime-collector

브라우저만으로 동작하는 개인 애니 기록 서비스입니다.  
핵심 흐름은 `검색 -> 보관 -> 감상 기록 -> 회고 -> 티어 정리 -> 백업`입니다.

## 개요

- `offline-first` 개인 기록 앱
- 주요 화면: `홈 / 보관함 / 티어 / 데이터`
- 저장 구조: `IndexedDB 우선 + localStorage 미러 + 레거시 마이그레이션`
- 상단 공통 메뉴에서 `라이트/다크`, `한/영`, `도움말`, `백업/복원` 제공
- self-host 폰트 사용
  - 한국어: `Noto Sans KR`
  - 영어: `Noto Sans`
- PWA 설치와 JSON 백업/복원 지원

## 주요 기능

### 홈 (`/`)

- 오늘 다시 열어볼 만한 애니 중심의 홈 구성
- 최근 감상 기록 / 아직 기록이 없는 작품 / 캐릭터 회상 카드
- 캐릭터 인사이트 시트
- 연도별 리캡 텍스트 복사 / 공유 / 이미지 저장
- 티어보드로 바로 이어지는 진입 카드

### 보관함 (`/library/`)

- AniList + Wikidata 기반 작품 검색
- 작품 추가 시 초기 상태 지정
- 상태, 별점, 메모, 재시청 횟수 관리
- 감상 로그 추가 / 수정 / 삭제
- 캐릭터 고정, 관련 작품 탐색, 빠른 기록 시트
- 고급 필터, 정렬, 장르 칩, 카드 밀도 조절
- `정보 함께 / 포스터만` 보기 전환
- 상세 팝업에서 탭별 콘텐츠 스크롤 분리

### 티어 (`/tier/`)

- 드래그 앤 드롭 기반 티어보드
- 저장된 주제 전환
- 장르 주제 / 커스텀 주제 생성 및 저장
- 모든 주제에서 공통 애니 풀 사용
- 미분류 영역 검색 + 장르 드롭다운 지원
- 백업 JSON에 `tierTopics`까지 함께 저장

### 데이터 (`/data/`)

- 저장 엔진 상태와 사용량 확인
- quota / persistence 상태 확인 및 요청
- 백업 이력 요약

## UI 시스템

- 공통 타이포 계층: `display / title / body / caption / label`
- 공통 색상 계층: `interactive / status / overlay / media`
- 공통 spacing / size 토큰 사용
- 아이콘 버튼, segmented toggle, 카드, 패널 스타일 통일
- 전체 locale 전환 시 UI 문구와 애니 제목 표시 우선순위가 함께 전환됨

자세한 규칙은 [docs/UI_EDIT_GUIDE.md](docs/UI_EDIT_GUIDE.md)에서 확인할 수 있습니다.

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
- `tierTopics`: 주제형 티어보드 번들
- `mediaCache`: AniList 응답 캐시

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
  messages/
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
- `src/messages`: locale별 중앙 번역 파일
- `src/domain`: 정규화, 셀렉터, UI preference, 타이틀/티어/리캡 로직
- `src/repositories`: 저장소 접근 계층
- `src/storage`: storage key, IDB, 마이그레이션
- `src/lib`: 외부 API 연동
- `src/services`: 공유 이미지, 리캡 보조 서비스

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

테스트 스펙:

- `tests/library.spec.ts`: 보관함 레이아웃, 필터, 상세 팝업, 로그, 데이터 메뉴
- `tests/home-data.spec.ts`: 홈 / 데이터 렌더와 공통 UI 안정성
- `tests/tier.spec.ts`: 티어보드 주제 전환, 드래그, 레이아웃
- `tests/live-search.spec.ts`: 외부 API 기반 실검색 확인

## 배포

GitHub Pages 배포를 사용합니다.

- 워크플로: `.github/workflows/astro.yml`
- 브랜치 푸시 시 정적 빌드 후 Pages에 배포
- `astro build`에 Pages용 `site/base` 설정이 주입됩니다

## 참고 문서

- UI 수정 가이드: `docs/UI_EDIT_GUIDE.md`
